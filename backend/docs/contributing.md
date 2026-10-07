# Backend contributor guide

- Keep backend changes under `backend/`; do not modify the profile README/assets or generate UI files. The future Figma UI belongs in its own `website/` tree.
- Use the repository interfaces in application services; keep SQL and PostgreSQL client details in persistence adapters.
- Preserve tenant scoping on every tenant-owned query and test cross-tenant denial.
- Validate configuration and external input with Zod. Add deterministic tests and avoid network/paid service dependencies.
- Do not commit `.env`, database dumps, build/coverage output, credentials, private topology, operational evidence, or provider account details.
- Do not add automatic provider fallback for sensitive content. Normalize failures without logging raw request/response bodies.
- Use `npm ci`, then `npm run format`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:integration` with PostgreSQL, `npm run coverage`, and `npm run build`.
- Integration tests require an isolated disposable `TEST_DATABASE_URL`; migrations are safe to re-run in that test database.
- Workers remain a separately controlled process. New handlers must be idempotent, bounded, and have a documented failure/dead-letter policy.
- Keep CI least-privilege and do not add deployment-on-push behavior. Deployment delivery remains manual and approval-gated.
