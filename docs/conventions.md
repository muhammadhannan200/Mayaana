# Project conventions

These are stable repository and product conventions. They are not a speculative target architecture.

## Product and routing

- Mayaana is an Arabic RTL clinic-management application.
- Current staff roles are Doctor and Secretary.
- The Doctor may perform essential Secretary work where current product rules allow it.
- Existing public and authenticated URLs should be preserved during behavior-preserving refactors unless a separate product change explicitly authorizes a route change.
- This Next.js 16 project uses the root `proxy.ts` convention. Do not recreate a parallel `middleware.ts` because an agent assumes middleware is missing.

## Demo versus authenticated clinical data

- `/demo` uses fictional browser-local state.
- Authenticated Doctor and Secretary flows use Supabase-backed clinical data.
- Demo records must not be written into authenticated clinical tables.
- Existing production/demo source coupling is documented architecture debt, not an approved long-term ownership model. See [architecture/dependency-baseline.md](architecture/dependency-baseline.md).

## Clinical invariants

- Doctor-private notes and diet data remain Doctor-only.
- Existing authorization, RLS, revision, retry identity, RPC, failed-draft, and transactional behavior must be preserved during refactors.
- The current product rule of one active patient in the `with_doctor` state must not be bypassed by UI-only logic where that invariant applies.
- A failed save is not a successful save; retain existing draft/error behavior unless a product ticket explicitly changes it.

## Database history

- Historical Supabase migrations are immutable.
- Do not rename, rewrite, repair, or reorder old migration history as part of normal application or refactor work.
- New database behavior belongs in a new additive migration.

## Git and review

- Meaningful work uses a dedicated branch/worktree.
- Preserve unrelated user or agent changes.
- Pull requests remain unmerged until owner approval.
- Preferred final merge method is Squash and Merge.

For current architecture ownership and dependency direction, see [architecture/module-ownership.md](architecture/module-ownership.md).
