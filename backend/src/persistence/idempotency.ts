import { createHash } from "node:crypto";
import { ConflictError } from "../shared/errors.js";
import { withTransaction, type Queryable } from "./postgres.js";
import type { Pool } from "pg";

export interface IdempotencyRepository {
  execute<T>(
    tenantId: string,
    key: string,
    requestHash: string,
    operation: (transaction: Queryable) => Promise<T>,
  ): Promise<T>;
}

type SavedCommand = {
  request_hash: string;
  response: unknown;
  state: "pending" | "completed";
};

export class PostgresIdempotencyRepository implements IdempotencyRepository {
  constructor(private readonly pool: Pool) {}

  execute<T>(
    tenantId: string,
    key: string,
    requestHash: string,
    operation: (transaction: Queryable) => Promise<T>,
  ): Promise<T> {
    return withTransaction(this.pool, async (client) => {
      const inserted = await client.query(
        `INSERT INTO idempotency_keys (tenant_id, idempotency_key, request_hash)
         VALUES ($1, $2, $3)
         ON CONFLICT (tenant_id, idempotency_key) DO NOTHING
         RETURNING id`,
        [tenantId, key, requestHash],
      );
      if (inserted.rowCount === 0) {
        const existing = await client.query<SavedCommand>(
          `SELECT request_hash, response, state
           FROM idempotency_keys
           WHERE tenant_id = $1 AND idempotency_key = $2
           FOR UPDATE`,
          [tenantId, key],
        );
        const saved = existing.rows[0];
        if (!saved || saved.request_hash !== requestHash) {
          throw new ConflictError(
            "Idempotency key was already used for a different command",
          );
        }
        if (saved.state !== "completed") {
          throw new ConflictError("The original command has not completed");
        }
        return saved.response as T;
      }

      const response = await operation(client);
      const serializedResponse = JSON.stringify(response);
      if (serializedResponse === undefined) {
        throw new TypeError(
          "Idempotent command response must be JSON-serializable",
        );
      }
      await client.query(
        `UPDATE idempotency_keys
         SET state = 'completed', response = $3, completed_at = now()
         WHERE tenant_id = $1 AND idempotency_key = $2`,
        [tenantId, key, serializedResponse],
      );
      return response;
    });
  }
}

export async function executeIdempotentCommand<T>(
  repository: IdempotencyRepository,
  input: { tenantId: string; key: string; command: unknown },
  operation: (transaction: Queryable) => Promise<T>,
): Promise<T> {
  if (input.key.length < 1 || input.key.length > 200) {
    throw new TypeError("Idempotency key length is invalid");
  }
  const requestHash = createHash("sha256")
    .update(canonicalJson(input.command))
    .digest("hex");
  return repository.execute(input.tenantId, input.key, requestHash, operation);
}

function canonicalJson(value: unknown, seen = new WeakSet<object>()): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return JSON.stringify(value);
  }
  if (typeof value !== "object") {
    throw new TypeError("Idempotent command must be JSON-serializable");
  }
  if (seen.has(value))
    throw new TypeError("Idempotent command cannot be circular");
  seen.add(value);
  try {
    if (Array.isArray(value))
      return `[${value.map((item) => canonicalJson(item, seen)).join(",")}]`;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("Idempotent command must contain plain JSON objects");
    }
    const entries = Object.entries(value).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item, seen)}`).join(",")}}`;
  } finally {
    seen.delete(value);
  }
}
