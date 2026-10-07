import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { loadConfig } from "../config/env.js";
import { withTransaction } from "./postgres.js";

const migrationPath = resolve(process.cwd(), "migrations/001_core.sql");

export async function runMigrations(pool: Pool): Promise<void> {
  const migration = await readFile(migrationPath, "utf8");
  await withTransaction(pool, async (client) => {
    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         version text PRIMARY KEY,
         applied_at timestamptz NOT NULL DEFAULT now()
       )`,
    );
    const applied = await client.query(
      "SELECT 1 FROM schema_migrations WHERE version = $1",
      ["001_core"],
    );
    if (applied.rowCount === 0) {
      await client.query(migration);
      await client.query(
        "INSERT INTO schema_migrations (version) VALUES ($1)",
        ["001_core"],
      );
    }
  });
}

async function main(): Promise<void> {
  const config = loadConfig();
  const pool = new Pool({
    connectionString: config.databaseUrl,
    max: 1,
    connectionTimeoutMillis: 5_000,
  });
  try {
    await runMigrations(pool);
    console.info("Database migrations completed");
  } catch {
    console.error("Database migrations failed");
    process.exitCode = 1;
  } finally {
    await pool.end().catch(() => {
      process.exitCode = 1;
    });
  }
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  await main();
}
