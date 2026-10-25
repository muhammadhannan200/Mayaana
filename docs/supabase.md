# Supabase usage

Operational guide for Supabase in this repository. Schema and authorization
detail lives in [database](database.md),
[clinical persistence foundation](clinical-persistence.md) and
[Slice 1](persistence-slice-1.md); this page is about how to work with it
safely.

## What Supabase owns

- **Supabase Auth** owns login identity, passwords and sessions. There is no
  public sign-up; accounts are provisioned by an administrator. See
  [login flow](login-flow.md).
- **Supabase Postgres** owns clinic, staff, patient, queue, visit, measurement,
  note, diet and appointment data. RLS and database-managed staff records are
  part of the application's authorization boundary.
- The app uses a session-scoped server client
  (`lib/supabase/server.ts`) and a narrowly scoped privileged client
  (`lib/supabase/admin.ts`) for specific account operations. Client components
  never receive server credentials. See [security](security.md).

Configuration is read from `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and the server-only
`SUPABASE_SECRET_KEY`. Do not add or rename variables as part of unrelated
work.

## Environments

| Environment                | Use                                                                                       |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| Disposable local stack     | Tests and CI. Created and destroyed by the repository runners; synthetic identities only  |
| Hosted development project | Shared development verification with approved configuration                               |
| Hosted production project  | Live clinic data. Changes require explicit owner approval and an operator release process |

- Never point automated tests or local scripts at a hosted project, and never
  substitute hosted credentials for an isolated test stack.
- Never run `db push`, migration repair or data-changing SQL from a feature
  branch.
- Do not use production records as fixtures, in screenshots, or in issue/PR
  evidence.

## Migrations

- **Historical migrations are immutable.** Applied files are kept byte-for-byte
  identical; do not rename, reorder, edit or "repair" them during application
  refactoring.
- **New schema behavior requires a new migration.** Generate it with the Supabase
  CLI (`supabase migration new <name>`) and review the committed SQL.
- Adding a migration file does not deploy it. Hosted application is a separate
  reviewed operator step with backup, replay/upgrade checks, grant/RLS review and
  a staging smoke test. See [Slice 1 — deployment gate](persistence-slice-1.md)
  and [clinical persistence](clinical-persistence.md).
- If remote history and the repository disagree, stop and report the drift.
  Do not conceal it with migration repair.

## RLS, roles and contracts

- Every clinical read requires an active, same-clinic `clinic_staff` row with
  password setup complete. Anonymous and cross-clinic access is denied.
- Secretary reads exclude Doctor-private notes and diet; those tables require
  the Doctor role. UI hiding alone is not sufficient.
- Authenticated users receive read access and call narrow RPCs; there are no
  direct table write grants. Do not add client-side writes or widen grants to
  make a flow work.
- **Preserve RPC contracts, revision behavior, retry identities and
  transactional behavior during refactors.** Queue revision is the concurrency
  token; lifecycle conflicts surface as `PT409`/HTTP 409; caller-generated UUIDs
  make retries safe. These are behavioral contracts, not implementation detail.

## Validation

Database/RLS work is validated against a disposable local stack, never a hosted
project:

```bash
npm run test:clinical
npm run test:persistence
```

Authenticated browser behavior uses `npm run test:clinical:browser`; Auth and
session behavior uses `npm run test:auth`. All require Node 24, Docker and
Supabase CLI 2.81.3. See [commands](commands.md) for cost and scope.

Tests must fail when authorization regresses. Do not add test-only production
switches, bypasses or weakened assertions; test-only fault injectors stay inside
the runner.

## Changing Supabase itself

Configuration, policies, functions, grants and production data are outside the
scope of documentation and ordinary application refactors. A change there needs
a dedicated, approved task and the operator checks above.
