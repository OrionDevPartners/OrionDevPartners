# Incident and rollback guidance

This is a template, not an exercised incident plan. Assign owners and rehearse it before launch.

## Triage

1. Declare incident severity and name an incident lead.
2. Check liveness/readiness, release identifier, PostgreSQL and queue availability, dependency health, rate-limit behavior, and recent deployment/configuration changes.
3. Preserve relevant redacted logs and audit events. Do not copy access tokens, provider content, database URLs, or secret values into incident channels.
4. If sensitive data may have reached an unintended provider or tenant, disable the affected integration, contain access, and follow the organization's notification process.
5. Inspect failed/dead-letter jobs with approved access. Redrive only after confirming handler idempotency and payload safety.

## Rollback

- Prefer an approved prior immutable image and compatible configuration. Keep database changes backward-compatible where possible.
- Do not automatically reverse migrations that delete or transform data. Apply a reviewed forward fix or a separately rehearsed restore.
- Stop or scale down workers separately from the API when queued work could be unsafe. Preserve the queue until replay consequences are understood.
- Verify health/readiness and tenant isolation after rollback, then communicate the remaining impact and follow-up actions.

No rollback, restore, failover, or live incident process has been tested by this repository.
