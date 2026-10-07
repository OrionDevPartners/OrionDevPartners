import type { Queryable } from "../persistence/postgres.js";

export async function databaseIsReady(db: Queryable): Promise<boolean> {
  try {
    await db.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}
