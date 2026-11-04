# Claude instructions for Mayaana

Read [AGENTS.md](AGENTS.md) first. It holds the project rules, commands and references.

## Working style

- Work on one component or behavior at a time, on its own branch.
- Cycle: define the outcome, read the existing files, plan briefly, change a small part, review the diff, run and try it, then commit.
- Keep source files under about 300 lines. Split by screen or responsibility when a file grows.
- Do not change behavior during refactoring.

## Where things go

- Screens: `app/secretary/`, `app/doctor/`. Shared UI: `components/`. Logic and data access: `lib/`.
- Styles stay beside the screen they belong to. Keep CSS import order unchanged when moving files.
- Database changes: a new file in `supabase/migrations/`, never an edit to an old one.

## Design checks

- Compare screens with the Figma file at the same width, starting at 390px.
- Check Arabic RTL, long names, mixed Arabic and Latin text, empty states and keyboard use.
- Use only fictional data in the demo and in seeded environments.

## Before a PR

Run `npm run typecheck`, `npm run lint`, `npm run build`, the unit tests for the changed area, and the relevant Playwright suite at `--project=chromium-390`.
