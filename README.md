# Mayaana

Arabic RTL clinic-management web app built with Next.js and Supabase.

## Stack

- Next.js 16
- React 19
- TypeScript
- Supabase Auth + Postgres
- Tailwind CSS
- Playwright + axe for UI auditing
- Vercel deployment

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Create a local `.env.local` from `.env.example` and provide the required development Supabase values. Never commit secrets.

## Quality checks

```bash
npm run typecheck
npm run lint
npm run build
npm run audit:ui
```

## Project structure

- `app/` — Next.js routes, screens, server actions, and global styles
- `lib/` — application helpers and Supabase clients
- `supabase/migrations/` — database migration history
- `tests/` — automated tests
- `scripts/` — repository tooling
- `docs/` — product, design, database, authentication, and UI documentation
- `.agents/skills/` — project-local AI development workflows

## Documentation

Start with:

- [Product overview](docs/product-overview.md)
- [Figma structure](docs/figma-structure.md)
- [Design system](docs/design-system.md)
- [Login flow](docs/login-flow.md)
- [Database](docs/database.md)
- [UI patterns](docs/ui-patterns.md)
- [UI audit](docs/ui-audit.md)
- [Architecture ownership and foundation tickets](docs/architecture/module-ownership.md)

## Git workflow

Meaningful work is done on a dedicated branch and submitted to `master` through a pull request. Validation and review happen before merge; merging remains a human action.
