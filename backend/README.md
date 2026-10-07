# Backend foundation

This is an isolated TypeScript/Node backend foundation. It does not implement product-specific behavior, deploy to a provider, or include UI code. The profile README and assets at the repository root remain unchanged; future Figma UI work can live independently under `website/`.

## Architecture

- `src/config`: Zod-validated runtime configuration and bounded limits.
- `src/http` and `src/plugins`: Fastify app construction, versioned routes, HTTP security plugins, and authentication hooks.
- `src/auth`: OIDC/JWT identity verification and tenant/project policy interfaces.
- `src/application`: domain-facing services that depend on repository interfaces.
- `src/persistence` and `migrations`: bounded PostgreSQL pool, transaction/idempotency helpers, repositories, and the operational schema.
- `src/jobs`: separately started pg-boss workers and a no-side-effect example job.
- `src/providers`: provider contracts, normalized failures, and mounted secret-file loading.
- `src/health`, `src/shared`, and `src/storage`: safe readiness, errors/logging, and fail-closed storage admission.

The schema includes tenants, users, OIDC identities, memberships, projects, idempotency keys, and an outbox table. Repository queries include tenant identifiers; new product repositories must preserve that boundary. The schema does not implement product data models.

## Requirements and local setup

- Node.js `24.21.0` (see `.nvmrc`) and npm.
- PostgreSQL 16 or a compatible managed PostgreSQL service.
- An OIDC issuer, API audience, and JWKS endpoint for authenticated API use.

For the local-only container setup, from `backend/`:

```sh
docker compose up --build
```

This publishes only localhost ports, uses a named PostgreSQL volume, and enables PostgreSQL `trust` authentication strictly inside the isolated development compose network. Do not reuse these settings outside local development. The identity URLs are invalid placeholders; configure a real trusted OIDC issuer before using `/api/v1/me`.

To run directly against a local PostgreSQL instance:

```sh
npm ci
cp .env.example .env
# Edit .env with local settings and a real OIDC issuer. Do not commit .env.
npm run migrate:dev
npm run dev
```

`.env.example` contains placeholders only. Configuration requires `DATABASE_URL`, `OIDC_ISSUER`, `OIDC_AUDIENCE`, and `OIDC_JWKS_URL`. Mounted provider secrets are read through `MountedFileSecretSource`; environment values with browser/public prefixes are not consumed. Production secrets should be injected by the runtime secret manager or mounted files, not baked into images.

## Environment variables

| Variable                                        | Default / requirement                     | Purpose                                                                           |
| ----------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------- |
| `NODE_ENV`                                      | `development`                             | `development`, `test`, or `production`                                            |
| `HOST`, `PORT`                                  | `127.0.0.1`, `3000`                       | Listen address/port; container config overrides host to `0.0.0.0`                 |
| `DATABASE_URL`                                  | Required                                  | PostgreSQL connection URL                                                         |
| `OIDC_ISSUER`, `OIDC_AUDIENCE`, `OIDC_JWKS_URL` | Required                                  | Trusted token issuer, API audience, and JWKS URL; issuer/JWKS URLs must use HTTPS |
| `CORS_ORIGINS`                                  | Empty (deny browser origins)              | Comma-separated exact origins; production origins must use HTTPS                  |
| `ENABLE_API_DOCS`                               | `false`                                   | Enables OpenAPI docs only outside production                                      |
| `MAX_REQUEST_BYTES`                             | `1048576`                                 | Request body limit; accepted range is 1 KiB–10 MiB                                |
| `MAX_URL_LENGTH`                                | `4096`                                    | Maximum request target length; accepted range is 256–16 KiB                       |
| `MAX_UPLOAD_BYTES`                              | `10485760`                                | Storage admission upload bound; accepted range is 1 KiB–1 GiB                     |
| `PG_POOL_MAX`                                   | `10`                                      | Bounded API/worker connection pool size (1–50)                                    |
| `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`        | `100`, `60000`                            | Global request rate bound and window                                              |
| `WORKER_ENABLED`                                | `false`                                   | Worker entrypoint guard; enable only in the dedicated worker process              |
| `LOG_LEVEL`                                     | `info`                                    | Structured logger severity                                                        |
| `SECRET_FILES_DIRECTORY`                        | `/run/secrets`                            | Directory for mounted provider secret files                                       |
| `TEST_DATABASE_URL`                             | Test-only, required for integration tests | Disposable PostgreSQL database URL                                                |

## Commands

```sh
npm ci
npm run typecheck
npm run lint
npm run format:check
npm test
npm run coverage
TEST_DATABASE_URL='postgresql://local-test@localhost:5432/backend_test' npm run test:integration
npm run build
npm run migrate                 # after build
npm start
WORKER_ENABLED=true npm run start:worker
```

The worker is a separate process and refuses to start unless `WORKER_ENABLED=true`. The API process never starts workers. Jobs must be idempotent, bound retries/timeouts, and avoid logging payloads or credentials. The example `system.health-check` job only validates its timestamp and has no external side effects. Failed jobs are directed to a dead-letter queue; operators need an explicit inspection/redrive policy before production use.

## HTTP and identity contract

- `GET /health/live`: process liveness.
- `GET /health/ready`: checks PostgreSQL and returns only `ok` or `not_ready`.
- `GET /api/v1/me`: requires an `Authorization` header containing a bearer scheme and access token; returns `{ "identity": { "subject": "..." } }`.
- `/api/docs` (including the generated OpenAPI document): enabled only outside production when `ENABLE_API_DOCS=true`; disabled by default.

Errors use `{ "error": { "code": "...", "message": "..." } }`. Production responses do not include exception details or stacks. OIDC verification checks issuer, audience, expiration, and an allowlist of signing algorithms against the configured remote JWKS. There is no demo/fallback authentication. Tenant membership is a policy boundary for future routes; it must be checked independently of token claims.

Configure `CORS_ORIGINS` as a comma-separated allowlist of exact origins. CORS credentials are disabled. Secure headers, compression, request IDs, redacted structured logs, global rate limiting, bounded request bodies, URL lengths, database pool size, and server timeouts are configured by the backend. The API does not trust forwarded proxy headers by default.

## Security and provider boundaries

The provider interfaces intentionally have no vendor implementation. Provider errors are normalized without returning provider response bodies. No provider fallback or silent resend is implemented; sensitive inference input must never be sent to a second provider implicitly. `SecretSource` supports mounted files with name validation. Never expose secrets in public/browser-prefixed variables, logs, errors, OpenAPI, fixtures, or container layers.

`MAX_REQUEST_BYTES` and `MAX_UPLOAD_BYTES` are configurable bounds. `StorageAdmission` rejects requests if capacity cannot be established or is insufficient. This repository does not implement a storage capacity probe, enforce a Mac 500 GB quota, or replace deployment-level filesystem/object-store quotas and admission controls.

## API/UI integration

The UI can call the documented `/api/v1` HTTP contract after choosing its auth token/session integration. Coordinate the issuer, audience, CORS origins, and error schema before wiring the Figma UI. Keep browser assets under the future `website/` tree; do not place UI code in this backend. OpenAPI is generated from Fastify route schemas, with docs disabled in production by default.

## CI and delivery

`.github/workflows/backend-ci.yml` is scoped to backend changes, uses read-only permissions and cancellation, runs dependency audit, lint/format/type checks, tests/coverage, PostgreSQL integration tests, secret scanning, and a production image build. It does not deploy. The existing `notify-guardian.yml` was left unchanged; its current wildcard completed-workflow filter will also observe failures from this CI workflow. No deployment workflow is active; configure environment approvals, identity, networking, secret management, and manual promotion in a separate deployment design.

## Implemented vs. unverified

Implemented: modular server/API/auth boundaries, provider contracts, bounded PostgreSQL pool, operational schema/migration, tenant-scoped repository example, transactional idempotency, separate pg-boss worker, local compose, production multi-stage non-root image, and deterministic unit/API tests.

Not verified or provided: cloud provisioning; provider credentials; real workload sizing; Mac storage quota; backup restoration; failover/failback; production OIDC configuration; storage capacity probing; production deployment approvals; and operational response under real traffic. The presence of scaffolding is not evidence of production readiness.

See [the operations notes](docs/README.md) for deployment, threat model, backup/restore, incident/rollback, contributor, and roadmap guidance.
