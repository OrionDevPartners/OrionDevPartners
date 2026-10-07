import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import Fastify, { LogController, type FastifyInstance } from "fastify";
import type { AppConfig } from "../config/env.js";
import { AppError, toErrorResponse } from "../shared/errors.js";
import { loggerOptions } from "../shared/logging.js";
import { registerPlugins } from "../plugins/register.js";
import type { HttpDependencies } from "./types.js";
import { registerRoutes } from "./routes.js";

export async function createApp(
  config: AppConfig,
  dependencies: HttpDependencies,
): Promise<FastifyInstance> {
  const app = Fastify<Server>({
    logger: loggerOptions(config),
    logController: new LogController({ requestIdLogLabel: "requestId" }),
    bodyLimit: config.maxRequestBytes,
    connectionTimeout: 10_000,
    requestTimeout: 30_000,
    keepAliveTimeout: 5_000,
    routerOptions: { maxParamLength: 200 },
    requestIdHeader: false,
    genReqId: () => randomUUID(),
  });
  app.decorate("db", dependencies.db);
  app.decorate("identityVerifier", dependencies.identityVerifier);
  app.setErrorHandler((error, request, reply) => {
    if (config.nodeEnv === "production") {
      const safeError =
        error instanceof Error ? { name: error.name } : { name: "unknown" };
      request.log.error({ error: safeError }, "Request failed");
    } else {
      request.log.error({ err: error }, "Request failed");
    }
    const result = toErrorResponse(error);
    return reply.code(result.statusCode).send(result.body);
  });

  await registerPlugins(app, config);
  app.addHook("onRequest", async (request, reply) => {
    reply.header("x-request-id", request.id);
    if ((request.raw.url?.length ?? 0) > config.maxUrlLength) {
      throw new AppError("INVALID_REQUEST", "Request URL is too long", 414);
    }
  });

  await registerRoutes(app);
  app.setNotFoundHandler((_request, reply) => {
    return reply.code(404).send({
      error: {
        code: "NOT_FOUND",
        message: "The requested resource was not found",
      },
    });
  });
  return app;
}
