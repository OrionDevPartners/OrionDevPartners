export type ProviderFailureKind =
  "unavailable" | "rate_limited" | "rejected" | "unknown";

export class ProviderError extends Error {
  constructor(
    readonly provider: string,
    readonly kind: ProviderFailureKind,
    options?: ErrorOptions,
  ) {
    super("Provider operation failed", options);
    this.name = "ProviderError";
  }
}

export function normalizeProviderError(
  provider: string,
  error: unknown,
): ProviderError {
  if (error instanceof ProviderError) {
    return error;
  }
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? error.status
      : undefined;
  const kind: ProviderFailureKind =
    status === 429
      ? "rate_limited"
      : typeof status === "number" && status >= 500
        ? "unavailable"
        : typeof status === "number" && status >= 400
          ? "rejected"
          : "unknown";
  return new ProviderError(provider, kind, { cause: error });
}
