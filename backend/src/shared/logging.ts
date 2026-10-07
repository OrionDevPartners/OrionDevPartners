import type { FastifyServerOptions } from "fastify";
import type { AppConfig } from "../config/env.js";

export function loggerOptions(
  config: AppConfig,
): FastifyServerOptions["logger"] {
  return {
    level: config.logLevel,
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "req.headers.host",
        "req.headers.x-api-key",
        "req.host",
        "req.remoteAddress",
        "req.remotePort",
        "hostname",
        "req.body.password",
        "req.body.token",
        "req.body.secret",
      ],
      censor: "[REDACTED]",
    },
  };
}
