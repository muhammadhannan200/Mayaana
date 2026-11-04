# Issue #41: Batch 1 scope separation and validation

Date: 2026-10-26. Branch: `fix/41-figma-parity`. Review only; no push or PR authorized by this separation task.

## Scope and preservation

The owner authorized separating unfinished Account/Profile implementation from
the review diff, without rewriting the preservation checkpoint or existing history.

- Latest fetched `origin/master`: `4d0695b074a30d6113a10843cfe0b1e900b84e09`.
- Original checkpoint/backup: `356d7a6df752218f218b15c0ef29146e420ff4d3`,
  `chore/41-preservation-backup-20261025`; unchanged.
- Additional backup: `chore/41-account-profile-backup-20261026`, pointing to
  `ff1f481b168c572c642485390830015bb1634bb1`, the clean pre-separation tip.
- Verified the backup's relevant blobs equal the pre-separation HEAD and are
  readable with `git cat-file` before removing any implementation.

The additional backup preserves the exact reconciled versions of:

- `app/doctor/account/page.tsx`
- `app/secretary/account/page.tsx`
- `app/secretary/account/account-screen.tsx`
- `app/secretary/persisted.css` (including profile-only styles)
- `app/secretary/clinic-ui.tsx` (including the former Doctor account destination)
- `public/rashaqa/account-logout.svg`
- `tests/fixtures/issue-41-clinic.tsx`
- `tests/ui-audit/issue-41.spec.ts`
- `tests/persistence/slice-1.spec.ts`
- Both Issue #41 validation/handoff documents, including the previous historical
  results and operator handoff. The entire pre-separation tree is preserved too.

Recover an individual file for inspection with
`git show chore/41-account-profile-backup-20261026:<path>`.
Do not restore the entire backup over Batch 1: it deliberately contains unfinished
work. No existing backup was moved, reset, amended or force-pushed.

## Final live scope

Only the three approved Global UI items and required compatibility/testing remain:

1. Secondary-button geometry, typography, color and keyboard focus.
2. VisitType badges and visit-choice controls, preserving existing commands and
   first-visit full-exam restrictions.
3. Secretary/Doctor bottom-navigation icons and active/inactive colors.

The live controller changes are presentation wrappers only. Doctor Search reuses
the existing patient-search view/operation as the new Search tab's destination.
The Doctor account tab retains master's existing `/doctor/staff` destination;
there is no new `/doctor/account` route. The existing staff page is unchanged.
The Secretary account route is restored exactly to master and renders its original
content/SignOutForm with shared Global UI navigation.

Removed from the final diff: the new profile route/component, signed-in-profile
queries, profile-specific CSS/logout asset, and account-profile persistence test.
Shared nav account icons remain: they are required by Global UI, not a profile
redesign. No queue snackbar/Undo, single-active-patient restriction, patient-detail
route, intake validation feature, demographics, filters, home statistics or other
later-batch work is activated. No Issue #50 implementation is included.

Auth actions, SignOutForm, server clinical implementation/contracts, Supabase
clients/configuration, RLS and migrations remain identical to master. Existing
persistence tests are restored exactly to master. The public fictional demo is
unchanged. No real patient data or hosted backend is used by the focused fixture.

The only dependency addition is development-only `esbuild@0.25.12`, pinned for the
in-memory isolated browser-test bundle. The lockfile adds its platform packages;
no pre-existing package entry changes. All 27 added package entries are pinned
esbuild/platform packages from the npm registry and marked development-only.
This is not a dependency-security certification.

Reviewed the full net diff against fetched master, including source, tests,
documentation, SVG assets and package metadata. Added-line scanning found no
private keys, recognized secret-key/JWT patterns or conflict markers. No
environment, screenshot, trace, generated-build or node_modules path is in the
review diff. Focused fixture records are explicitly synthetic; no real patient
data was identified. These checks are not an exhaustive privacy/security audit.
The old checkpoint commits remain in history for preservation, but their
unfinished features do not remain in the final net diff.

## Figma evidence retained

File: `dZPtsNiHOfyhqRgHb6H0yx`. Previously fetched/rechecked exact nodes:

| Surface              | Nodes                                      |
| -------------------- | ------------------------------------------ |
| Secondary button     | `199:299`                                  |
| VisitType badges     | `117:263`, `117:250`, `117:256`            |
| Visit choices        | `118:276`, `118:312`, `118:313`, `118:318` |
| Secretary navigation | `117:249`                                  |
| Doctor navigation    | `117:132`                                  |

The separation does not redesign these primitives. Tests retain their measured
geometry/color checks, RTL ordering, image loading, keyboard behavior, overflow
and axe assertions at 320/390/768/1280px. The 390px application shell remains.

## Focused coverage after separation

The suite still has 16 scenarios at four widths (64 cases), but is not a claim
that the removed Account/Profile flow remains tested or shipped:

- Seven existing live-screen navigation variants plus an isolated DoctorNav
  account-active state fixture, asserting the existing `/doctor/staff` href.
  That fixture is not a replacement staff page and does not verify its backend.
- Secondary buttons, both VisitType badges and visit choices.
- First-visit restrictions, multi-patient handoff/revision identity, conflict
  recovery and disabled Doctor writes.
- Existing Secretary SignOutForm pending/failure states with a mocked action,
  not remote session revocation or profile loading.

Only profile-specific coverage was removed/adapted with the authorized scope
separation. No existing full-audit failing assertion, console-error listener,
retry or timeout setting was changed.

## Validation rerun

All new browser artifacts are isolated under the approved temporary directory
`issue41-scope-20261026`, not committed and not overwriting historical full-run
evidence in `artifacts/ui-audit/results.json` or `test-results/`.

| Check                                                 | Result                                                               |
| ----------------------------------------------------- | -------------------------------------------------------------------- |
| `npm run typecheck`                                   | PASS, exit 0 after generated-type cleanup described below            |
| `npm run audit:ui:static`                             | PASS, exit 0: lint plus report-only style inventory                  |
| `npm run build` with blank backend variables          | PASS, exit 0; 24 static pages generated                              |
| Production focused `issue-41.spec.ts`, `--workers=2`  | PASS: 64 passed, 0 failed, 0 skipped; 129.6 seconds                  |
| `node --test scripts/architecture-inventory.test.mjs` | PASS: 6 passed, 0 failed                                             |
| Post-separation full production audit, `--workers=1`  | FAILED: 132 passed, 4 failed, 0 skipped; 530.3 seconds               |
| Persistence / Auth / Clinical Browser / Clinical DB   | NOT RUN: Docker/local Supabase CLI unavailable; no hosted substitute |

The new complete full run began `2026-10-26T08:02:48.260Z`, with no retries or
flaky outcomes. Its only failures are the four unchanged streamed HTTP status
assertions at `measurements.spec.ts:149`. All 64 focused cases also passed within
this full run. All four complete-V1 journeys passed, including 1280px. Hydration
#418 did not recur in this daytime run; its date-sensitive cause is not fixed.
The old **131 passed / 5 failed** report remains intact and is distinguished
below, not replaced or relabeled as green. The blank-backend server still emits
the known missing-public-configuration diagnostic during signed-out guard tests;
those guard assertions pass, and the diagnostic was not suppressed.

Initial typecheck and the first build failed because generated development route
validators still imported the deleted Doctor account route. Production build
regenerated production types but did not retire stale development types. Moved
only `.next/dev/types/validator.ts` and `.next/dev/types/routes.d.ts` into temporary
storage. Build and typecheck then passed. No source declaration, compiler setting
or assertion was weakened. No broad generated-directory deletion was used.

### Historical full audit and investigation

The pre-separation complete run began `2026-10-25T20:55:30.861Z`, used one worker
and took 376.494 seconds: **131 passed, 5 failed, 0 skipped**. An older 132/4 run
is not the latest pre-separation result; a two-worker run timed out at 480 seconds
and is not a pass. A later isolated 1280px journey passed (35.3 seconds) without
fixing or erasing the five-failure evidence.

Four failures are `measurements.spec.ts:149` at all four widths: unconditional
HTTP 404 expectation versus streamed HTTP 200. Captured responses contain the
not-found marker and `noindex`; browser snapshots show 404 UI. Installed Next.js
documentation explicitly permits HTTP 200 after streaming begins. The route/test
are unchanged from remote master, whose foundation validation also records this
failure. This is a pre-existing transport-contract mismatch, not a demonstrated
Batch 1 route regression. The assertion remains unchanged.

The fifth is `secretary-flow.spec.ts:236` at 1280px, React hydration #418. The
trace locates the error during `/demo/doctor/patients` hydration, not at the
eventual zero-browser-errors assertion. Captured HTML has fixture dates
`2026-10-11`/`2026-10-25`; browser snapshots switch to
`2026-10-12`/`2026-10-26`. Module-level `demoDate()` initialization in
`lib/demo-clinic.tsx` independently seeds server and browser `initial` snapshots.
The failing journey ran after midnight in the local timezone; the three passing
widths ran before midnight. An in-memory clock probe produces this same split
from both branch and master source. Fixture/test blobs match remote master.
No separate master browser run establishes historical occurrence of this exact
error, and the precise server initialization moment is not retained. No hydration
suppression or fixture fix is included in Batch 1.

## Review gate

Batch 1 is for Draft PR review only after explicit publication authorization.
The non-green full audit and unrun backend suites remain merge gates; focused
synthetic tests are not full-stack or production acceptance. Account/Profile and
all later batches remain incomplete. Do not close Issue #41, start Batch 2, push
or open a PR as part of this local separation task.
