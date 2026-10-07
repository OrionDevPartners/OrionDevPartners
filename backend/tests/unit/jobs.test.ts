import { describe, expect, it, vi } from "vitest";
import {
  enqueueHealthCheck,
  handleHealthCheckJob,
  HEALTH_CHECK_QUEUE,
} from "../../src/jobs/health-check.js";

describe("safe health-check job", () => {
  it("enqueues with bounded retry settings and validates the payload", async () => {
    const send = vi.fn(async () => "job-id");
    await expect(
      enqueueHealthCheck({ send }, "2026-10-01T00:00:00.000Z"),
    ).resolves.toBe("job-id");
    expect(send).toHaveBeenCalledWith(
      HEALTH_CHECK_QUEUE,
      { requestedAt: "2026-10-01T00:00:00.000Z" },
      { retryLimit: 3, retryDelay: 30, retryBackoff: true },
    );
    await expect(
      handleHealthCheckJob({ data: { requestedAt: "not-a-date" } }),
    ).rejects.toThrow();
    await expect(
      handleHealthCheckJob({
        data: { requestedAt: "2026-10-01T00:00:00.000Z" },
      }),
    ).resolves.toEqual({
      handled: true,
    });
  });
});
