# Phased roadmap

1. **Foundation (implemented here):** typed Fastify app, OIDC identity boundary, PostgreSQL core schema/repository/idempotency, provider contracts, storage admission interface, isolated jobs, tests, and CI.
2. **UI contract integration:** agree on OIDC session/token exchange, CORS origins, route schemas, error shapes, and generated OpenAPI with the incoming Figma UI; add only required API behavior.
3. **Operational providers:** choose vendors through review; implement adapters, mounted-secret provisioning, explicit data-classification policy, and contract tests. No vendor or fallback is selected here.
4. **Infrastructure and resilience:** provision reviewed cloud networking, quotas/admission, deployment approvals, telemetry, backups, and restore/failover exercises.
5. **Workload readiness:** run representative load, security, failure-injection, and recovery tests; size API/worker/database and record measured limits before making readiness claims.

Cloud provisioning, quota enforcement, backup restoration, failover/failback, provider credentials, and workload sizing remain unverified.
