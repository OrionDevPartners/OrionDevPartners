import type { AuthenticatedPrincipal } from "./identity.js";
import { ForbiddenError, UnauthenticatedError } from "../shared/errors.js";

export interface TenantAuthorizer {
  canAccessProject(input: {
    subject: string;
    tenantId: string;
    projectId: string;
  }): Promise<boolean>;
}

export async function requireProjectAccess(
  principal: AuthenticatedPrincipal | undefined,
  authorizer: TenantAuthorizer,
  tenantId: string,
  projectId: string,
): Promise<void> {
  if (!principal) {
    throw new UnauthenticatedError();
  }
  if (
    !(await authorizer.canAccessProject({
      subject: principal.subject,
      tenantId,
      projectId,
    }))
  ) {
    throw new ForbiddenError();
  }
}
