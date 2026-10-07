import type {
  AuthenticatedPrincipal,
  IdentityVerifier,
} from "../auth/identity.js";
import type { Queryable } from "../persistence/postgres.js";

declare module "fastify" {
  interface FastifyInstance {
    identityVerifier: IdentityVerifier;
    db: Queryable;
  }

  interface FastifyRequest {
    principal?: AuthenticatedPrincipal;
  }
}

export type HttpDependencies = {
  db: Queryable;
  identityVerifier: IdentityVerifier;
};
