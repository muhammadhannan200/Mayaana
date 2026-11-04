# Issue #41 PR 1 — Batch 1 integration preparation

Date: 2026-10-28 (validation began 2026-10-27, local UTC+03).
Status: local review candidate only; not merge-ready or deployment-ready.

## Provenance and isolation

- New branch: `fix/41-batch-1-integration`.
- New worktree: `C:/Users/LapZone/AppData/Local/Temp/opencode/mayanaa-41-batch-1-integration`.
- Fetched base: `origin/master` at `4d0695b074a30d6113a10843cfe0b1e900b84e09`; fetched again after validation with no change.
- Source: `fix/41-figma-parity` at `de1e04d5c6e2054f317964cc8bd660ad1c505047`.
- Applied only the reviewed 23-file net diff between those trees, after `git apply --check`. No merge, cherry-pick, rebase or source history was imported. Each imported file's Git-cleaned blob matches the source, including new files.
- This report is the only additional source file. The two imported Batch 1 documents describe historical source-branch work; use this report for the new integration worktree, current evidence and publication restrictions.
- Read AGENTS.md, all accepted ADRs, worktree rules, module ownership and the preceding read-only integration review. No PR 2 or later integration started.

Other heads verified: Batch 2 `6871679`, Doctor polish `4623617`, Single Active `c253546`, Issue #50 `67dacbd`. Batch 1 and Batch 2 were clean. Doctor had 22 untracked evidence files. Single Active had eight staged follow-up files and two untracked review documents. Issue #50 had staged auth work and three untracked artifact files. None was copied, changed, staged or committed here.

Preservation refs remain `chore/41-preservation-backup-20261025` at `356d7a6` and `chore/41-account-profile-backup-20261026` at `ff1f481`. No checkpoints or backups were rewritten.

## Scope and safety review

- Live-only secondary-button sizing, typography, color, wrapping and keyboard focus.
- VisitType badges/icons and visit-choice controls; first visits still require full examination.
- Secretary/Doctor bottom navigation, active/inactive icons/colors and essential Doctor Search destination reusing the existing search operation.
- PersistedFlow changes are presentation wrappers only. Busy guards, errors, refresh, revisions, request identities and retry behavior are unchanged.
- Doctor Account still links to `/doctor/staff`; Secretary Account and SignOutForm remain master versions. No new profile/account implementation.
- Auth, server clinical modules/contracts, Supabase clients/configuration, proxy, migrations, existing persistence/integration tests and fictional demo store are unchanged from master.
- No Batch 2 feedback/actions, Single Active invariant, Doctor workspace polish, Issue #50, Undo, queue removal or later-batch behavior is included. The existing multi-active characterization test is intentionally unchanged until the separate invariant integration.
- All source, tests, SVGs, lockfile and documents reviewed. Credential-pattern scan found no matches; fixture records are explicitly synthetic. No real patient data, environment files or generated artifacts are selected for commit. This is not an exhaustive security audit.

Dependency delta: only pinned development dependency `esbuild@0.25.12`, required by the in-memory focused test bundle, plus its platform packages (27 new lockfile entries, all dev-only). No existing package entry changed beyond root devDependencies. `npm audit` reports one existing dev-only Zod advisory, `GHSA-mrhx-c7xc-m3w5` (`zod@4.6.5`); that lock entry is identical to master. Production-only audit reports zero vulnerabilities. No automatic dependency fixes were applied.

## Figma verification

Freshly fetched exact nodes and downloaded their reference images:

| Node | Verified properties |
| --- | --- |
| `199:299` | Secondary: 12px/20px padding, 8px gap, 12px radius, 1px #E2E8F0 border, 16px/700/24px Noto Sans Arabic, #0F172A text |
| `117:263` | Both VisitType variants: 4px/12px padding, 4px gap, 14px icons, 12px/600/16px labels; full-exam and follow-up colors |
| `118:312` | Visit choices: 16px inset, 22px radio, teal selected fill/border, text hierarchy and unchanged visit-selection semantics |
| `117:249` | Secretary four-tab RTL order, active/inactive variants, 80x56 targets at design width, 54x30 icon-pill geometry |
| `117:132` | Doctor Home/Patients/Search/Account equivalents and states |

Compared references, scoped CSS/components and fresh fixture screenshots. Automated checks pass at 320/390/768/1280px, including Arabic RTL, image loading, overflow, keyboard focus, radio operation and axe checks. Narrow targets shrink with the retained 390px shell. Public `/demo` intentionally keeps master's styling. The Doctor account-active fixture tests navigation only, not the real staff screen. No claim of full-page Figma parity or physical-device/assistive-technology acceptance.

## Fresh validation

| Check | Result |
| --- | --- |
| `npm ci` | PASS; fresh local dependencies, no environment-file reuse |
| `npm run typecheck` | PASS after production build generated route helpers |
| `npm run audit:ui:static` | PASS, including `npm run lint`; styling inventory is informational |
| `npm run build` | PASS; all three Supabase configuration variables blank; 24 static pages |
| `node --test scripts/architecture-inventory.test.mjs` | 6 passed, zero skipped |
| Mechanical detector on integrated UI modules/styles | No findings |
| Focused production Batch 1 suite, two workers | **64 passed, zero skipped/flaky**, 157.5 seconds |
| Full public production UI audit, one worker, run once | **128 passed, 8 failed, zero skipped/flaky**, 600.9 seconds |
| Exact-master targeted baseline reproduction | **8 failed**, matching the same two failures at all four widths; attribution evidence, not a passing suite |
| `npm audit --omit=dev --json` | Zero vulnerabilities |
| Git whitespace/scope/credential checks | PASS |

Initial clean-worktree typecheck failed with missing generated `LayoutProps`; the subsequent build generated its definitions and the unmodified typecheck passed. A final combined typecheck/lint shell command reached its 120-second command limit after typecheck passed; a standalone lint rerun exited zero. No compiler setting, source type, per-test timeout, retry, error listener or assertion was changed.

Commands (PowerShell sets `UI_AUDIT_PRODUCTION=1` for both browser runs):

```text
npx playwright test --config=playwright.config.ts tests/ui-audit/issue-41.spec.ts --workers=2 --output=artifacts/ui-audit/pr1-integration/focused-test-results
npx playwright test --config=playwright.config.ts --workers=1 --output=artifacts/ui-audit/pr1-integration/full-test-results
```

### Full-audit failures and baseline proof

1. `tests/ui-audit/measurements.spec.ts:149`, 320/390/768/1280px: expected HTTP 404, received streamed HTTP 200. The unchanged route/test and installed Next.js documentation establish the known transport-contract mismatch. The later staff-guard assertions in that particular failed test are not reached; other passing signed-out characterization tests are separate evidence.
2. `tests/ui-audit/secretary-flow.spec.ts:236`, all four widths: React hydration error #418. The audit began at 23:59 local time and crossed midnight after the production build initialized fictional dates. Module-level `demoDate()` independently generates server/client initial snapshots. These files and the journey assertions are unchanged from master. No hydration suppression or demo-state repair was introduced.

Exported exact master with `git archive` into separate scratch directory `C:/Users/LapZone/AppData/Local/Temp/opencode/mayanaa-pr1-master-baseline-20261028`, installed its own lockfile dependencies (no junction), and built it with blank backend variables. Verified 79 application/test/database/dependency/framework-config blobs against master using Git's line-ending normalization. Only an additional scratch Playwright config specifies browser `Asia/Damascus`; the process/server uses `TZ=UTC`, deliberately making the two calendar dates differ as they did across midnight. No application code or original assertion was changed.

Ran the original preview-navigation and complete-V1 tests at all four widths using:

```text
# In the exact-master scratch snapshot, TZ=UTC and UI_AUDIT_PRODUCTION=1:
npx playwright test --config=playwright.pr1-baseline.config.ts tests/ui-audit/secretary-flow.spec.ts tests/ui-audit/measurements.spec.ts --grep 'complete V1|preview navigation rejects' --workers=1
```

All eight baseline cases reproduced the same failures. This confirms the known date-mismatch class on exact master; it does not claim a normal same-day baseline run always fails. The full candidate audit remains **FAIL**, not green. The current user authorization permits a local review commit with documented pre-existing baseline failures; it does not waive merge or release gates.

Expected missing-Supabase-configuration diagnostics appeared in passing blank-backend guard checks. No shared/hosted Supabase backend, migration, account provisioning or clinical record access was used.

**NOT RUN:** Auth, Persistence, Clinical DB/RLS and Clinical Browser suites (Docker and Supabase CLI unavailable); physical iOS/Android, Safari/Firefox and manual assistive-technology validation. No unavailable integration result is inferred from synthetic browser tests.

## Evidence and local tooling

All generated evidence is ignored under `artifacts/ui-audit/pr1-integration/`: Figma PNGs, focused screenshots/results, full screenshots/traces/results, net patch, baseline archive/report and dependency audits. Original baseline traces remain in the separate scratch snapshot. Existing ignore rules cover this output; no ignore-rule change is needed.

The inherited pre-commit hook invokes `npx lint-staged`, but lint-staged is not declared/installed by this lockfile. Do not fetch an unpinned package or autoformat the preserved source to satisfy it. For this local review commit only, disable Husky process-locally after independently running the recorded lint, typecheck, build and diff checks; do not edit hooks or shared Git configuration.

Framework-feedback reporting pass: no new qualifying Next.js defect. Missing generated helpers are clean-worktree bootstrap; streamed status is documented behavior; the hydration mismatch is application fixture initialization, not demonstrated framework misbehavior.

## Prepared review-only Draft PR

Title: `fix(ui): Issue #41 Batch 1 Global UI parity`

### Summary

```text
Existing persisted clinical controller
  -> live-only secondary buttons and VisitType/visit choices
  -> SecretaryNav / DoctorNav
     -> existing Secretary Account / Doctor staff
     -> existing patient search through Doctor Search
```

Refs #41. Integrates the approved `de1e04d` net diff onto `4d0695b`, without checkpoint history. No Account/Profile, Batch 2, Single Active, Doctor polish, Issue #50, auth/backend or migration changes.

### Evidence

- **Before:** master retains its pre-parity presentation; exact-master targeted tests reproduce four streamed-status and four date-mismatch hydration failures.
  **After:** fresh Figma verification at all five requested nodes; typecheck/lint/build/static audit and six architecture tests pass; focused Batch 1 browser checks **64/64 pass** at 320/390/768/1280px.
- Full candidate audit ran once: **128 passed / 8 failed**, zero skipped. Failures match the independently reproduced baseline; they are unresolved, not suppressed. Docker-dependent integration suites are **NOT RUN**. Full report: this document.

### Merge Danger

**Door:** two-way. Presentation/navigation changes; no database rollout.

**Blast Radius:** clinical-ui.

Keep Draft and unmerged. Resolve or explicitly disposition baseline status/hydration failures, obtain authenticated integration/CI and human visual-review evidence, and review the existing dev-only advisory before merge approval. Later branch integrations must retain this UI while deliberately updating the superseded multi-active characterization when the invariant is introduced. Review-ready is not merge-ready or deployment-ready.

Publication is not authorized: no push, PR creation, merge, deployment or migration application in this task.
