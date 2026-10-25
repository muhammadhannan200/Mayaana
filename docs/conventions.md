# Project conventions

Stable rules for changing Mayaana. This document links to the precise source
where one already exists; it does not replace product decisions, the
architecture documents, or security rules.

Architecture ownership remains authoritative for module boundaries:
[module ownership](architecture/module-ownership.md) and the
[dependency baseline](architecture/dependency-baseline.md).

## Product constraints

- **Arabic RTL is a product-level constraint**, not a theme option. Layout,
  typography, navigation, dialogs and validation copy must keep working in RTL
  at the supported widths. See [design system](design-system.md) and
  [UI patterns](ui-patterns.md).
- **Current product roles are Doctor and Secretary.** One clinic has one
  doctor; secretary support is multi-seat later. See
  [clinic glossary](clinic-glossary.md) and [login flow](login-flow.md).
- **A Doctor can perform the essential Secretary tasks** described by current
  product rules: adding a patient to the queue and recording measurements. Do
  not remove that capability as part of a refactor. See
  [login flow — agreed behavior](login-flow.md).
- **`/demo` uses fictional browser-local data.** It is a presentation and
  workflow demo, not a security boundary or a clinical store. See
  [Secretary V1 demo](secretary-v1-demo.md).
- **Authenticated clinical flows use Supabase** as the authoritative store.
  Browser storage is not a fallback for authenticated clinical data. See
  [clinical persistence foundation](clinical-persistence.md).
- **Production contracts should not depend on demo fixtures long-term.**
  Existing `Demo*` coupling is recorded debt, not an approved pattern. See
  [dependency baseline](architecture/dependency-baseline.md).

## Routing and authorization

- **This project uses `proxy.ts`.** Do not recreate `middleware.ts`; session
  refresh and signed-out redirect behavior already live in the existing proxy
  and layouts.
- **Existing URLs must be preserved during refactoring.** Route paths are used
  by the demo, tests and real links; a rename is a product change, not a
  cleanup.
- **Authorization behavior must be preserved.** UI visibility is not
  authorization; server and database checks remain the boundary. See
  [security](security.md) and [database](database.md).
- **Doctor-private notes and diet remain Doctor-only.** Secretary reads
  exclude private notes entirely, not just hidden fields. See
  [clinical persistence — authorization](clinical-persistence.md).
- **Preserve the single active `with_doctor` patient rule where applicable.**
  The current queue presents one current patient at a time; do not assume
  parallel doctor handoffs when changing queue or visit code.

## Data and database

- **Historical Supabase migrations are immutable.** Never rename, reorder,
  repair or rewrite applied migration history as part of application work; add
  a new migration instead. See [Supabase usage](supabase.md) and
  [database](database.md).
- **RLS and role checks are part of the application.** Do not bypass them from
  client code, and do not relax them to make a feature or test pass. See
  [security](security.md).
- **Completed clinical records are immutable** and revisions/retry identities
  are contracts. Preserve them when moving code.

## Delivery workflow

- Every meaningful feature, fix, chore or documentation task runs on a
  dedicated `feature/`, `fix/`, `chore/` or `docs/` branch. See
  [AGENTS.md](../AGENTS.md) and [parallel worktrees](agents/worktrees.md).
- **Pull requests remain unmerged until the owner approves.** Opening a PR is
  not permission to merge.
- **Preferred merge strategy is Squash and Merge**, keeping one reviewable
  commit per PR on `master`.
- Validation is scope-aware: narrow checks first, broader validation before the
  PR is complete. See [commands](commands.md).
- Do not force-push or rewrite Git history unless the owner explicitly asks.

## Documentation

- Keep `AGENTS.md` focused on agent operating rules; put supporting detail in
  `docs/` and link to it.
- Prefer improving an existing document over creating a near-duplicate. When a
  rule is defined precisely elsewhere, link to it instead of restating it at
  length.
