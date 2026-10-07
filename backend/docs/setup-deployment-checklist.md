# Setup and deployment checklist

## Before deployment

- [ ] Select a supported Node 24 runtime and PostgreSQL version; provision them in an approved environment.
- [ ] Configure an OIDC issuer, audience, and JWKS URL; test token expiration, audience, and key rotation.
- [ ] Configure exact CORS origins, ingress TLS, trusted proxy behavior, request limits, rate limits, connection limits, and timeouts.
- [ ] Inject production secrets through a managed secret source or mounted files. Do not use compose's local `trust` authentication.
- [ ] Provision durable database/object storage with explicit capacity quotas and admission controls. Keep persistent state outside container overlay storage.
- [ ] Configure deployment-level storage quota/admission controls. Application limits are not filesystem quota enforcement.
- [ ] Establish least-privilege database roles, TLS policy, network policy, and approved administrative access.
- [ ] Define backup retention, encryption, restore objectives, restore runbooks, and an independently recorded restore test.
- [ ] Define monitoring/alerting, on-call ownership, incident escalation, dead-letter queue review, and redrive approvals.
- [ ] Size API and worker instances through representative load tests; define autoscaling and database pool budgets.
- [ ] Configure protected manual deployment approvals, rollback targets, and release provenance.
- [ ] Review the actual threat model and API contract with the incoming UI before enabling browser access.

## Local-only setup

Run `docker compose up --build` from `backend/`. The compose file binds ports on loopback, rotates logs, stores database state in a named volume, and uses PostgreSQL trust auth solely for its isolated local network. Its OIDC URL is deliberately invalid. Do not use these settings in staging or production.

## Verification status

This repository supplies a Docker build and CI checks. It does not provision a cloud environment, measure application load, assert provider credentials, enforce the Mac 500 GB requirement, or prove backup restoration/failover/failback.
