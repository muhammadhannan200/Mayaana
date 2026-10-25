# ADR-0003: Authorization is enforced server/database-side

Status: Accepted
Date: 2026-10-25

## Context

Mayaana stores clinic, staff and clinical records behind Supabase. Route guards
and hidden UI controls improve navigation, but a browser can call APIs directly
and a layout guard does not authorize a mutation. Clinical data also has
role-specific confidentiality: doctor-private notes and diet plans must not be
readable by secretaries.

## Decision

- UI visibility is not authorization. Hiding a screen, button or field does not
  grant or deny access.
- Authenticated clinical operations require verified identity, an active staff
  record, clinic scope and the required role.
- Supabase RLS and server-side checks form the security boundary. Server actions
  and the server-only clinical module revalidate the session and staff record;
  database policies and mutation functions enforce the same scope.
- Authenticated clients receive read access through RLS and do not receive
  direct table INSERT/UPDATE/DELETE grants for clinical records. Mutations go
  through the existing authorized RPC/server-action paths.
- Doctor-private notes and diet plans remain Doctor-only. Secretary reads exclude
  them; they are not merely hidden in the UI.
- Layout checks, client flags and user-editable Auth metadata are never treated
  as authorization sources.

## Consequences

- New reads and mutations must carry the same identity, clinic and role checks;
  adding a screen is not sufficient.
- Authorization must be verified server/database-side even when the UI already
  prevents an action.
- Direct-API and cross-clinic denial cases belong in database/security tests.
- Privileged server credentials must remain server-only and must never be used
  in the browser.
- Changes to RLS, grants or RPC contracts require security review, not only UI
  review.

## References

- [Clinical persistence](../clinical-persistence.md) — RLS coverage, role
  checks, grant model, doctor-only notes/diet and mutation authorization.
- [Database](../database.md) — staff directory access control and the rule that
  editable metadata is not an authorization source.
- [Module ownership](../architecture/module-ownership.md) — server-only rules,
  preserved auth/RLS contracts and the statement that layout checks do not
  replace mutation authorization.
- [Login flow](../login-flow.md) — verified Auth identity plus
  administrator-managed staff role and activation checks.
- `app/clinical-actions.ts`, `lib/clinical.ts`, `lib/auth.ts`, `proxy.ts`
- `supabase/migrations/20261023162459_clinical_foundation.sql`
