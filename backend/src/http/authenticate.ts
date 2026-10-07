import type { FastifyRequest } from "fastify";
import { UnauthenticatedError } from "../shared/errors.js";

const compactJwtPattern = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

export async function authenticate(request: FastifyRequest): Promise<void> {
  const authorization = request.headers.authorization;
  const parts =
    typeof authorization === "string" ? authorization.split(" ") : [];
  const token = parts[1];
  if (
    parts.length !== 2 ||
    parts[0] !== "Bearer" ||
    !token ||
    !compactJwtPattern.test(token)
  ) {
    throw new UnauthenticatedError();
  }
  request.principal =
    await request.server.identityVerifier.verifyAccessToken(token);
}
