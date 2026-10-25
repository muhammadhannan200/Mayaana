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

## Confirmed runtime cycle

```text
app/secretary/clinic-flow.tsx
  -> app/secretary/persisted-flow.tsx
  -> app/secretary/clinic-flow.tsx
```

`ClinicFlow` chooses the authenticated flow, which imports `ClinicFlowView`
from the chooser's module. The inventory detects this runtime cycle; it does
not remove it. Type-only imports are excluded from the runtime graph.

## Production/demo coupling

The baseline report has 11 production-to-demo/fixture import declarations:

| Production caller                                   | Imported owner                          | Evidence                                                |
| --------------------------------------------------- | --------------------------------------- | ------------------------------------------------------- |
| `app/clinical-actions.ts`                           | `lib/demo-clinic.tsx`, `mock-visits.ts` | `DemoVisit`, `VisitMeasurement` contracts               |
| `app/doctor/visit-screen.tsx`                       | `lib/demo-clinic.tsx`, `mock-visits.ts` | Demo hook/type and measurement metadata                 |
| `app/secretary/clinic-flow.tsx`                     | `lib/demo-clinic.tsx`, `mock-visits.ts` | Demo hook/contracts and measurement metadata            |
| `app/secretary/measurements/measurement-screen.tsx` | `mock-visits.ts`                        | Types, metadata and fictional preview defaults          |
| `lib/clinical-types.ts`                             | `lib/demo-clinic.tsx`, `mock-visits.ts` | Production contracts derive from demo/fixture contracts |
| `lib/clinical.ts`                                   | `lib/demo-clinic.tsx`, `mock-visits.ts` | Doctor draft and history/measurement contracts          |

`mock-visits.ts` above means
`app/secretary/measurements/mock-visits.ts`. A mixed declaration can have a
runtime hook import and type-only `Demo*` bindings; the report labels the
**declaration's edge**, not each named symbol's runtime presence.

This is ownership debt, **not evidence that fictional records reach Supabase**.
Authenticated layouts do not mount the public demo provider. The existing
server-only/RPC safeguards remain unchanged.

## Wrong-direction and cross-role imports

- Three `lib/` callers depend on route-owned `mock-visits.ts`:
  `clinical-types.ts`, `clinical.ts`, and `demo-clinic.tsx`.
- `lib/clinical-types.ts` directly depends on `app/`. No direct React import
  is present in that file, but its contracts also derive from a client-marked
  demo module. Neutral model extraction is deferred.
- Six Doctor-to-Secretary import declarations are reported: four Doctor
  route pages import `clinic-flow.tsx`; `visit-screen.tsx` imports the
  Secretary icon module and measurement metadata/fixtures module.
- Doctor home and patient-record rendering also reside inside
  `clinic-flow.tsx`; the path report points to this shared ownership problem,
  not an authorization finding.
- No direct shared-UI-to-server/Supabase import is detected at this baseline.
  The inventory recognizes current `app/secretary/components.tsx` as shared UI,
  plus future root `components/` and feature `ui/` directories.

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
