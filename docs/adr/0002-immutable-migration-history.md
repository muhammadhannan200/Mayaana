# ADR-0002: Keep historical Supabase migration history immutable

Status: Accepted  
Date: 2026-10-25

## Context

Mayaana relies on checked-in Supabase migrations to reproduce database history across local, test, and hosted environments. Rewriting or renaming already-established migration history can make environments disagree about what has been applied.

## Decision

- Historical migrations are immutable.
- Do not rename, rewrite, reorder, repair, or delete old migrations as part of routine application or refactor work.
- New schema, RLS, grant, RPC, or database behavior must be introduced through a new additive migration.

## Consequences

- Database history remains reproducible and auditable.
- Refactors cannot silently alter deployed schema history.
- Database changes require explicit migration review and environment-aware validation.

## References

- [Database](../database.md)
- [Architecture ownership](../architecture/module-ownership.md)
