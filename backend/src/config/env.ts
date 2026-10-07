import { z } from "zod";

const httpsUrl = z.url().refine((value) => {
  const parsed = new URL(value);
  return (
    parsed.protocol === "https:" &&
    parsed.username === "" &&
    parsed.password === ""
  );
}, "must be a credential-free HTTPS URL");

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  HOST: z.string().trim().min(1).default("127.0.0.1"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  DATABASE_URL: z.url().refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "postgres:" || protocol === "postgresql:";
  }, "must be a PostgreSQL URL"),
  OIDC_ISSUER: httpsUrl,
  OIDC_AUDIENCE: z.string().trim().min(1),
  OIDC_JWKS_URL: httpsUrl,
  CORS_ORIGINS: z.string().default(""),
  ENABLE_API_DOCS: z.stringbool().default(false),
  MAX_REQUEST_BYTES: z.coerce
    .number()
    .int()
    .min(1_024)
    .max(10_485_760)
    .default(1_048_576),
  MAX_URL_LENGTH: z.coerce.number().int().min(256).max(16_384).default(4_096),
  MAX_UPLOAD_BYTES: z.coerce
    .number()
    .int()
    .min(1_024)
    .max(1_073_741_824)
    .default(10_485_760),
  PG_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(10_000).default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .min(1_000)
    .max(3_600_000)
    .default(60_000),
  WORKER_ENABLED: z.stringbool().default(false),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  SECRET_FILES_DIRECTORY: z.string().trim().min(1).default("/run/secrets"),
});

export type AppConfig = {
  nodeEnv: "development" | "test" | "production";
  host: string;
  port: number;
  databaseUrl: string;
  oidc: { issuer: string; audience: string; jwksUrl: string };
  corsOrigins: string[];
  docsEnabled: boolean;
  maxRequestBytes: number;
  maxUrlLength: number;
  maxUploadBytes: number;
  pgPoolMax: number;
  rateLimit: { max: number; windowMs: number };
  workerEnabled: boolean;
  logLevel: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";
  secretFilesDirectory: string;
};

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const fields = [
      ...new Set(
        result.error.issues.map((issue) =>
          String(issue.path[0] ?? "configuration"),
        ),
      ),
    ];
    throw new Error(`Invalid backend configuration: ${fields.join(", ")}`);
  }
  const parsed = result.data;
  const corsOrigins = parsed.CORS_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  for (const origin of corsOrigins) {
    let parsedOrigin: URL;
    try {
      parsedOrigin = new URL(origin);
    } catch {
      throw new Error("CORS_ORIGINS must contain valid origins");
    }
    if (parsedOrigin.origin !== origin) {
      throw new Error(
        "CORS_ORIGINS must contain origins without paths or trailing slashes",
      );
    }
  }
  if (
    parsed.NODE_ENV === "production" &&
    corsOrigins.some((origin) => new URL(origin).protocol !== "https:")
  ) {
    throw new Error("Production CORS origins must use HTTPS");
  }
  return {
    nodeEnv: parsed.NODE_ENV,
    host: parsed.HOST,
    port: parsed.PORT,
    databaseUrl: parsed.DATABASE_URL,
    oidc: {
      issuer: parsed.OIDC_ISSUER,
      audience: parsed.OIDC_AUDIENCE,
      jwksUrl: parsed.OIDC_JWKS_URL,
    },
    corsOrigins,
    docsEnabled: parsed.ENABLE_API_DOCS,
    maxRequestBytes: parsed.MAX_REQUEST_BYTES,
    maxUrlLength: parsed.MAX_URL_LENGTH,
    maxUploadBytes: parsed.MAX_UPLOAD_BYTES,
    pgPoolMax: parsed.PG_POOL_MAX,
    rateLimit: {
      max: parsed.RATE_LIMIT_MAX,
      windowMs: parsed.RATE_LIMIT_WINDOW_MS,
    },
    workerEnabled: parsed.WORKER_ENABLED,
    logLevel: parsed.LOG_LEVEL,
    secretFilesDirectory: parsed.SECRET_FILES_DIRECTORY,
  };
}
