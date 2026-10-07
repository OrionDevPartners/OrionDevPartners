import type { SendOptions } from "pg-boss";

export const HEALTH_CHECK_QUEUE = "system.health-check";

export type HealthCheckJob = { requestedAt: string };

export async function handleHealthCheckJob(job: {
  data: HealthCheckJob;
}): Promise<{ handled: true }> {
  if (!Number.isFinite(Date.parse(job.data.requestedAt))) {
    throw new TypeError("Invalid health-check job payload");
  }
  return { handled: true };
}

export async function enqueueHealthCheck(
  queue: {
    send(
      name: string,
      data?: object | null,
      options?: SendOptions,
    ): Promise<string | null>;
  },
  requestedAt = new Date().toISOString(),
): Promise<string | null> {
  return queue.send(
    HEALTH_CHECK_QUEUE,
    { requestedAt },
    { retryLimit: 3, retryDelay: 30, retryBackoff: true },
  );
}
