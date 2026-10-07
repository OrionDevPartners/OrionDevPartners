import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { databaseIsReady } from "../health/readiness.js";
import { authenticate } from "./authenticate.js";

const meResponse = z.object({
  identity: z.object({ subject: z.string().min(1) }),
});

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health/live", async () => ({ status: "ok" }));

  app.get("/health/ready", async (_request, reply) => {
    if (await databaseIsReady(app.db)) return { status: "ok" };
    app.log.warn({ dependency: "postgres" }, "Readiness check failed");
    return reply.code(503).send({ status: "not_ready" });
  });

  app.get(
    "/api/v1/me",
    {
      preHandler: authenticate,
      schema: {
        tags: ["identity"],
        response: {
          200: {
            type: "object",
            properties: {
              identity: {
                type: "object",
                properties: { subject: { type: "string" } },
                required: ["subject"],
                additionalProperties: false,
              },
            },
            required: ["identity"],
            additionalProperties: false,
          },
        },
      },
    },
    async (request) =>
      meResponse.parse({ identity: { subject: request.principal!.subject } }),
  );
}
