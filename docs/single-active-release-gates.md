# Single-active patient: non-Docker release gates

Original report: 2026-10-27. Updated through Task 2.3B: 2026-11-01;
Task 2.3C: 2026-11-02.
Branch: `fix/single-active-clinic-patient`.
HEAD: `c25354602bb0c622c61b335e89c6d21caca88ec1`. The full local candidate also
includes eight staged safety follow-ups, unstaged fixes and untracked tests/docs.
HEAD alone and the staged index alone are both incomplete acceptance candidates.
The dated original results below remain historical evidence, not a rerun of the
current full public suite.

Docker is unavailable and cannot be installed on this machine. No Docker
installation, hosted database substitute, Supabase connection, role/grant
change, migration change, commit, push, PR, merge or deployment is authorized.

## Preservation and provenance

The staged binary diff's SHA-256 before this continuation was:
`4ed5ea97552281bfb6526a8232c4c4a4421975b4a3f3f79e974032d08a165607`.
The accepted ADR tree at HEAD is `f214b89b8744d081d6ab58173990580d01708ec6`.
That original continuation preserved staged files and accepted ADRs. Task 2.3C
updates documentation in the working tree only; the complete index and its staged
bytes remain unchanged. Issue #41 and Doctor polish worktrees remain outside scope.

The missing review has been recovered into
[the original review record](reviews/single-active-c253546-safety-review.md),
with its exact OpenCode session/message IDs, reviewed commits and original-text
digest. This supersedes the earlier staged follow-up document's statement that
the artifact was missing; that staged document is deliberately left unchanged.
The historical review does not constitute approval of the follow-up diff.

### Finding disposition

| Original finding                                            | Current evidence                                                                           | Remaining gate                                                               |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Overnight fixture submitted multiple top-level SQL commands | Staged fixture uses one atomic DO statement; JavaScript syntax checked                     | Actual overnight database test is BLOCKED                                    |
| Demo stale-tab recovery overwrote committed handoff         | Staged store prevents whole-store flush after failure; dedicated browser regressions exist | Fresh non-Docker browser results below; clinical DB concurrency is separate  |
| Production queue policy imported DemoEntry                  | Staged neutral structural contract and import-boundary test                                | Fresh unit/architecture results below                                        |
| Migration replacement may lack owner privileges             | Source confirms API-owned handoff and revoked temporary postgres membership                | Actual executor compatibility is BLOCKED; no permission repair is authorized |
| Issue #41 expected multiple active patients                 | Recovered review's historical integration finding, not re-inspected here                   | Owner-led reconciliation before any later branch integration                 |

## Four baseline browser failures

The original report's `git ls-remote origin refs/heads/master` identified master as
`4d0695b074a30d6113a10843cfe0b1e900b84e09`. At that time the local tracking ref
matched. Its committed `docs/architecture/foundation-validation.md:44–50` records
the exact expected-404/received-200 failures at all four widths.

The originally tested candidate had no difference from that master in the preview routes,
`tests/ui-audit/measurements.spec.ts`, architecture characterization tests,
Playwright configuration, framework configuration, package manifest or lockfile.
This establishes baseline attribution by source and historical evidence.
A separate exact-master snapshot was built and tested without touching this
worktree or the index: all four original failures reproduced. Baseline
attribution is now backed by fresh browser execution, not just source comparison.

### Mechanism

- `app/measurement-preview/[mode]/page.tsx` matches every mode and awaits params
  before rejecting invalid values with `notFound()`.
- `next.config.ts` enables Cache Components and partial prefetching.
- Installed Next.js 16.4.1 documentation,
  `dist/docs/01-app/03-api-reference/03-file-conventions/not-found.md:15`, specifies
  HTTP 404 before streaming, but HTTP 200 plus not-found UI and `noindex` after
  streaming starts. The currently failing test insists on a literal HTTP 404.
- `tests/ui-audit/measurements.spec.ts:149` aborts on that assertion, so the
  subsequent six protected-route checks in that test are not executed. They
  cannot be inferred passed from that test's failure. Supplemental isolated
  probes can verify them without editing or weakening the original assertion.

### Safest resolution

Recommend a separately authorized, small **public-preview-only routing fix**
that rejects unsupported modes before any streamed shell. An explicit finite
route set for `follow-up`, `previous` and `full-exam`, using a shared screen
composition, is preferable to broad rendering/authentication changes. Preserve
all valid URLs, RTL/accessibility, preview isolation and not-found/noindex UI.
Prove it with the unchanged literal-404 assertion at all four widths and all
protected-route checks. This is a recommendation, not an implemented or verified
route fix in this continuation.

Do not add `dynamicParams = false` blindly: the installed
`02-route-segment-config/dynamicParams.md:22` says it is unavailable with Cache
Components enabled. Do not disable caching/streaming globally, introduce
`middleware.ts`, change authentication, skip tests or accept 200 in the existing
assertion merely to make the gate green.

A temporary exception is less desirable and has not been granted. If an owner
chooses one, retain the unmodified failing tests, report the suite as FAIL, and
record exactly those four baseline failures with approver, expiry, remediation
owner and baseline/candidate identities. Require separate proof for the exact
invalid URL's not-found UI/noindex and all six checks masked by the failure.
Such an exception cannot waive DB/Auth/RLS or migration-owner verification and
cannot be represented as an all-tests-pass result.

## Historical validation (2026-10-27)

| Check                                                                                                                    | Status  | Evidence                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------- |
| Recovered original safety review                                                                                         | PASS    | Session message retrieved and original text archived with provenance                                    |
| `node --test tests/queue-handoff.test.mjs tests/queue-handoff-boundary.test.mjs scripts/architecture-inventory.test.mjs` | PASS    | 11 tests, zero failures/skips                                                                           |
| `npm run typecheck -- --incremental false`                                                                               | PASS    | Exit 0                                                                                                  |
| `npm run lint`                                                                                                           | PASS    | Exit 0                                                                                                  |
| `node scripts/ui-style-inventory.mjs`                                                                                    | PASS    | Exit 0; report-only existing style debt                                                                 |
| `node scripts/architecture-inventory.mjs`                                                                                | PASS    | Exit 0; report-only existing dependency debt                                                            |
| JavaScript syntax checks                                                                                                 | PASS    | `node --check` on clinical/auth/persistence runners, database fixture and single-active upgrade fixture |
| Production dependency audit                                                                                              | PASS    | `npm audit --omit=dev --audit-level=high`: zero vulnerabilities                                         |
| Staged diff and accepted ADR preservation                                                                                | PASS    | Initial staged-diff digest matches; `git diff HEAD -- docs/adr` is empty                                |
| Candidate production build                                                                                               | PASS    | Standard production Turbopack build with backend configuration blank                                    |
| Candidate full public browser suite                                                                                      | FAIL    | 108 passed, 4 baseline status-assertion failures, zero skipped; 9.7 minutes                             |
| Candidate single-active browser coverage                                                                                 | PASS    | All 40 cases passed, including all 24 new recovery/concurrency regression runs                          |
| Exact-master production build                                                                                            | PASS    | Fresh lockfile installation; standard Next.js 16.4.1 Turbopack build, no framework-config changes       |
| Exact-master original browser test                                                                                       | FAIL    | All four unchanged strict-404 assertions reproduced expected 404 / received 200                         |
| Attribution of four failures to latest master                                                                            | PASS    | Fresh reproduction on exact `4d0695b` at 320/390/768/1280px                                             |
| Supplemental exact-URL UI/noindex and six staff guards, master                                                           | PASS    | Four cases passed; one at each width, preserving original failure artifacts                             |
| Supplemental exact-URL UI/noindex and six staff guards, candidate                                                        | PASS    | Four cases passed against a separate candidate production server                                        |
| `npm run test:clinical`                                                                                                  | BLOCKED | Docker unavailable; NOT EXECUTED                                                                        |
| `npm run test:clinical:browser`                                                                                          | BLOCKED | Docker unavailable; NOT EXECUTED                                                                        |
| `npm run test:auth`                                                                                                      | BLOCKED | Docker unavailable; NOT EXECUTED                                                                        |
| `npm run test:persistence`                                                                                               | BLOCKED | Docker unavailable; NOT EXECUTED                                                                        |
| Actual migration-executor compatibility                                                                                  | BLOCKED | Requires isolated PostgreSQL 17 with accurate executor metadata; no hosted substitute                   |
| Branch integration / release approval                                                                                    | BLOCKED | Browser status failures unresolved, Docker gates open and staged fixes still need delta review          |

Node's existing typeless-package warning on direct TypeScript imports is not a
test failure; no package/module mode was changed. Syntax/source inspection does
not demonstrate PostgreSQL execution, RLS correctness or migration success.

## Current Demo persistence and maintained validation

The [current Demo contract](single-active-patient.md#demo) supersedes the historical
synchronous-autosave description: draft writes wait asynchronously for the scoped
Web Lock and a captured-base check. A pending edit is visible in memory, not yet
persisted. Saving/unload/navigation warnings do not guarantee that accepting reload
or losing the document preserves it. Wait for confirmation or copy recovery text.

Memory-only isolation is sticky until reload; recovered storage does not flush or
replay disconnected edits. Reset returns `reset` only for a connected shared reset.
Cleanup/locking/main-write failure returns `local_only`, leaves Account open with
a warning and does not publish a fresh shared seed. Cleanup is not transactional:
already-removed draft keys are not restored, while surviving drafts can reappear
with the original shared dataset after reload. Inspect the saved state and
explicitly retry from a fresh connected store. No clinical data uses this fallback.

Maintained command (Node 24, no Docker or hosted services):

```text
npm run test:single-active
```

It includes all five `tests/demo-*.test.mjs` suites listed in
[local validation](single-active-patient.md#local-validation), both queue-handoff
suites and the architecture inventory self-tests. The Code Quality workflow runs
the same command without replacing type generation, typecheck, lint or build.

Task 2.3B verified 59/59 focused cases and 68/68 affected Chromium cases: 40
single-active, 16 reset and 12 journey/recovery cases across all four widths.
Those results do not prove database/RLS behavior or resolve the four historical
full-public-suite status failures. Task 2.3C adds real-browser lock-contention
coverage in `tests/ui-audit/demo-draft-persistence.spec.ts`: cancelled navigation,
accepted pending-edit reload, and confirmed save/reload after lock release.

### Task 2.3C results (2026-11-02)

| Check | Result |
| --- | --- |
| `npm run test:single-active` | PASS: 59/59, no skips |
| Typecheck, lint, production build, diff checks | PASS |
| Pending-autosave Chromium regressions | PASS: 8/8 across all four widths |
| Retained single-active and reset Chromium regressions | PASS: 40/40 and 16/16 |
| Expanded browser run, including existing journeys | FAIL: 74 passed, 2 failed, no skips |
| Separate reproduction of the two failed journeys | PASS: 2/2; does not supersede the failing expanded run |
| GitHub workflow execution | NOT RUN remotely; local command passed and wiring reviewed |
| Database/RLS and restricted-executor acceptance | BLOCKED/not run |

The two failures are the unchanged no-browser-error assertion at
`tests/ui-audit/secretary-flow.spec.ts:254`, in the complete V1 journey at 768px
and 1280px. Each trace records React error #418 after navigation to the Doctor
patient list. The narrow rerun passed, so the observed failure is intermittent;
its root cause is not established. No runtime source or existing assertions were
changed by Task 2.3C. Retain both runs and diagnose this in a separately scoped
task rather than suppressing the assertion or treating a rerun as acceptance.
This is an additional open browser gate, distinct from the four historical
public-preview status failures. The full public suite was not rerun here.

### Full-candidate snapshot for acceptance

Do not export just HEAD (`git archive HEAD`), just the staged index
(`git checkout-index`), or only tracked diffs. None includes every current fix and
untracked regression. Do not stage, stash, reset or commit merely to export.

1. Freeze writes to this worktree for the snapshot. Verify the expected branch and
   HEAD, and retain the complete index, staged/unstaged binary diffs and full
   untracked inventory. The index documents the staged checkpoint; do not use its
   older file blobs in place of final working-tree bytes.
2. Obtain the NUL-delimited union of all tracked and non-ignored untracked paths:

   ```text
   git ls-files --cached --others --exclude-standard -z
   ```

   Use a binary-safe reader, not newline-based splitting. Review that allowlist
   before copying. Include committed source, all final staged/unstaged file
   contents, untracked tests/docs, hidden tracked paths such as `.github`, the npm
   script and its workflow. In particular include all five Demo unit suites and
   the reset/pending-autosave browser suites. An ignored source file, if required,
   needs explicit review and inclusion; do not assume ignored files are exported.
3. Copy each reviewed path's **current working-tree bytes** into a new, empty
   external snapshot. Preserve paths, executable modes and any reviewed link
   semantics; refuse unexpected symlinks/submodules rather than following them to
   other worktrees. Record tracked deletions and leave those paths absent. Never
   include `.git`, `node_modules`, `.next`, local environment files, credentials,
   generated reports or unrelated backups. Keep prior evidence separately intact.
4. Record branch/HEAD, the full index listing, both diffs, the selected path list,
   explicit deletions/exclusions, and per-file SHA-256 hashes in an external
   manifest. The copied tree contains final file contents, not the original
   staged/unstaged distinction; the retained index/diffs preserve that provenance.
5. Recheck source hashes and index bytes after copying. Any drift invalidates the
   snapshot: stop and take a new consistent snapshot. Verify exported hashes and
   the complete file set before transfer and again on the acceptance machine.
   Confirm this worktree's index, unrelated source, untracked evidence and backups
   remain unchanged. Acceptance reports must identify this manifest, not HEAD alone.
6. Install from the unchanged lockfile in that disposable snapshot with hooks
   disabled (`CI=1`, `HUSKY=0`), then run `npm run test:single-active` before broader
   checks. Preserve reports separately per run. Do not copy local credentials or
   attach the snapshot to a hosted backend.

### Commands and isolation

Candidate build/browser run, with backend configuration blank:

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL=''
$env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=''
$env:SUPABASE_SECRET_KEY=''
npm run build
# Only if build exits zero:
$env:UI_AUDIT_PRODUCTION='1'
npm run audit:ui:browser -- --workers=1
```

The independent baseline is exported with `git archive` from exact master to
`C:\Users\LapZone\AppData\Local\Temp\opencode\mayaana-master-release-gates-20261027`.
Its application/test/config/dependency source is unchanged. A scratch Playwright
config changes only the local server port to 3110 and worker count to one.
The original failing test is run at 320/390/768/1280px with:

```powershell
npx playwright test --config=playwright.release-gate.config.ts tests/ui-audit/measurements.spec.ts --grep 'preview navigation rejects unknown modes and protects staff routes' --workers=1
```

An initial dependency-junction shortcut caused a Turbopack filesystem-root panic
in that scratch snapshot. No baseline test ran in that attempt. The junction
was removed without touching its target; a fresh lockfile installation and
subsequent standard build succeeded. A Windows command-line junction-removal
attempt also failed before dependency installation; the validated junction was
then removed directly. These harness setup failures do not represent route
regressions or candidate-build failures. The fresh scratch installation reported
one high-severity finding in the full dependency graph; the current candidate's
production-only audit reported zero. No automatic dependency fixes were run.

### Supplemental probes (not replacements for failing assertions)

Scratch `tests/ui-audit/release-gate-probe.spec.ts` verifies the **exact** invalid
preview URL's 404 heading and noindex, then all six signed-out redirects/login
controls in the aborted original test, plus absence of localStorage keys. It
records the observed HTTP status as an annotation rather than changing the
original literal-404 assertion. These public signed-out checks are not Auth/RLS
integration tests.

Master probe: `playwright.master-probe.config.ts`, port 3110, **4 passed**.
Candidate probe: `playwright.candidate-release-gate.config.ts`, port 3120,
**4 passed**. Both use one worker and all four original viewport widths. The
candidate config initially had a scratch-only CommonJS/import.meta loader error;
after correcting only the scratch config, all four candidate cases passed.

From the scratch snapshot directory, commands were:

```powershell
node node_modules/@playwright/test/cli.js test --config=playwright.master-probe.config.ts tests/ui-audit/release-gate-probe.spec.ts --workers=1
node node_modules/@playwright/test/cli.js test --config=playwright.candidate-release-gate.config.ts tests/ui-audit/release-gate-probe.spec.ts --workers=1
```

Evidence in that scratch snapshot:

- `artifacts/ui-audit/results.json` and `test-results/`: original master failures.
- `artifacts/master-probe/results.json` and `test-results-master-probe/`.
- `artifacts/candidate-probe/results.json` and `test-results-candidate-probe/`.

The reports/output directories are separate, so the supplemental passes do not
overwrite or hide the original failures.

## Docker-dependent verification remains mandatory elsewhere

These are **BLOCKED here**, not failed test results. On a separately approved,
Docker-capable machine, use the verified full-candidate snapshot described above,
Node 24, pinned Supabase CLI 2.81.3 and PostgreSQL 17, and run the checked-in isolated
runners sequentially: clinical DB/RLS, Auth twice, persistence twice, then
clinical browser. Retain per-run evidence before the next run overwrites reports.
Do not install Docker here or substitute a hosted database.

Migration-owner verification additionally needs an operator-supplied sanitized
role/ownership/ACL/history snapshot, reproduced in disposable local PostgreSQL.
Do not assume a local superuser pass proves deployment-executor compatibility.
Preserve exact owners, grants, RLS, NOLOGIN/NOBYPASSRLS posture, rollback and
`PT409 / clinic_occupied`. Verify duplicate rejection and five-second lock-timeout
rollback independently. The existing staged follow-up document contains the
catalog queries and detailed pre-deployment procedure; none are executed here.

## Next action

Resolve the intermittent React #418 browser gate through a separately scoped
diagnosis, retain the failure artifacts, and review the complete post-2.3C local
candidate. Then obtain separately authorized disposable database acceptance using
its full snapshot. Run clean/upgrade replay,
security-contract and RPC regressions, duplicate and lock-timeout rollback, and
representative restricted-executor owner/ACL verification before authenticated
browser/Auth/persistence acceptance. The original review is historical; it does
not approve subsequent fixes. Keep database and integration approval BLOCKED.

The four historical public-preview status failures remain a separate gate: obtain
approval for a scoped routing correction or an explicit documented exception,
retain the strict assertions, and rerun that suite separately. No commit, push,
other-branch integration or hosted deployment is authorized by this document.
