# ADR-0003: Enforce clinical authorization at server and database boundaries

Status: Accepted  
Date: 2026-10-25

## Context

Mayaana has authenticated Doctor and Secretary roles, clinic-scoped data, and Doctor-private clinical information. Hiding UI controls is not sufficient authorization because requests can bypass presentation code.

The repository already uses server-side account checks, Supabase RLS, server-only clients, and role/clinic validation.

## Decision

- UI visibility is never the authorization boundary.
- Authenticated clinical operations must preserve verified identity, staff, clinic, and role checks.
- Supabase RLS remains part of the security boundary.
- Privileged Supabase access remains server-only and narrowly scoped.
- Doctor-private notes and diet data remain Doctor-only.
- Route/layout guards do not replace mutation authorization.

## Consequences

- Refactors and new UI must preserve backend/database authorization independently of presentation.
- Client code must not bypass RLS or trust editable metadata as authorization.
- Security-sensitive changes require focused Auth/RLS/clinical validation.

## References

- [Database](../database.md)
- [Login flow](../login-flow.md)
- [Architecture ownership](../architecture/module-ownership.md)
- `lib/auth.ts`
- `lib/supabase/admin.ts`
