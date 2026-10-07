# Security and threat model

## Boundaries and assets

The backend accepts HTTP requests and OIDC access tokens, queries tenant-scoped PostgreSQL records, and will eventually hand work to provider adapters and workers. Protected assets include identity claims, tenant data, provider inputs, stored objects, idempotency results, and mounted secrets.

## Threats and controls in this foundation

- **Forged, expired, or misdirected tokens:** OIDC JWT verification requires configured issuer/audience/JWKS and restricts signing algorithms; missing/malformed tokens are rejected. Test fakes exist only under tests.
- **Cross-tenant access:** authorization is an explicit policy interface; tenant identifiers scope repository reads/writes. Product routes must check membership/role before repository access and must not trust tenant claims alone.
- **Sensitive logging/error disclosure:** authorization/cookie/API-key and common body secret fields are redacted; production errors use generic messages and safe error names. Do not log provider payloads or raw DB errors.
- **Abuse and resource exhaustion:** rate limits, bounded request/URL/upload settings, server deadlines, and a bounded DB pool are provided. Configure complementary ingress, worker, and provider quotas.
- **Duplicate consequential commands:** the PostgreSQL idempotency helper locks the tenant/key, compares canonical request hashes, and persists completed responses inside a transaction.
- **Storage exhaustion:** admission fails closed when capacity is unknown; no disk probe/quota implementation is present. Use deployment-level quota and admission controls.
- **Provider leakage/retry:** provider contracts normalize failures and contain no implicit fallback. Sensitive payloads must not be resent to other providers without an explicit, authorized policy.
- **Queue replay/failure:** keep handlers idempotent, bounded, and free of secret payload logs. The example queue retries and sends exhausted jobs to a dead-letter queue.

## Operational gaps

No production identity tenant-policy implementation, database row-level-security policy, provider implementation, object storage capacity probe, secret manager, WAF, quota controller, cloud network, backup job, or incident telemetry is provisioned here. Review these gaps before exposure to real users. Enforce database tenant scoping consistently and consider defense-in-depth RLS after defining transaction-scoped tenant context.
