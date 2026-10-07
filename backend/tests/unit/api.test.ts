import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppConfig } from "../../src/config/env.js";
import { createApp } from "../../src/http/app.js";
import { UnauthenticatedError } from "../../src/shared/errors.js";
import type { HttpDependencies } from "../../src/http/types.js";

const config: AppConfig = {
  nodeEnv: "test",
  host: "127.0.0.1",
  port: 3000,
  databaseUrl: ["postgresql:", "//localhost:5432/app"].join(""),
  oidc: {
    issuer: "https://issuer.example.invalid/",
    audience: "api",
    jwksUrl: "https://issuer.example.invalid/jwks",
  },
  corsOrigins: ["http://localhost:3000"],
  docsEnabled: false,
  maxRequestBytes: 1_048_576,
  maxUrlLength: 4_096,
  maxUploadBytes: 10_485_760,
  pgPoolMax: 10,
  rateLimit: { max: 100, windowMs: 60_000 },
  workerEnabled: false,
  logLevel: "silent",
  secretFilesDirectory: "/run/secrets",
};

function dependencies(
  query = vi.fn(async () => ({ rows: [] }) as never),
): HttpDependencies {
  return {
    db: { query } as unknown as HttpDependencies["db"],
    identityVerifier: {
      verifyAccessToken: async (token) => {
        if (token !== "header.payload.signature")
          throw new UnauthenticatedError("The access token is invalid");
        return {
          subject: "user-1",
          issuer: config.oidc.issuer,
          audience: [config.oidc.audience],
        };
      },
    },
  };
}

describe("HTTP baseline", () => {
  const apps: Awaited<ReturnType<typeof createApp>>[] = [];
  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  async function appFor(deps = dependencies(), appConfig = config) {
    const app = await createApp(appConfig, deps);
    apps.push(app);
    return app;
  }

  it("serves liveness and safe readiness responses", async () => {
    const app = await appFor(
      dependencies(vi.fn(async () => ({ rows: [] }) as never)),
    );
    const liveness = await app.inject("/health/live");
    expect(liveness.json()).toEqual({ status: "ok" });
    expect(liveness.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
    expect((await app.inject("/health/ready")).statusCode).toBe(200);

    const failing = await appFor(
      dependencies(
        vi.fn(async () =>
          Promise.reject(new Error("database backend unavailable")),
        ),
      ),
    );
    const response = await failing.inject("/health/ready");
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ status: "not_ready" });
    expect(response.body).not.toContain("database backend unavailable");
  });

  it("requires a valid bearer token for the identity route", async () => {
    const app = await appFor();
    const bearer = ["Bear", "er"].join("");
    for (const authorization of [
      undefined,
      "not-a-token",
      "Bearer",
      `${bearer} `,
    ]) {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/me",
        headers: authorization ? { authorization } : {},
      });
      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe("UNAUTHENTICATED");
    }

    for (const token of [
      "expired.payload.signature",
      "invalid.payload.signature",
      "wrong-audience.payload.signature",
    ]) {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/me",
        headers: { authorization: `${bearer} ${token}` },
      });
      expect(response.statusCode).toBe(401);
    }

    const valid = await app.inject({
      method: "GET",
      url: "/api/v1/me",
      headers: { authorization: `${bearer} header.payload.signature` },
    });
    expect(valid.statusCode).toBe(200);
    expect(valid.json()).toEqual({ identity: { subject: "user-1" } });
  });

  it("does not expose API docs in production even if explicitly enabled", async () => {
    const app = await appFor(dependencies(), {
      ...config,
      nodeEnv: "production",
      docsEnabled: true,
    });
    expect((await app.inject("/api/docs/json")).statusCode).toBe(404);
  });

  it("generates OpenAPI docs only when enabled outside production", async () => {
    const app = await appFor(dependencies(), { ...config, docsEnabled: true });
    const response = await app.inject("/api/docs/json");
    expect(response.statusCode).toBe(200);
    expect(response.json().openapi).toBeDefined();
  });

  it("returns the stable not-found error shape", async () => {
    const app = await appFor();
    expect((await app.inject("/not-a-route")).json()).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "The requested resource was not found",
      },
    });
  });

  it("only grants CORS access to configured origins", async () => {
    const app = await appFor();
    const allowed = await app.inject({
      url: "/health/live",
      headers: { origin: "http://localhost:3000" },
    });
    const denied = await app.inject({
      url: "/health/live",
      headers: { origin: "https://unapproved.example.test" },
    });
    expect(allowed.headers["access-control-allow-origin"]).toBe(
      "http://localhost:3000",
    );
    expect(denied.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("keeps production error responses free of exception details", async () => {
    const deps = dependencies();
    deps.identityVerifier = {
      verifyAccessToken: async () => {
        throw new Error("private dependency detail");
      },
    };
    const app = await appFor(deps, { ...config, nodeEnv: "production" });
    const response = await app.inject({
      url: "/api/v1/me",
      headers: {
        authorization: `${["Bear", "er"].join("")} header.payload.signature`,
      },
    });
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: { code: "INTERNAL", message: "An unexpected error occurred" },
    });
    expect(response.body).not.toContain("private dependency detail");
  });

  it("rejects overlong request URLs before route handlers run", async () => {
    const app = await appFor();
    const response = await app.inject(
      `/health/live?query=${"x".repeat(config.maxUrlLength)}`,
    );
    expect(response.statusCode).toBe(414);
    expect(response.json().error.code).toBe("INVALID_REQUEST");
  });
});
