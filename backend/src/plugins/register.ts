import compress from "@fastify/compress";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../config/env.js";

export async function registerPlugins(
  app: FastifyInstance,
  config: AppConfig,
): Promise<void> {
  await app.register(helmet);
  await app.register(compress, { global: true });
  await app.register(cors, {
    origin: config.corsOrigins.length > 0 ? config.corsOrigins : false,
    credentials: false,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    maxAge: 600,
  });
  await app.register(rateLimit, {
    max: config.rateLimit.max,
    timeWindow: config.rateLimit.windowMs,
    global: true,
  });

  if (config.docsEnabled && config.nodeEnv !== "production") {
    await app.register(swagger, {
      openapi: {
        info: { title: "OrionDevPartners API", version: "1.0.0" },
        servers: [{ url: "/" }],
      },
    });
    await app.register(swaggerUi, { routePrefix: "/api/docs" });
  }
}
