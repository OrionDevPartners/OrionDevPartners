import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PgBoss } from "pg-boss";
import { loadConfig } from "../config/env.js";
import {
  handleHealthCheckJob,
  HEALTH_CHECK_QUEUE,
  type HealthCheckJob,
} from "./health-check.js";

export async function startWorker(): Promise<PgBoss> {
  const config = loadConfig();
  if (!config.workerEnabled) {
    throw new Error("Set WORKER_ENABLED=true to start the worker process");
  }
  const boss = new PgBoss({
    connectionString: config.databaseUrl,
    application_name: "oriondevpartners-worker",
    max: config.pgPoolMax,
  });
  boss.on("error", (error: Error) => {
    console.error(
      JSON.stringify({ event: "job_queue_error", errorType: error.name }),
    );
  });
  await boss.start();
  await boss.createQueue(`${HEALTH_CHECK_QUEUE}.failed`);
  await boss.createQueue(HEALTH_CHECK_QUEUE, {
    retryLimit: 3,
    retryDelay: 30,
    retryBackoff: true,
    expireInSeconds: 300,
    deadLetter: `${HEALTH_CHECK_QUEUE}.failed`,
  });
  await boss.work<HealthCheckJob>(HEALTH_CHECK_QUEUE, async (jobs) => {
    for (const job of jobs) {
      await handleHealthCheckJob(job);
    }
  });
  const shutdown = async (): Promise<void> => {
    await boss.stop({ graceful: true, timeout: 10_000 });
  };
  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
  return boss;
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  await startWorker().catch((error: unknown) => {
    console.error(
      JSON.stringify({
        event: "worker_start_failed",
        errorType: error instanceof Error ? error.name : "unknown",
      }),
    );
    process.exitCode = 1;
  });
}
