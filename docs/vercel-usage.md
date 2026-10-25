# Vercel usage

Operational guidance for deployments. Project settings, domains and
environment variables are owner-managed; this page does not authorize changes
to them.

## How the project uses Vercel

Mayaana is a Next.js application deployed through Vercel. Treat the three
environments conceptually:

| Environment | Meaning here                                                             |
| ----------- | ------------------------------------------------------------------------ |
| Development | Local `npm run dev` against local configuration; not a Vercel deployment |
| Preview     | Per-branch/per-PR deployment used to validate a change before merge      |
| Production  | The live deployment serving real clinics                                 |

Exact branch/domain/runtime settings are not documented here. The
[production-readiness audit](production-readiness-audit.md) records them as an
evidence gate (P0-06) where unverified — do not assume a setting exists because
the README mentions Vercel.

## Working rules

- **Prefer Preview deployments for branch/PR validation** when hosted validation
  is actually needed. Local validation is cheaper and usually sufficient; see
  [commands](commands.md).
- **Production deployment and configuration changes require explicit owner
  approval.** This includes promoting a build, changing build settings,
  environment variables, domains, redirects, caching or integrations.
- **Reuse existing CI and Preview evidence.** Do not trigger a redundant
  deployment when the same commit already has a successful check or Preview
  result that answers the question.
- Do not deploy to "check" a documentation-only or local-only change.
- Do not promote a Preview build that was created before a schema/configuration
  change it depends on.

## Secrets and environment variables

- Store secrets in Vercel's environment settings, never in the repository,
  build output, logs or client bundles.
- Keep values environment-specific. Preview and Development must not receive
  production credentials; production values are only for the production
  environment.
- `NEXT_PUBLIC_*` values are public at build time. `SUPABASE_SECRET_KEY` is
  server-only and must never be exposed to the browser, logged, or prefixed with
  `NEXT_PUBLIC_`.
- `.env.local` stays local and ignored. See [`.env.example`](../.env.example)
  and [security](security.md).
- Do not print environment values while diagnosing a deployment; report which
  variable is missing, not its value.

## Deployment and database sequencing

Deploying the application does not apply migrations. Supabase changes follow
the reviewed operator process in [Supabase usage](supabase.md); keep the
previous application available for rollback and never drop clinical tables or
data as an application rollback strategy.

## Changing Vercel itself

Project creation, production promotion, environment-variable edits, domain
changes and deployment protection are owner actions. If a task appears to
require them, stop and ask for explicit approval rather than changing settings
or triggering a production deployment.
