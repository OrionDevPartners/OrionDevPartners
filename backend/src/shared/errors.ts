import { ZodError } from "zod";

export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INVALID_REQUEST"
  | "PAYLOAD_TOO_LARGE"
  | "DEPENDENCY_UNAVAILABLE"
  | "RATE_LIMITED"
  | "INTERNAL";

const defaultStatus: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INVALID_REQUEST: 400,
  PAYLOAD_TOO_LARGE: 413,
  DEPENDENCY_UNAVAILABLE: 503,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly statusCode: number;

  constructor(
    readonly code: ErrorCode,
    message: string,
    statusCode = defaultStatus[code],
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = new.target.name;
    this.statusCode = statusCode;
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = "Authentication is required") {
    super("UNAUTHENTICATED", message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Access is forbidden") {
    super("FORBIDDEN", message);
  }
}

export class ConflictError extends AppError {
  constructor(message = "The command conflicts with existing state") {
    super("CONFLICT", message);
  }
}

export class DependencyUnavailableError extends AppError {
  constructor(message = "A required dependency is unavailable") {
    super("DEPENDENCY_UNAVAILABLE", message);
  }
}

export function toErrorResponse(error: unknown): {
  statusCode: number;
  body: { error: { code: ErrorCode; message: string } };
} {
  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      body: { error: { code: error.code, message: error.message } },
    };
  }
  if (error instanceof ZodError) {
    return appErrorResponse("INVALID_REQUEST", 400, "The request is invalid");
  }
  const statusCode = getStatusCode(error);
  if (statusCode === 413) {
    return appErrorResponse(
      "PAYLOAD_TOO_LARGE",
      413,
      "Request body is too large",
    );
  }
  if (statusCode === 429) {
    return appErrorResponse("RATE_LIMITED", 429, "Too many requests");
  }
  if (statusCode === 401) {
    return appErrorResponse(
      "UNAUTHENTICATED",
      401,
      "Authentication is required",
    );
  }
  if (statusCode === 403) {
    return appErrorResponse("FORBIDDEN", 403, "Access is forbidden");
  }
  if (statusCode === 404) {
    return appErrorResponse(
      "NOT_FOUND",
      404,
      "The requested resource was not found",
    );
  }
  if (statusCode === 400 || statusCode === 414 || statusCode === 415) {
    return appErrorResponse(
      "INVALID_REQUEST",
      statusCode,
      "The request is invalid",
    );
  }
  return {
    statusCode: 500,
    body: {
      error: { code: "INTERNAL", message: "An unexpected error occurred" },
    },
  };
}

function appErrorResponse(
  code: ErrorCode,
  statusCode: number,
  message: string,
): {
  statusCode: number;
  body: { error: { code: ErrorCode; message: string } };
} {
  return { statusCode, body: { error: { code, message } } };
}

function getStatusCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("statusCode" in error))
    return undefined;
  return typeof error.statusCode === "number" ? error.statusCode : undefined;
}
