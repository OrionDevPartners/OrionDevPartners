# Backup and restore expectations

The repository has no backup automation or tested restore evidence. PostgreSQL and object-store backups must be designed and operated by the deployment owner.

Before production:

1. Define recovery point/time objectives, retention, encryption, key custody, and regional requirements.
2. Use provider-supported consistent PostgreSQL backups/WAL archiving and version object-store data or capture its retention strategy.
3. Store backups outside the primary failure domain and restrict access to a dedicated least-privilege role.
4. Document restore order for database schema/data, object content, secrets/configuration, and worker queues.
5. Restore into an isolated environment and verify schema version, representative tenant-scoped reads, object checksums, and application startup.
6. Record evidence, duration, gaps, and the next test date; repeat periodically and after material schema/storage changes.

Do not describe a configured backup as a tested restore. No backup, restore, failover, or failback has been performed by this scaffolding.
