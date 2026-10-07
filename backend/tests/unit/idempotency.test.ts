import { describe, expect, it } from "vitest";
import { ConflictError } from "../../src/shared/errors.js";
import {
  executeIdempotentCommand,
  type IdempotencyRepository,
} from "../../src/persistence/idempotency.js";
import type { Queryable } from "../../src/persistence/postgres.js";

class MemoryIdempotencyRepository implements IdempotencyRepository {
  private readonly responses = new Map<
    string,
    { hash: string; response: unknown }
  >();

  async execute<T>(
    tenantId: string,
    key: string,
    requestHash: string,
    operation: (transaction: Queryable) => Promise<T>,
  ): Promise<T> {
    const mapKey = `${tenantId}:${key}`;
    const saved = this.responses.get(mapKey);
    if (saved) {
      if (saved.hash !== requestHash) throw new ConflictError();
      return saved.response as T;
    }
    const response = await operation({} as Queryable);
    this.responses.set(mapKey, { hash: requestHash, response });
    return response;
  }
}

describe("idempotent commands", () => {
  it("replays a completed command without repeating its operation", async () => {
    const repository = new MemoryIdempotencyRepository();
    let calls = 0;
    const operation = async () => ({ result: ++calls });
    const first = await executeIdempotentCommand(
      repository,
      { tenantId: "tenant-a", key: "request-1", command: { b: 2, a: 1 } },
      operation,
    );
    const replay = await executeIdempotentCommand(
      repository,
      { tenantId: "tenant-a", key: "request-1", command: { a: 1, b: 2 } },
      operation,
    );
    expect(first).toEqual({ result: 1 });
    expect(replay).toEqual(first);
    expect(calls).toBe(1);
  });

  it("rejects reuse of a key for a different command", async () => {
    const repository = new MemoryIdempotencyRepository();
    const input = {
      tenantId: "tenant-a",
      key: "request-1",
      command: { amount: 10 },
    };
    await executeIdempotentCommand(repository, input, async () => "saved");
    await expect(
      executeIdempotentCommand(
        repository,
        { ...input, command: { amount: 11 } },
        async () => "other",
      ),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("rejects keys and commands that cannot be represented as JSON", async () => {
    const repository = new MemoryIdempotencyRepository();
    await expect(
      executeIdempotentCommand(
        repository,
        { tenantId: "tenant-a", key: "", command: {} },
        async () => ({}),
      ),
    ).rejects.toThrow(/key length/);
    const command: { self?: unknown } = {};
    command.self = command;
    await expect(
      executeIdempotentCommand(
        repository,
        { tenantId: "tenant-a", key: "request-1", command },
        async () => ({}),
      ),
    ).rejects.toThrow(/circular/);
  });
});
