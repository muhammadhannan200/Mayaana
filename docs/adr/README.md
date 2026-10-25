# Architecture Decision Records

## What is an ADR?

An Architecture Decision Record (ADR) is a short, durable note describing a
significant technical decision, the context that required it, and the
consequences that follow. Each ADR captures one decision at a point in time.

## Why Mayaana uses ADRs

Mayaana's clinical, authentication and persistence work spans application code,
Supabase migrations, RLS policies and operational procedures. Several important
decisions are easy to break accidentally because they are spread across those
layers. ADRs give contributors and agents a stable place to check:

- which constraints are intentional;
- why the project chose them;
- where to verify them in the repository.

ADRs record significant decisions and their reasoning. They **do not replace**
implementation documentation, API references, database docs or tests. Those
remain the source of truth for current behavior.

## Changing a decision

Accepted ADRs are historical records. Do not silently rewrite an accepted ADR
when a decision changes. Instead, create a new ADR that supersedes it and update
the old ADR's `Status` to `Superseded` with a link to its replacement. This keeps
the reasoning trail intact.

Suggested statuses:

- **Proposed** — under discussion; not yet binding.
- **Accepted** — the current decision.
- **Superseded** — replaced by a later ADR.
- **Deprecated** — no longer recommended, but not directly replaced.

ADR numbers are stable. Gaps are intentional and are not reused.

## Template

```md
# ADR-XXXX: Decision title

Status: Accepted
Date: YYYY-MM-DD

## Context

## Decision

## Consequences

## References
```

## Index

- [ADR-0001: Demo data remains browser-local and fictional](0001-demo-data-separation.md)
- [ADR-0002: Supabase migration history is immutable](0002-immutable-migration-history.md)
- [ADR-0003: Authorization is enforced server/database-side](0003-server-side-authorization.md)
- [ADR-0005: Use `proxy.ts` instead of recreating `middleware.ts`](0005-nextjs-proxy-convention.md)

ADR-0004 is intentionally unassigned. A candidate decision about a single
active doctor-patient state was not adopted because current queue and handoff
behavior support more than one `with_doctor` entry.
