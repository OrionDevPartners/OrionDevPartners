import { describe, expect, it } from "vitest";
import {
  normalizeProviderError,
  ProviderError,
} from "../../src/providers/provider-error.js";

describe("provider error normalization", () => {
  it.each([
    [{ status: 429 }, "rate_limited"],
    [{ status: 503 }, "unavailable"],
    [{ status: 400 }, "rejected"],
    [new Error("secret provider response"), "unknown"],
  ] as const)("normalizes %s", (error, kind) => {
    const normalized = normalizeProviderError("generic", error);
    expect(normalized).toBeInstanceOf(ProviderError);
    expect(normalized.provider).toBe("generic");
    expect(normalized.kind).toBe(kind);
    expect(normalized.message).not.toContain("secret");
  });

  it("preserves an already normalized provider failure", () => {
    const error = new ProviderError("generic", "rejected");
    expect(normalizeProviderError("other", error)).toBe(error);
  });
});
