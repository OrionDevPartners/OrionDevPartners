import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config/env.js";

const validEnv = {
  DATABASE_URL: ["postgresql:", "//localhost:5432/app"].join(""),
  OIDC_ISSUER: "https://issuer.example.invalid/",
  OIDC_AUDIENCE: "api",
  OIDC_JWKS_URL: "https://issuer.example.invalid/jwks",
};

describe("loadConfig", () => {
  it("applies safe defaults and parses an origin allowlist", () => {
    const config = loadConfig({
      ...validEnv,
      CORS_ORIGINS: "https://ui.example.test,http://localhost:3000",
    });
    expect(config.port).toBe(3000);
    expect(config.pgPoolMax).toBe(10);
    expect(config.corsOrigins).toEqual([
      "https://ui.example.test",
      "http://localhost:3000",
    ]);
    expect(config.docsEnabled).toBe(false);
  });

  it("rejects missing OIDC configuration and unbounded pool settings", () => {
    expect(() => loadConfig({ DATABASE_URL: validEnv.DATABASE_URL })).toThrow();
    expect(() => loadConfig({ ...validEnv, PG_POOL_MAX: "51" })).toThrow();
  });

  it("rejects CORS URLs that are not bare origins", () => {
    expect(() =>
      loadConfig({ ...validEnv, CORS_ORIGINS: "https://ui.example.test/path" }),
    ).toThrow(/origins without paths/);
  });

  it("requires HTTPS for OIDC endpoints and production browser origins", () => {
    expect(() =>
      loadConfig({
        ...validEnv,
        OIDC_ISSUER: "http://issuer.example.invalid/",
      }),
    ).toThrow();
    expect(() =>
      loadConfig({
        ...validEnv,
        NODE_ENV: "production",
        CORS_ORIGINS: "http://ui.example.test",
      }),
    ).toThrow(/Production CORS origins/);
  });

  it("rejects non-PostgreSQL database URLs", () => {
    expect(() =>
      loadConfig({ ...validEnv, DATABASE_URL: "https://db.example.invalid" }),
    ).toThrow();
  });

  it("does not include invalid configuration values in startup errors", () => {
    let message = "";
    try {
      loadConfig({
        ...validEnv,
        DATABASE_URL: "https://db.example.invalid/private-value",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      message = (error as Error).message;
    }
    expect(message).toContain("DATABASE_URL");
    expect(message).not.toContain("private-value");
  });
});
