<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Mayaana agent instructions

Rules and index, not an encyclopedia. Read the linked documents for detail.

## Project context

- Mayaana is an Arabic RTL clinic-management application.
- Stack: Next.js 16 App Router, React 19, TypeScript, Supabase Auth + Postgres, Vercel.
- Roles: Doctor and Secretary.
- `/demo` uses fictional browser-local data only.
- Authenticated Doctor/Secretary flows use Supabase-backed clinical data.

## Critical commands

```bash
npm ci
npm run typecheck
npm run lint
npm run build
```

Focused validation:

```bash
npm run test:auth
npm run test:persistence
npm run test:clinical
npm run test:clinical:browser
npm run audit:ui
```

There is no `npm test` script. Do not document or run it as if one existed.

## Scope-aware validation

- Run the narrowest relevant validation first.
- Do not run every expensive integration suite after every tiny change.
- Expand validation before a PR is considered complete.
- Match validation to the changed surface:
  - Queue or clinical UI → relevant clinical browser tests plus typecheck/lint.
  - Auth → Auth E2E (`npm run test:auth`).
  - Database or RLS → clinical DB/RLS suite (`npm run test:clinical`).
  - Broad or full-stack → broader relevant CI coverage.
- Never weaken tests or change expectations just to make validation pass.

## Worktree safety

- Never modify a worktree another agent may be using.
- Never stash, reset, clean, overwrite, or commit another agent's uncommitted work.
- Concurrent work must use dedicated branches/worktrees created from the latest `master`.
- Inspect `git status` and the current branch before changing files.
- Preserve unrelated and pre-existing user changes.

See [docs/agents/worktrees.md](docs/agents/worktrees.md) for the detailed rules.

## Known project conventions

- This project uses `proxy.ts`; do not recreate `middleware.ts`.
- Historical Supabase migrations are immutable.
- `/demo` must remain browser-local and fictional.
- Authenticated clinical flows use Supabase.
- Doctor-private notes and diet must remain Doctor-only.
- Architecture/refactoring work must preserve observable behavior unless a separate feature or bug ticket explicitly authorizes behavior change.
- Do not touch Issue #41's uncommitted worktree without explicit owner approval.
- Pull requests remain unmerged until owner approval.
- Preferred final merge strategy is Squash and Merge.

## Skills

- `improve codebase architecture` — architecture analysis and identifying structural problems.
- `to tickets` — split architecture/refactor work into small, reviewable tasks.
- `code-refactorer` — behavior-preserving structural refactoring only.

`code-refactorer` is not for feature work, bug fixing, or product redesign.
Behavior must be frozen during refactoring. Load only the relevant reference
files for the scope being changed.

## Git workflow / Land the work

For every meaningful feature, bug fix, chore, or documentation task:

1. Work on a dedicated branch named `feature/<name>`, `fix/<name>`, `chore/<name>`, or `docs/<name>`. Never work directly on `master`.
2. Validate the affected scope.
3. Review the diff.
4. Commit only task-related changes with a clear conventional commit message; exclude secrets and local environment files.
5. Push the branch.
6. Open or update a Pull Request targeting `master`.
7. Stop before merge.

Do not auto-merge, force-push, rewrite history, or include unrelated changes
unless explicitly authorized.

## Detailed references

- Architecture ownership: [docs/architecture/module-ownership.md](docs/architecture/module-ownership.md)
- Architecture dependency baseline: [docs/architecture/dependency-baseline.md](docs/architecture/dependency-baseline.md)
- Architecture foundation validation: [docs/architecture/foundation-validation.md](docs/architecture/foundation-validation.md)
- Product overview: [docs/product-overview.md](docs/product-overview.md)
- Figma structure: [docs/figma-structure.md](docs/figma-structure.md)
- Design system: [docs/design-system.md](docs/design-system.md)
- Login flow: [docs/login-flow.md](docs/login-flow.md)
- Database: [docs/database.md](docs/database.md)
- UI patterns: [docs/ui-patterns.md](docs/ui-patterns.md)
- UI audit: [docs/ui-audit.md](docs/ui-audit.md)
- Worktree safety: [docs/agents/worktrees.md](docs/agents/worktrees.md)

<!-- BEGIN:nextjs-agent-feedback -->

## Report Next.js feedback

The project owner enabled `experimental.agentFeedback`, authorizing this feedback pass. When enabled, `next dev` writes this block and restores it if removed. Commit `AGENTS.md` with your work to keep the tree clean.

During the current user request, retain anonymized facts as feedback candidates for meaningful or recurring Next.js issues:

- Crashes, hangs, OOMs, or unexpected slowness
- Incorrect behavior, output, errors, or diagnostics
- Missing, unclear, or conflicting documentation
- Unexpected CLI, codemod, Skill, or upgrade behavior and non-obvious workarounds

Continue the current user request without reporting immediately. Ignore routine debugging and unverified changes. Never retain code, logs, paths, URLs, secrets, personal information, or project-specific data.

Keep a qualifying candidate through the reporting pass even if you resolve or work around it. A successful fix changes the report outcome; it does not erase the friction that qualified it.

Before the final response, run one reporting pass. If candidates remain, from this file's directory run `node node_modules/next/dist/bin/next internal agent-feedback-instructions` once without piping or truncating its output. Follow its output or error guidance. If a network sandbox blocks it, retry with network access; if it still returns no output, continue normally.

<!-- END:nextjs-agent-feedback -->
