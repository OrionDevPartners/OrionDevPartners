import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import type { AppConfig } from "../../src/config/env.js";
import { createApp } from "../../src/http/app.js";
import { runMigrations } from "../../src/persistence/migrate.js";
import {
  PostgresIdempotencyRepository,
  executeIdempotentCommand,
} from "../../src/persistence/idempotency.js";
import { PostgresProjectRepository } from "../../src/persistence/project-repository.js";
import {
  withTransaction,
  type Queryable,
} from "../../src/persistence/postgres.js";

const connectionString = process.env.TEST_DATABASE_URL;
const pool = new Pool({
  connectionString,
  max: 3,
  connectionTimeoutMillis: 5_000,
});
const integration = describe.skipIf(!connectionString);

integration("PostgreSQL persistence integration", () => {
  beforeAll(async () => {
    await runMigrations(pool);
    await runMigrations(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  it("migrates idempotently and scopes repository lookups to a tenant", async () => {
    const tenantResult = await pool.query<{ id: string }>(
      "INSERT INTO tenants (name) VALUES ($1), ($2) RETURNING id",
      [
        `integration-${crypto.randomUUID()}`,
        `integration-${crypto.randomUUID()}`,
      ],
    );
    const [tenantA, tenantB] = tenantResult.rows;
    if (!tenantA || !tenantB) throw new Error("Test tenant creation failed");

    try {
      const projects = new PostgresProjectRepository(pool);
      const project = await projects.create(tenantA.id, "alpha");
      await expect(
        projects.findById(tenantA.id, project.id),
      ).resolves.toMatchObject({ id: project.id });
      await expect(
        projects.findById(tenantB.id, project.id),
      ).resolves.toBeNull();

      await expect(projects.create(tenantA.id, "alpha")).rejects.toMatchObject({
        code: "23505",
      });
    } finally {
      await pool.query("DELETE FROM tenants WHERE id = ANY($1::uuid[])", [
        [tenantA.id, tenantB.id],
      ]);
    }
  });

  it("rolls back failed transactions and replays idempotent commands", async () => {
    const tenant = await pool.query<{ id: string }>(
      "INSERT INTO tenants (name) VALUES ($1) RETURNING id",
      [`integration-${crypto.randomUUID()}`],
    );
    const tenantId = tenant.rows[0]!.id;
    try {
      await expect(
        withTransaction(pool, async (client) => {
          await client.query(
            "INSERT INTO projects (tenant_id, name) VALUES ($1, $2)",
            [tenantId, "rolled-back"],
          );
          throw new Error("rollback");
        }),
      ).rejects.toThrow("rollback");
      const count = await pool.query(
        "SELECT 1 FROM projects WHERE tenant_id = $1",
        [tenantId],
      );
      expect(count.rowCount).toBe(0);

      const idempotency = new PostgresIdempotencyRepository(pool);
      let executions = 0;
      const input = {
        tenantId,
        key: crypto.randomUUID(),
        command: { operation: "create", value: 1 },
      };
      const operation = async (transaction: Queryable) => {
        executions += 1;
        await transaction.query(
          "INSERT INTO projects (tenant_id, name) VALUES ($1, $2)",
          [tenantId, `idempotent-${input.key}`],
        );
        return { result: executions };
      };
      const first = await executeIdempotentCommand(
        idempotency,
        input,
        operation,
      );
      const replay = await executeIdempotentCommand(
        idempotency,
        input,
        operation,
      );
      expect(replay).toEqual(first);
      expect(executions).toBe(1);
      const committed = await pool.query(
        "SELECT 1 FROM projects WHERE tenant_id = $1",
        [tenantId],
      );
      expect(committed.rowCount).toBe(1);
      await expect(
        executeIdempotentCommand(
          idempotency,
          { ...input, command: { operation: "create", value: 2 } },
          async () => ({}),
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
    } finally {
      await pool.query("DELETE FROM tenants WHERE id = $1", [tenantId]);
    }
  });

  it("reports database readiness without exposing dependency details", async () => {
    const config: AppConfig = {
      nodeEnv: "test",
      host: "127.0.0.1",
      port: 3000,
      databaseUrl: connectionString!,
      oidc: {
        issuer: "https://issuer.example.invalid/",
        audience: "api",
        jwksUrl: "https://issuer.example.invalid/jwks",
      },
      corsOrigins: [],
      docsEnabled: false,
      maxRequestBytes: 1_048_576,
      maxUrlLength: 4_096,
      maxUploadBytes: 10_485_760,
      pgPoolMax: 3,
      rateLimit: { max: 100, windowMs: 60_000 },
      workerEnabled: false,
      logLevel: "silent",
      secretFilesDirectory: "/run/secrets",
    };
    const app = await createApp(config, {
      db: pool,
      identityVerifier: {
        verifyAccessToken: async () => ({
          subject: "integration-user",
          issuer: config.oidc.issuer,
          audience: [config.oidc.audience],
        }),
      },
    });
    try {
      expect((await app.inject("/health/ready")).json()).toEqual({
        status: "ok",
      });
    } finally {
      await app.close();
    }
  });
});
