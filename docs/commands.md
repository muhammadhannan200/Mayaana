# Commands

Real commands defined in `package.json` and the repository test runners. Run
them from the repository root. Do not invent equivalents, and do not report a
command as passing unless it actually ran in this checkout.

## Prerequisites

| Tool                | Needed for                                                                |
| ------------------- | ------------------------------------------------------------------------- |
| Node.js 24          | CI and all `test:*` / `audit:ui` runners                                  |
| Docker              | `test:auth`, `test:persistence`, `test:clinical`, `test:clinical:browser` |
| Supabase CLI 2.81.3 | The same isolated database/browser suites                                 |
| Playwright Chromium | `audit:ui:browser`, `test:clinical:browser`                               |

Install browser support with `npx playwright install chromium --only-shell`.
Do not run database or browser suites that need Docker/Supabase when those
tools are unavailable, and do not substitute hosted credentials to make them
run.

## Core commands

| Command                         | Purpose                                                      | Cost           | When to run                                                                   |
| ------------------------------- | ------------------------------------------------------------ | -------------- | ----------------------------------------------------------------------------- |
| `npm ci`                        | Clean install from `package-lock.json`                       | Moderate       | First checkout, lockfile change, CI. Prefer over `npm install` for exact deps |
| `npm run dev`                   | Next.js development server on `http://localhost:3000`        | Cheap          | Day-to-day work; needs `.env.local` for authenticated flows                   |
| `npm run typecheck`             | `tsc --noEmit`                                               | Cheap          | After any TypeScript change; before every commit                              |
| `npm run lint`                  | ESLint over the repository                                   | Cheap          | After any code change; before every commit                                    |
| `npm run build`                 | Production `next build`                                      | Expensive      | Routing, server/client boundary, environment or dependency changes; before PR |
| `npm run test:auth`             | Isolated Auth E2E against a disposable local Supabase stack  | Expensive      | Sign-in, session, password, `proxy.ts` or staff-membership changes; before PR |
| `npm run test:persistence`      | Slice 1 SQL contracts and authenticated persistence journeys | Expensive      | Patient/queue/measurement/handoff persistence changes; before PR              |
| `npm run test:clinical`         | Database, RLS, grant and RPC lifecycle contracts             | Expensive      | Any migration, policy, function or grant change; before PR                    |
| `npm run test:clinical:browser` | Authenticated two-session clinical browser journeys          | Very expensive | Authenticated clinical screen or flow changes; before PR                      |
| `npm run audit:ui`              | Static UI inventory plus public Playwright/axe audit         | Expensive      | Public UI, styles, RTL or accessibility changes; before PR                    |

Related scripts that already exist and are worth knowing:

- `npm run audit:ui:static` — `lint` plus the CSS/style inventory; report-only
  findings do not fail.
- `npm run audit:ui:browser` — Playwright public UI audit only. Accepts focused
  spec arguments, for example
  `npm run audit:ui:browser -- tests/ui-audit/architecture-foundation.spec.ts`.
- `npm run start` — serve an existing production build; this does not rebuild.

## Scope-aware validation

Start narrow, then widen only when the change can affect more surface. The
expensive suites are for scopes that actually touch them, not for every edit.

| Change scope                               | Minimum local checks                                            | Widen to before PR                                           |
| ------------------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------ |
| Documentation only                         | Read the rendered diff; run Prettier on changed Markdown        | No test suite is required unless the repository rule says so |
| Wording, labels, or comments               | `npm run lint`, `npm run typecheck`                             | Focused `audit:ui:browser` spec when user-visible copy moves |
| Component, CSS, RTL, accessibility         | `npm run lint`, `npm run typecheck`, focused `audit:ui:browser` | `npm run audit:ui`                                           |
| Routing, layouts, server/client boundaries | `npm run typecheck`, `npm run lint`, `npm run build`            | The suite covering the affected flow                         |
| Auth, sessions, password, `proxy.ts`       | `npm run typecheck`, `npm run lint`, `npm run test:auth`        | `npm run test:clinical:browser` if authenticated entry moved |
| SQL, migrations, RLS, grants, RPCs         | `npm run test:clinical`                                         | `npm run test:persistence` for Slice 1 contracts; `build`    |
| Authenticated clinical screens or flows    | `npm run test:clinical:browser`                                 | `npm run audit:ui` if public UI also changed                 |
| Dependency or configuration change         | `npm ci`, `npm run typecheck`, `npm run lint`, `npm run build`  | Relevant suites; dependency security check in CI             |

Rules of thumb:

- Do not run `test:clinical:browser` after a wording-only edit.
- Do not claim a Docker-dependent result from a machine without Docker; use the
  dedicated CI job and report its actual outcome.
- Existing failures are diagnostics, not permission to weaken assertions. See
  [architecture foundation validation](architecture/foundation-validation.md)
  for known status-code, title and development-dependency findings.
- A pre-commit hook runs `lint-staged` (ESLint/Prettier) and `npm run typecheck`.


### Fresh worktree type generation

A clean Next.js worktree can lack generated route types. If `npm run typecheck`
fails specifically because Next.js-generated types are absent, generate them
before repeating the same check:

```bash
npx next typegen
npm run typecheck
```

Do not weaken TypeScript checks or commit generated build artifacts to bypass
this prerequisite.

## Where each suite is explained

- [UI audit](ui-audit.md) — public browser audit, fixtures and artifacts.
- [Isolated Auth E2E](auth-e2e.md) — disposable Auth stack and coverage.
- [Clinical persistence — Slice 1](persistence-slice-1.md) — persistence runner
  contracts and deployment gate.
- [Clinical persistence foundation](clinical-persistence.md) — database/RLS
  suite, RPC and browser-journey coverage.
- [Architecture ownership](architecture/module-ownership.md) — characterization
  commands and their prerequisites.

CI workflows under `.github/workflows/` call these same scripts. Reuse their
results instead of triggering duplicate runs when equivalent evidence already
exists.
