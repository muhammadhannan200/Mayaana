# Project commands

This document explains the repository commands that developers and agents are expected to use. Prefer the narrowest useful validation first, then expand coverage before a pull request is considered complete.

## Install and local development

```bash
npm ci
npm run dev
```

- `npm ci` installs exactly from the lockfile and is preferred for clean worktrees and CI-style setup.
- `npm run dev` starts the Next.js development server.

In a fresh worktree, Next.js generated types may not exist yet. If `npm run typecheck` fails only because framework-generated types are missing, run:

```bash
npx next typegen
npm run typecheck
```

Do not treat generated framework output as source files that should be committed unless the repository explicitly changes that policy.

## Core quality checks

```bash
npm run typecheck
npm run lint
npm run build
```

- `typecheck` runs TypeScript without emitting files.
- `lint` runs ESLint.
- `build` performs the production Next.js build and is broader and more expensive than the first two checks.

There is no generic `npm test` script in this repository.

## Focused test suites

```bash
npm run test:auth
npm run test:persistence
npm run test:clinical
npm run test:clinical:browser
npm run audit:ui
```

Use them by scope:

- Auth/session/role routing changes → `npm run test:auth`.
- Persistence contract or Slice 1 behavior → `npm run test:persistence`.
- Clinical database, RLS, RPC, lifecycle, or authorization changes → `npm run test:clinical`.
- Authenticated clinical browser journeys → `npm run test:clinical:browser`.
- UI accessibility, RTL, responsive, and style audit changes → `npm run audit:ui`.

Some clinical suites require Node 24, Docker, the pinned Supabase CLI, and a disposable local test stack. Do not replace isolated test infrastructure with production or hosted credentials merely to make a check run.

## Scope-aware validation

1. Start with the narrowest relevant check.
2. Re-run focused checks after meaningful structural changes.
3. Before opening or updating a PR, run every check relevant to the changed surface.
4. For broad or full-stack changes, expand to broader relevant CI coverage.
5. Never weaken assertions, authorization, RLS, or validation just to make a test pass.

Architecture characterization commands are documented in [architecture/module-ownership.md](architecture/module-ownership.md).
