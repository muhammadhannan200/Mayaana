# Dependency baseline (ARCH-03)

Application baseline: `ca3892b`, merged PRs #36/#37/#38. Foundation additions
are documentation, tests and report tooling only. Regenerate the live report:

```sh
node scripts/architecture-inventory.mjs
node --test scripts/architecture-inventory.test.mjs
```

The command prints Markdown to stdout and writes no files. Findings return
success; they are not ESLint/CI gates. Tool execution errors still fail normally.
The script uses the existing TypeScript dependency, with no added packages.

## Runtime cycles

None. ARCH-05 moved the shared screens to `app/secretary/clinic-flow-view.tsx`,
so `clinic-flow.tsx` only composes the demo and authenticated flows and
`persisted-flow.tsx` imports the view directly. Type-only imports are excluded
from the runtime graph.

## Production/demo coupling

Production clinical contracts and measurement metadata now live in
`lib/clinical-model.ts` (ARCH-04), which has no React, route or demo imports.
The remaining production-to-demo import declarations are:

| Production caller                                   | Imported owner        | Evidence                                   |
| --------------------------------------------------- | --------------------- | ------------------------------------------ |
| `app/doctor/visit-screen.tsx`                       | `lib/demo-clinic.tsx` | Demo hook                                  |
| `app/secretary/clinic-flow.tsx`                     | `lib/demo-clinic.tsx` | Demo hook and `Demo*` type aliases         |
| `app/secretary/measurements/measurement-screen.tsx` | `mock-visits.ts`      | Fictional preview defaults and `MockVisit` |

`mock-visits.ts` above means
`app/secretary/measurements/mock-visits.ts`. A mixed declaration can have a
runtime hook import and type-only `Demo*` bindings; the report labels the
**declaration's edge**, not each named symbol's runtime presence.

This is ownership debt, **not evidence that fictional records reach Supabase**.
Authenticated layouts do not mount the public demo provider. The existing
server-only/RPC safeguards remain unchanged.

## Wrong-direction and cross-role imports

- `lib/demo-fixture.ts` depends on route-owned `mock-visits.ts` for fictional
  fixtures only. `lib/clinical-types.ts` and `lib/clinical.ts` no longer depend
  on `app/` or on demo modules.
- Six Doctor-to-Secretary import declarations are reported: four Doctor
  route pages import `clinic-flow.tsx`;
- Doctor home and patient-record rendering also reside inside
  `clinic-flow.tsx`; the path report points to this shared ownership problem,
  not an authorization finding.
- No direct shared-UI-to-server/Supabase import is detected at this baseline.

## Size and responsibility signals

Nonblank-ended line counts from the application baseline:

| Module                                              | Lines | State/effect hook calls | Why review later                                          |
| --------------------------------------------------- | ----: | ----------------------: | --------------------------------------------------------- |
| `app/secretary/clinic-flow.tsx`                     | 1,144 |                       6 | Role routing, many screens, intake and demo mutations     |
| `app/secretary/measurements/measurement-screen.tsx` |   759 |                      11 | Forms, history, editing sheet and preview defaults        |
| `app/doctor/visit-screen.tsx`                       |   748 |                       8 | Draft, diet, appointment and completion responsibilities  |
| `lib/clinical.ts`                                   |   484 |                       0 | Session, queries, mapping, validation and RPC dispatch    |
| `app/secretary/persisted-flow.tsx`                  |   248 |                       8 | Synchronization, search, revisions, retries and status UI |
| `tests/persistence/slice-1.spec.ts`                 |   575 |                       0 | SQL contracts and browser journey in one spec             |
| `tests/clinical-browser/flow.spec.ts`               |   450 |                       0 | Large lifecycle and concurrency scenarios                 |

Thresholds: at least 400 lines, or at least 200 lines and six state/effect
hooks. Function and JSX counts are also printed. Counts are review signals,
not proof of poor design or mandatory splitting targets.

## Scope and limitations

- Reads only `app/`, `lib/`, optional `components/` and `features/`, `tests/`,
  and root `proxy.ts` in its own checkout. Symlinks are skipped. No sibling
  worktree, `.env`, dependencies, generated files or SQL is read by the scanner.
- Parses TypeScript/JavaScript ASTs, including type-only/mixed imports,
  re-exports, literal dynamic imports, literal `require` and import types.
- Resolves relative imports, the current `@/` alias, extension and index files.
  Other aliases, computed imports and semantic type provenance are not resolved.
- Reports one deterministic cycle witness per strongly connected group.
  Lazy-import cycles are conservative dependency findings, not necessarily
  initialization failures.
- Ownership rules use paths and names. Future directory conventions need an
  explicit inventory update. The report is not a security audit or browser
  bundle analyzer; it does not prove transitive client/server isolation.
- CSS ownership and actual Git-conflict history require separate review.
  This task neither converts CSS nor claims historical conflict counts.

See [module ownership](module-ownership.md) for rules and ticket sequencing.
All fixes to these application findings are ARCH-04 or later and remain deferred.
