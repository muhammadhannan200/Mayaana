# Security rules

This file records repository-specific security constraints. It does not replace Supabase RLS policies, server authorization, or application validation.

## Secrets and environment values

- Never commit secrets, passwords, private tokens, or local environment files.
- `.env.local` remains local.
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are browser-visible connection values.
- `SUPABASE_SECRET_KEY` is server-only. Never expose it to client code and never rename it with a `NEXT_PUBLIC_` prefix.
- Do not print sensitive credentials or clinical data into logs, screenshots, PR descriptions, or test artifacts.

See [.env.example](../.env.example) and [login-flow.md](login-flow.md).

## Authorization boundary

- UI visibility is not authorization.
- Protected clinical operations require verified identity and valid staff/clinic/role checks.
- Supabase RLS and server-side checks are part of the application security boundary.
- Never bypass RLS from browser code.
- Never treat editable user metadata as an authorization source.
- Doctor-private notes and diet data must remain isolated to Doctors.

The current ownership rules are documented in [architecture/module-ownership.md](architecture/module-ownership.md).

## Privileged access

- Privileged/admin Supabase clients must remain narrowly scoped and server-only.
- Use privileged access only for operations that explicitly require it.
- Do not move service-level credentials into shared UI, client components, browser bundles, or public environment variables.

## Testing and production safety

- Automated tests must use the repository's disposable/local test workflows where required.
- Never point destructive database, Auth, RLS, or clinical tests at production.
- Do not modify production data, production environment variables, or security policies without explicit owner approval.
- Do not weaken tests, RLS, authorization, schema constraints, or validation simply to make CI pass.

For database access-control details, see [database.md](database.md) and [supabase.md](supabase.md).
