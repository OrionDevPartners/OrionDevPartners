import {
  Pool,
  type PoolClient,
  type QueryResult,
  type QueryResultRow,
} from "pg";
import type { AppConfig } from "../config/env.js";

export function createPostgresPool(config: AppConfig): Pool {
  return new Pool({
    connectionString: config.databaseUrl,
    max: config.pgPoolMax,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    maxLifetimeSeconds: 1_800,
    statement_timeout: 10_000,
    application_name: "oriondevpartners-backend",
  });
}

export async function withTransaction<T>(
  pool: Pick<Pool, "connect">,
  operation: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export interface Queryable {
  query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<R>>;
}
