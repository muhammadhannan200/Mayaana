# Mayaana / Rashaqa clinic

An Arabic, right-to-left clinic web app built with Next.js. The current app provides email/password sign-in and guarded doctor and secretary destinations; broader patient and clinic workflows are documented as product references, not implemented routes.

## Repository map

| Path                   | Responsibility                                                            |
| ---------------------- | ------------------------------------------------------------------------- |
| `app/`                 | Next.js pages, actions and UI                                             |
| `lib/`                 | Application helpers and server-side Supabase clients                      |
| `public/`              | Static assets                                                             |
| `supabase/migrations/` | Versioned clinic database migrations                                      |
| `tests/`               | UI audit tests                                                            |
| `docs/`                | Product, auth, database, audit and agent workflow documentation           |
| `.agents/skills/`      | Project-local agent skills (`skills-lock.json` records installed sources) |
| `.github/`             | GitHub automation and CI                                                  |

## Documentation

- [Clinic vocabulary](GLOSSARY.md)
- [Product overview](docs/product/overview.md), [Figma screen index](docs/product/figma-structure.md), [observed design system](docs/product/design-system.md) and [UI patterns](docs/product/ui-patterns.md)
- [Clinic sign-in decisions and setup](docs/auth/login-flow.md)
- [Clinic staff database and provisioning](docs/database.md)
- [Deterministic UI audit](docs/ui-audit.md)
- [Agent issue tracker](docs/agents/issue-tracker.md), [domain docs](docs/agents/domain.md) and [triage labels](docs/agents/triage-labels.md)

## Local development

Use Node.js 24 and `npm ci`. Copy the variable names in [`.env.example`](.env.example) to a local `.env.local` and supply values for your environment; never commit local credentials. Start the app with `npm run dev` and open <http://localhost:3000>.

Run `npx next typegen`, `npm run typecheck`, `npm run lint`, and `npm run build` to check the app. UI audit commands and browser setup are in [docs/ui-audit.md](docs/ui-audit.md). Git workflow and PR rules are in [AGENTS.md](AGENTS.md).
