# ADR-0002: Supabase migration history is immutable

Status: Accepted
Date: 2026-10-25

## Context

Supabase migration files are the reproducible history of the database schema,
policies, grants, functions and constraints. Existing environments have already
applied some of these versions. Renaming, rewriting or repairing historical
migrations makes fresh databases and upgraded databases diverge, and it hides
schema drift instead of resolving it.

## Decision

- Existing historical migrations are not renamed, rewritten, repaired or edited
  as part of normal application work.
- New database changes require new, additive migrations.
- Schema reconciliation is handled explicitly against the verified applied
  history; it is not achieved by changing an already-applied migration file.
- Migration deployment remains a separate reviewed operation. Application work
  does not apply migrations to a hosted project as a side effect.

## Consequences

- Every schema change adds a new migration rather than mutating history.
- Clean replay and upgrade paths can both be tested from the same files.
- A correction to an earlier migration must be expressed as a forward
  migration.
- Migration drift and deployment order need explicit operator review.
- Historical migration content, versions and filenames must be preserved in
  reviews.

## References

- [Database](../database.md) — verified applied history and the additive
  persistence migration.
- [Clinical persistence](../clinical-persistence.md) — byte-for-byte migration
  history, additive feature migration and the deployment boundary.
- [Persistence Slice 1](../persistence-slice-1.md) — history reconciliation,
  additive migration and "do not repair" deployment gate.
- [Module ownership](../architecture/module-ownership.md) — immutable SQL
  history as an ownership and dependency rule.
- `supabase/migrations/`
