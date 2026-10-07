import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { z } from "zod";
import { UnauthenticatedError } from "../shared/errors.js";

export type AuthenticatedPrincipal = {
  subject: string;
  issuer: string;
  audience: string[];
};

export interface IdentityVerifier {
  verifyAccessToken(token: string): Promise<AuthenticatedPrincipal>;
}

const principalSchema = z.object({
  sub: z.string().trim().min(1),
  iss: z.string().url(),
  aud: z.union([z.string(), z.array(z.string()).min(1)]),
});

export class OidcIdentityVerifier implements IdentityVerifier {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(
    private readonly options: {
      issuer: string;
      audience: string;
      jwksUrl: string;
    },
  ) {
    this.jwks = createRemoteJWKSet(new URL(options.jwksUrl));
  }

  async verifyAccessToken(token: string): Promise<AuthenticatedPrincipal> {
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.options.issuer,
        audience: this.options.audience,
        algorithms: ["RS256", "ES256"],
      });
      return principalFromPayload(payload);
    } catch {
      throw new UnauthenticatedError("The access token is invalid or expired");
    }
  }
}

export function principalFromPayload(
  payload: JWTPayload,
): AuthenticatedPrincipal {
  const parsed = principalSchema.safeParse(payload);
  if (!parsed.success) {
    throw new UnauthenticatedError("The access token is invalid");
  }
  return {
    subject: parsed.data.sub,
    issuer: parsed.data.iss,
    audience: Array.isArray(parsed.data.aud)
      ? parsed.data.aud
      : [parsed.data.aud],
  };
}
