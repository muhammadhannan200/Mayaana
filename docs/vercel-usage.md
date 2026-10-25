# Vercel usage

Mayaana is deployed through Vercel. Use Vercel as deployment infrastructure, not as a substitute for local validation.

## Environments

Treat Vercel environments separately:

- Development/local work happens on the developer machine.
- Preview deployments are appropriate for branch/PR validation when a deployed environment is useful.
- Production is the live environment and requires explicit owner approval for configuration or deployment-impacting changes.

## Validation strategy

- Prefer local typecheck, lint, focused tests, and build checks before relying on a deployment.
- Reuse existing CI and Preview evidence where it is sufficient.
- Avoid triggering redundant deployments for documentation-only or purely local work unless repository automation does so automatically.

## Environment variables

Environment variables must stay environment-specific.

Current repository examples include:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` (server-only)

Never expose server-only secrets in browser code, build logs, repository files, or public PR content.

## Production safety

Do not change production environment variables, domains, deployment settings, aliases, or production data without explicit owner approval.

A successful Preview or Production build does not replace application-level Auth, RLS, database, or browser validation where those checks are relevant.
