# Security rules

Operating rules for changes in this repository. The vulnerability-reporting
process and supported versions live in [SECURITY.md](../SECURITY.md); this page
covers everyday engineering boundaries.

## Secrets and configuration

- **Never commit secrets.** `.env.local`, private keys, tokens, database
  passwords and service credentials stay local and out of Git.
- Use [`.env.example`](../.env.example) as the shape of required configuration,
  never as proof that an environment is configured.
- `NEXT_PUBLIC_*` values are public connection details. They must not contain a
  secret.
- **Server-only credentials must never reach browser code.** In particular,
  `SUPABASE_SECRET_KEY` is server-only and must never be renamed with a
  `NEXT_PUBLIC_` prefix, logged, bundled or returned to the client. See
  [login flow — setup](login-flow.md).
- Keep environment values environment-specific. Do not copy production
  credentials into local, preview or test environments. See
  [Vercel usage](vercel-usage.md).

## Authorization

- **Respect Supabase RLS and role authorization.** RLS plus the verified
  `clinic_staff` record is the application's data boundary; see
  [database](database.md) and [clinical persistence — authorization](clinical-persistence.md).
- **UI visibility is not authorization.** Hiding a button or route is a UX
  decision; server actions, layouts and policies must still deny the action.
- **Do not bypass RLS from client code**, and do not add direct table writes to
  work around a policy. Use the existing validated server actions and RPCs.
- **Privileged/admin Supabase clients must remain narrowly scoped.** The
  service-role client exists for specific server-side account operations, not
  for general reads, clinical writes or convenience bypasses.
- Notes and diet plans are Doctor-private. Secretary reads must exclude them at
  the query/policy level, not merely in rendered UI.

## Data-changing operations

- **Never run destructive or production-data-changing operations without
  explicit owner approval.** This includes `db push`, migration repair, table
  drops, data backfills, bulk updates and production writes.
- **Automated tests must not target production.** Use the repository's
  disposable local Supabase stacks. Do not point Auth, persistence, clinical or
  UI-audit runs at a hosted production project. See [commands](commands.md) and
  [Supabase usage](supabase.md).
- Use synthetic fixtures only. Do not copy real patient records into demos,
  tests, screenshots, issues or artifacts.
- **Do not weaken tests, RLS, authorization or validation to make a change
  pass.** Fix the cause, or report the blocker and missing evidence.

## Handling clinical information

- Avoid logging sensitive clinical information: names, phone numbers, notes,
  diet plans, measurements tied to an identifiable person, tokens or session
  values.
- Keep test artifacts synthetic. Follow the retention notes in
  [Persistent Slice 1](persistence-slice-1.md) and
  [clinical persistence](clinical-persistence.md); do not upload environment
  files or raw Supabase status output.
- Do not import demo fixtures into clinical tables or treat `/demo` data as
  real.

## Reporting

Report suspected vulnerabilities privately as described in
[SECURITY.md](../SECURITY.md). Do not open a public issue with exploit details
or real clinic data.
