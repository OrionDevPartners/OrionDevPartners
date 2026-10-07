import { describe, expect, it } from "vitest";
import {
  requireProjectAccess,
  type TenantAuthorizer,
} from "../../src/auth/authorization.js";
import {
  ForbiddenError,
  UnauthenticatedError,
} from "../../src/shared/errors.js";

const principal = {
  subject: "subject-1",
  issuer: "https://issuer.example.invalid/",
  audience: ["api"],
};

describe("project authorization boundary", () => {
  it("requires an authenticated identity", async () => {
    await expect(
      requireProjectAccess(
        undefined,
        { canAccessProject: async () => true },
        "t1",
        "p1",
      ),
    ).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it("denies cross-tenant project access and passes the principal to the policy", async () => {
    const calls: unknown[] = [];
    const policy: TenantAuthorizer = {
      canAccessProject: async (input) => {
        calls.push(input);
        return input.tenantId === "tenant-a";
      },
    };
    await requireProjectAccess(principal, policy, "tenant-a", "project-1");
    await expect(
      requireProjectAccess(principal, policy, "tenant-b", "project-1"),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(calls).toEqual([
      { subject: "subject-1", tenantId: "tenant-a", projectId: "project-1" },
      { subject: "subject-1", tenantId: "tenant-b", projectId: "project-1" },
    ]);
  });
});
