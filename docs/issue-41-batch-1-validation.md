# Issue #41: Batch 1 reconciliation and validation

Date: 2026-10-25. Branch: `fix/41-figma-parity`.

## Preservation and merge status

- Checkpoint: `356d7a6df752218f218b15c0ef29146e420ff4d3`.
- Backup: `chore/41-preservation-backup-20261025`, still pointing to the checkpoint.
- Incoming master: `4d0695b074a30d6113a10843cfe0b1e900b84e09`.
- The owner authorized completing the pending local, two-parent merge after
  runnable Batch 1 checks, with Docker and Supabase CLI setup explicitly deferred.
  Backend suites remain **NOT RUN**, not passed. The merge preserves both parents
  rather than squashing the checkpoint; identify its SHA with
  `git log -1 --format='%H %P' fix/41-figma-parity`.
- No push, PR, merge to master, migration deployment or issue-checklist update.

## Resolution

Each controller conflict was reviewed against master's current interfaces.
The old combined persistence/presentation implementation is not retained as a
second live flow. Master owns `PersistedFlow`, `getClinicScreen`, explicit
operations, `snapshot.queue`, revisions, retry identities, mutation locking,
polling, pagination and error/discard handling. The controller's only changes
relative to master are presentation wrapper classes/markup for live UI styling.

Compatible presentation from the checkpoint is integrated in `ClinicFlowView`,
`clinic-ui.tsx` and live-scoped `persisted.css`. Public demo rendering remains
separate. First-visit full-exam restrictions remain intact. The Doctor search
navigation uses the current Doctor patient-search view and server operation.

Retained account screens now use master's unchanged `SignOutForm`; its actual
pending, disabled and failure behavior is exercised by the isolated UI tests.
Account role-boundary persistence coverage remains added to the existing suite.
The account redesign itself is not marked Figma-complete by this batch.

`package.json` retains all master scripts and the checkpoint's pinned development
dependency `esbuild@0.25.12`, used only by the isolated test bundle; its lockfile
is retained. The auto-merged persistence spec retains master's existing assertions
and adds only the checkpoint's account-role test.

There are no changes relative to incoming master in auth actions, SignOutForm,
clinical server actions, clinical server implementation/types, Supabase clients,
configuration, RLS or migrations.

## Figma evidence

File: `dZPtsNiHOfyhqRgHb6H0yx`. Exact nodes inspected before implementation:

| Surface | Nodes | Applied values |
| --- | --- | --- |
| Secondary button | `199:299` | White, slate border/text, 12px radius, 12px/20px padding, 16px/24px bold label, 8px gap; 50px browser border-box height |
| VisitType badges | `117:263`, `117:250`, `117:256` | 14px icons, 4px/12px padding, 4px gap, 12px/16px semibold, sky/slate variants |
| Visit choice controls | `118:276`, especially `118:312`, `118:313`, `118:318` | 22px radios, 16px padding, 12px gap/radius, teal selected surface and 2px border |
| Secretary bottom navigation | `117:249`, all four active variants | 54px/30px icon pills, 80px/56px targets, 4px gap, active/inactive slate text and teal pill |
| Doctor bottom navigation | `117:132`, all four active variants | Same geometry/colors, with Home icon |

Rendered screenshots were reviewed at mobile and desktop widths against Figma
exports. Tests assert measured styles, RTL ordering, keyboard selection/focus,
image loading, horizontal overflow and axe accessibility. The existing 390px
app shell is preserved on desktop; Figma does not specify a new desktop layout.
The fixture loads the actual compiled Noto Sans Arabic fonts, resolving font
URLs relative to their stylesheet before embedding them.

## Inactive checkpoint work and superseded tests

The checkpoint's 48 UI cases were 12 scenarios repeated at four widths. They
targeted removed controller exports, server actions and snapshot shapes; that
old bundle is not used to validate the new implementation.

| Checkpoint scenario | Current disposition |
| --- | --- |
| Required fields and linked errors | Later-batch field-level UI remains checkpoint-only; master intake behavior retained |
| Navigation SVG/current-page state | Adapted and expanded to eight role/route combinations |
| Patient-directory routing and goal filters | Checkpoint-only; no new Secretary detail route activated |
| Visit choices | Adapted to current operations with both returning-patient selection and first-visit restriction tests |
| Temporary handoff success | Checkpoint-only; master success/recovery behavior retained |
| Block second handoff | Inactive; replaced by a master-contract regression test proving a second handoff remains possible |
| Failed handoff | Adapted to structured errors, explicit revision/request identity and retained queue state |
| Standalone patient validator | Checkpoint-only; no new validation feature activated |
| Secretary account | Navigation/axe and real SignOutForm states covered; real identity/role test retained but backend execution blocked |
| Doctor current card and total statistic | Checkpoint-only; master current-patient list and displayed-file statistics retained |
| Doctor account/search | Navigation adapted; existing patient-search operation reused; role tests retained |
| Extended Secretary demographics/details | Checkpoint-only |

The replacement suite has **64 cases** (16 scenarios at four widths), not a
claim that all 48 old cases passed unchanged. Additional checks measure secondary
buttons and badges, cover Doctor-visit disabled writes, and verify first-visit
behavior and pending/failed logout. No test is skipped within the new suite.

## Current continuation validation results (without Docker)

All commands below were rerun against the reconciled tree on 2026-10-25, except
the four explicitly NOT RUN suites. Build and browser servers used blank
Supabase configuration. No production/shared database was used. Neither Docker
nor Supabase CLI resolves on PATH; no installation or stack startup was attempted.

| Command/check | Result |
| --- | --- |
| `npm run typecheck` | PASS, exit 0 |
| `npm run lint` | PASS, exit 0 |
| `npm run build` | PASS, exit 0; 25 static pages generated |
| `UI_AUDIT_PRODUCTION=1 npm run audit:ui:browser -- tests/ui-audit/issue-41.spec.ts --workers=2` | PASS: 64 passed, 0 failed, 0 skipped; 2.3 minutes |
| `npm run audit:ui:static` | PASS: lint and report-only style inventory, exit 0 |
| `UI_AUDIT_PRODUCTION=1 npm run audit:ui:browser -- --workers=2` | NOT GREEN: 132 passed, 4 existing failures, 0 skipped; 4.7 minutes. All 64 Batch 1 cases passed |
| `node --test scripts/architecture-inventory.test.mjs` | PASS: 6 passed, 0 failed |
| Persistence: `npm run test:persistence` | **NOT RUN**: Docker/Supabase CLI unavailable; setup deferred by owner |
| Auth: `npm run test:auth` | **NOT RUN**: Docker/Supabase CLI unavailable; setup deferred by owner |
| Clinical Browser: `npm run test:clinical:browser` | **NOT RUN**: Docker/Supabase CLI unavailable; setup deferred by owner |
| Clinical DB: `npm run test:clinical` | **NOT RUN**: Docker/Supabase CLI unavailable; setup deferred by owner |
| Diff whitespace, unmerged index and conflict-marker checks | PASS: no whitespace errors, unmerged entries or tracked conflict markers |

Previous attempts stopped before backend test execution with missing CLI/startup
errors (and cleanup diagnostics); those attempts are not integration passes and
were not repeated during this continuation.

### Four existing full UI audit failures (separate from Batch 1)

| Project | Assertion | Actual |
| --- | --- | --- |
| `chromium-320` | `tests/ui-audit/measurements.spec.ts:149`: HTTP 404 | HTTP 200 |
| `chromium-390` | `tests/ui-audit/measurements.spec.ts:149`: HTTP 404 | HTTP 200 |
| `chromium-768` | `tests/ui-audit/measurements.spec.ts:149`: HTTP 404 | HTTP 200 |
| `chromium-1280` | `tests/ui-audit/measurements.spec.ts:149`: HTTP 404 | HTTP 200 |

Test: `preview navigation rejects unknown modes and protects staff routes`.
Current local evidence: `artifacts/ui-audit/results.json` and the four
`test-results/measurements-preview-navig-*/` screenshot/trace directories
(generated, intentionally not committed).

All four full-audit failures are the unchanged assertion in
`tests/ui-audit/measurements.spec.ts:149`: expected HTTP 404 but received 200 for
an invalid measurement-preview route in production streaming. This exact
pre-existing failure and the associated blank-backend diagnostic are documented
in `docs/architecture/foundation-validation.md`. Neither that assertion nor its
application route was changed or skipped.

Initial validation also exposed stale generated development route validators
for the checkpoint-only Secretary detail route after its removal. `next typegen`
regenerated production types but did not retire those development validators;
the first build failed on them. Removing only the two obsolete generated
development route-type files allowed typecheck and build to pass. No application
types or TypeScript checks were suppressed. The initial isolated-bundle failure
was fixed by mocking SignOutForm's relative server-action import at the test
boundary, rather than bundling server-only modules into a browser fixture.

## Reconciliation review and changed-file scope

The merge delta from the checkpoint contains 70 files, including incoming
master's clinical/auth implementation, migration and architecture documentation.
Those incoming changes are not new Batch 1 features. Relative to incoming master,
the reconciled tree has these 27 changed files:

- `app/doctor/account/page.tsx`, `app/doctor/search/page.tsx`
- `app/secretary/account/account-screen.tsx`, `app/secretary/account/page.tsx`
- `app/secretary/clinic-flow.tsx`, `app/secretary/clinic-ui.tsx`
- `app/secretary/persisted-flow.tsx`, `app/secretary/persisted.css`
- `docs/issue-41-batch-1-validation.md`, `package.json`, `package-lock.json`
- `public/rashaqa/account-logout.svg`
- `public/rashaqa/nav-account-active.svg`, `public/rashaqa/nav-account.svg`
- `public/rashaqa/nav-home-active.svg`, `public/rashaqa/nav-home.svg`
- `public/rashaqa/nav-patients-active.svg`, `public/rashaqa/nav-patients.svg`
- `public/rashaqa/nav-queue-active.svg`, `public/rashaqa/nav-queue.svg`
- `public/rashaqa/nav-search-active.svg`, `public/rashaqa/nav-search.svg`
- `public/rashaqa/visit-follow-up.svg`, `public/rashaqa/visit-full-exam.svg`
- `tests/fixtures/issue-41-clinic.tsx`, `tests/persistence/slice-1.spec.ts`
- `tests/ui-audit/issue-41.spec.ts`

Reviewed the staged delta against both parents. Persistence controller differences
from master are CSS wrapper markup only. Auth actions, SignOutForm, server-side
clinical operations/types, Supabase clients/configuration and migrations are
identical to master. Queue behavior preserves multiple patients with the Doctor,
revision/request identities and failure recovery. SignOutForm pending/disabled
and service-error behavior passes at all four widths using a mocked action;
actual remote revocation and cookie handling are not verified by that fixture.

No unintended later-batch behavior is activated: no Secretary detail route,
standalone patient validator, new field-level validation, goal filters, extended
demographics, temporary handoff success, second-handoff blocking, or Doctor
current-card/statistics rewrite. Account presentation is retained checkpoint work,
not a claim of account Figma completion. Doctor search reuses the existing search
operation. No Batch 2 work or issue-checklist completion was performed.

## Manual-review readiness and remaining gates

**Ready for manual review of Batch 1 UI, with explicit validation limitations.**
The owner permits the local merge despite deferred integration suites and the
four separately recorded pre-existing full-audit failures. This is not full-stack
acceptance or production readiness, and the full audit is not green.

Persistence, Auth, Clinical Browser and Clinical DB must still run against the
repository's disposable local stack when Docker and the pinned Supabase CLI are
available. Real account identity/role isolation, session revocation/cookies,
database/RLS, transactional handoff and upgrade behavior remain unverified here.
Keep the four known audit failures visible; no assertion was changed or weakened.
No push or PR is authorized yet. Preserve the checkpoint and backup branch.
