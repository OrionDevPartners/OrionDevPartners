import { describe, expect, it, vi } from "vitest";
import { CapacityStorageAdmission } from "../../src/storage/storage-admission.js";
import { AppError } from "../../src/shared/errors.js";

describe("storage admission", () => {
  it("admits a bounded upload when capacity is established", async () => {
    const admission = new CapacityStorageAdmission(
      { availableBytes: async () => 2_000 },
      1_000,
    );
    await expect(admission.assertCanAccept(1_000)).resolves.toBeUndefined();
  });

  it.each([null, -1, 999])(
    "fails closed when capacity is unavailable or insufficient: %s",
    async (available) => {
      const admission = new CapacityStorageAdmission(
        { availableBytes: async () => available },
        1_000,
      );
      await expect(admission.assertCanAccept(1_000)).rejects.toMatchObject({
        code: "DEPENDENCY_UNAVAILABLE",
      });
    },
  );

  it("rejects invalid and over-limit request sizes before capacity checks", async () => {
    const availableBytes = vi.fn(async () => 5_000);
    const admission = new CapacityStorageAdmission({ availableBytes }, 1_000);
    await expect(admission.assertCanAccept(-1)).rejects.toBeInstanceOf(
      AppError,
    );
    await expect(admission.assertCanAccept(1_001)).rejects.toMatchObject({
      code: "PAYLOAD_TOO_LARGE",
    });
    expect(availableBytes).not.toHaveBeenCalled();
  });

  it("fails closed when capacity lookup itself fails", async () => {
    const admission = new CapacityStorageAdmission(
      { availableBytes: async () => Promise.reject(new Error("unavailable")) },
      1_000,
    );
    await expect(admission.assertCanAccept(10)).rejects.toMatchObject({
      code: "DEPENDENCY_UNAVAILABLE",
    });
  });
});
