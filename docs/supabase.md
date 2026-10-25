# Supabase operating guide

Mayaana uses Supabase Auth and Postgres for authenticated clinic data. This document describes safe repository usage; it does not authorize production changes.

## Responsibilities

- Supabase Auth owns user identity, password authentication, and sessions.
- Postgres stores clinic, staff, patient, queue, visit, measurement, note, diet, and related clinical state as defined by current migrations.
- RLS and server-side authorization enforce clinic and role boundaries.
- Browser-local demo state is separate from authenticated Supabase data.

See [database.md](database.md) for the current schema and provisioning notes.

## Environment separation

Keep these concerns separate:

- local development
- disposable isolated test stacks
- hosted development/preview environments
- production

Clinical Auth/RLS/database tests should use the repository's disposable/local test tooling. Do not substitute production credentials when local infrastructure is unavailable.

## Migrations

- Historical migrations are immutable.
- Never rename, edit, rewrite, or repair old migration history during routine application work or refactors.
- Add new database behavior through a new migration.
- Treat schema, RLS, grants, RPCs, constraints, and transactional behavior as externally observable contracts.

## RLS and authorization

- RLS is part of the security boundary, not an optional UI safeguard.
- Client code must not bypass RLS.
- Server actions must preserve verified session/staff/clinic/role checks.
- Doctor-private notes and diet isolation must remain intact.
- Layout or route guards do not replace mutation authorization.

## Refactoring constraints

Behavior-preserving refactors must preserve:

- authentication and role routing
- clinic isolation
- RLS behavior
- RPC contracts
- revisions/concurrency behavior
- retry identities
- transactional semantics
- current URLs
- failed-draft retention and explicit discard behavior

The detailed dependency and ownership rules live in [architecture/module-ownership.md](architecture/module-ownership.md).

## Production changes

Production schema, RLS, Auth, RPC, data, or environment changes require explicit owner approval. Documentation work and refactoring analysis do not imply permission to deploy migrations or mutate hosted data.
