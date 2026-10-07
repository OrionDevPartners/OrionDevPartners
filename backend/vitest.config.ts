import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: [
        "src/config/env.ts",
        "src/shared/errors.ts",
        "src/auth/authorization.ts",
        "src/persistence/idempotency.ts",
        "src/providers/provider-error.ts",
        "src/storage/storage-admission.ts",
        "src/jobs/health-check.ts",
      ],
      thresholds: { lines: 70, functions: 65, branches: 60, statements: 70 },
    },
  },
});
