# Demo hydration #418 correction

## Isolation and scope

- Branch: `fix/demo-hydration-418`, based on freshly verified remote master
  `4d0695b074a30d6113a10843cfe0b1e900b84e09`.
- New isolated worktree; no other checkout was modified. Integration comparisons
  use committed Git objects only.
- Publication remains unauthorized: no pushes, PRs, merges, deployment or hosted
  Supabase access. The current authorization permits a local commit only after
  the midnight correction passes validation and final safety review.
- Clinical server actions, persistence controller, Auth, RLS, RPCs, migrations,
  dependencies and the existing Playwright configuration are unchanged.

## Root cause and red evidence

The module-level fictional fixture independently read the server and browser
calendar. `useSyncExternalStore` used each module's `initial` as its server and
hydration snapshot, violating the requirement that these contain the same data.
The Doctor Patients list exposes the different visit-date text on direct entry.

Before implementation, the new `same instant` browser regression failed against
master in development and production at 390px. The server was pinned to
`2024-02-28T23:30:00Z` in UTC and the browser to that same instant in
Asia/Damascus. Development identified `2024-02-14` versus `2024-02-15` in the
visit-date text; production emitted #418 on entry and reload. The strict empty
browser-error assertion failed as intended. The preserved production report and
trace are under `artifacts/ui-audit/hydration-418/before-*`.

## Implementation contract

- `lib/demo-fixture.ts` owns the fictional types and an explicit-calendar-date
  factory. UTC arithmetic applies only to that provided calendar date; it is not
  a replacement for the browser-local notion of today. Fixture IDs and content
  are preserved. Each call owns its fixture data, including imported history.
- `lib/demo-store.ts` separates a deeply frozen, fixed fictional-day bootstrap
  from the cached browser snapshot. Server rendering and browser hydration use
  the same clock-independent bootstrap. Browser reads then prefer validated
  saved data or fall back to the browser-local seed.
- The public key remains `mayanaa-demo-v1:public`. Persisted JSON still contains
  only `patients` and `queue`; `today` is runtime snapshot metadata, not a schema
  migration. Valid saved dates/notes are not rebased or overwritten by loading.
- The cached browser seed preserves reset and storage-clear behavior. Failed
  storage access retains the functional in-memory demo. Stable snapshot identity
  prevents repeated reads from manufacturing new state.
- The runtime calendar is separate from that seed. A single subscriber-owned
  local-midnight timer advances only `today`; focus, visible resume and pageshow
  catch missed timers. The last unsubscribe removes the timer and listeners.
  Calendar updates never persist, reseed patients/queue, or overwrite appointments.
- `lib/demo-clinic.tsx` retains its provider/hooks and existing type export names.
  Mutable browser stores are shared by scope, never across server requests.
- Demo age and rendered appointment defaults/minimums use the snapshot's date.
  Authenticated branches still use their original year/service-date inputs;
  authenticated mutation-time validation and note autosave are unchanged. Demo
  review opening and final confirmation recheck the current local calendar,
  preserving custom dates and rejecting dates that are no longer after today.
- No hydration suppression, console-error filtering, storage clearing, route
  disabling or test-only switch in production application code was added.

The initial HTML deliberately shows a stable fictional date until React switches
to browser-local data after hydration. This small bootstrap-to-live date update
also applies when loading an existing saved demo. Human visual acceptance of
that transition remains a review consideration. The browser seed stays anchored
for reset compatibility, while runtime `today` advances independently. There is
no automatic midnight reset or rebasing of saved fixture records.

## Historical validation before the same-session correction

| Check                                                                        | Result                                                                 |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Regression on unmodified master, development                                 | Failed on the exact hydration text mismatch                            |
| Regression on unmodified master, production                                  | Failed with #418                                                       |
| Fixture/store contract tests                                                 | 10/10 in UTC, Asia/Damascus and Pacific/Honolulu: 30 executions passed |
| Development deterministic browser suite, final run                           | 44 passed, zero skipped/flaky                                          |
| Production build with blank backend configuration and pinned server calendar | PASS                                                                   |
| Production build with blank backend configuration and normal wall clock      | PASS                                                                   |
| Production deterministic browser suite, pinned-calendar build                | 44 passed, zero skipped/flaky                                          |
| Production deterministic browser suite, normal-clock build                   | 44 passed, zero skipped/flaky                                          |
| Existing Secretary V1 and architecture browser regressions, production       | 32 passed, zero skipped/flaky                                          |
| Typecheck                                                                    | PASS                                                                   |
| Lint and static UI audit                                                     | PASS; style inventory is informational                                 |
| Architecture inventory self-tests                                            | 6 passed                                                               |
| Fixture-content comparison against master at three explicit dates            | Identical JSON data                                                    |

Browser coverage spans 320/390/768/1280px: different timezones at the same
instant, same-timezone midnight, month/year/leap-day boundaries, direct Doctor
Patients/history/plan routes, custom/default appointments and minimums, empty,
valid, malformed, structurally invalid and unavailable storage, note autosave,
reload, reset, cross-tab updates and back/forward navigation. Strict browser-error
assertions and external-request/mutation rejection remain enabled.

The test-only server clock preload pins no-argument calendar construction before
Next loads application modules without freezing timers or `Date.now()`. It is
used only by the dedicated test configuration/build command, never imported by
the application. Reports/traces use existing ignored UI-audit output paths.

Repeatable checks (PowerShell):

```powershell
# Repeat with TZ=UTC, Asia/Damascus, Pacific/Honolulu and America/New_York.
node --test tests/demo-hydration/store.test.mjs
npx --no-install playwright test --config=playwright.demo-hydration.config.ts

$env:NEXT_PUBLIC_SUPABASE_URL = ''
$env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = ''
$env:SUPABASE_SECRET_KEY = ''
npm run build
$env:UI_AUDIT_PRODUCTION = '1'
npx --no-install playwright test --config=playwright.demo-hydration.config.ts
npx --no-install playwright test --config=playwright.config.ts tests/ui-audit/secretary-flow.spec.ts tests/ui-audit/architecture-foundation.spec.ts --workers=1
npm run typecheck
npm run audit:ui:static
node --test scripts/architecture-inventory.test.mjs
```

For the pinned-calendar build, additionally set `TZ=UTC` and `NODE_OPTIONS` to
`--require="<absolute-forward-slash-path>/tests/demo-hydration/server-clock.cjs"`
before building; clear both before a normal-clock build. The dedicated browser
config already pins the server calendar and browser timezone independently.

Intermediate test-harness failures were not counted as passes: an invalid
waiting-visit test target was replaced with an eligible saved fictional visit;
navigation checks now await their actual destination, and edits wait for the
post-hydration date before typing. The first development-wide run also recorded
40 passes and four 320px failures because the Next development portal intercepted
the fixed footer link. Tests use the identical top navigation destination rather
than forcing clicks through that overlay. Original UI-audit tests are unchanged.

Expected missing-backend diagnostics appeared in passing signed-out guards.
Docker and Supabase CLI are unavailable; real-backend Auth/Persistence/Clinical
DB-RLS/Clinical Browser tests were not executed. No hosted fallback was used.
The full unrelated UI audit and physical-device/manual assistive-technology
acceptance were not executed. This report does not mark the full audit green or
claim to correct the separate HTTP-status failures.

## Same-session midnight correction and current validation

The final safety review stopped the original local commit: runtime `today` was
anchored with the seed, while completion validation still read the live clock.
After a loaded session crossed midnight, an empty/default appointment and its
minimum could remain on today and be rejected by completion.

Before this correction, the new same-document browser test failed at 390px:
after crossing February 29 to March 1, the input minimum remained `2024-03-01`
instead of `2024-03-02`. Its report/trace are preserved under
`artifacts/ui-audit/hydration-418/midnight-before-*`. Three added store tests also
failed for calendar reads, the midnight timer and resume notifications.

The correction keeps the frozen hydration bootstrap and original seed intact.
Only live snapshot metadata advances. Rendered defaults, minimums and demo action
validation agree; the final local write rechecks dates even if confirmation was
opened before midnight and no timer/resume callback has run. Custom dates are
never silently replaced. A custom date that becomes today is retained but must
be explicitly corrected before completion. Authenticated operations return
through their original branch before this demo-only final-write check.

Current checks:

| Check                                                                            | Result                                   |
| -------------------------------------------------------------------------------- | ---------------------------------------- |
| Fixture/store tests in UTC, Asia/Damascus, Pacific/Honolulu and America/New_York | 16/16 per timezone; 64 executions passed |
| Same-document development recheck at 390px                                       | 5 passed                                 |
| Complete development hydration/calendar suite, final run                         | 64 passed, zero skipped/flaky            |
| Production build with blank backend configuration                                | PASS                                     |
| Complete production hydration/calendar suite                                     | 64 passed, zero skipped/flaky            |
| Existing production Secretary V1/architecture browser regressions                | 32 passed, zero skipped/flaky            |
| Typecheck, lint and static UI audit                                              | PASS; style inventory is informational   |
| Architecture self-tests                                                          | 6 passed                                 |

New browser cases advance the same loaded document across midnight, complete
visits with defaults/custom future dates, reject custom dates that become today,
and verify no calendar-only storage writes. Additional cases model missed timers
followed by focus/visibility/pageshow and confirmation crossing midnight without
any timer/resume signal. Store tests also cover stable snapshots, shared
subscribers, cleanup and local DST boundaries. This is deterministic simulated
browser lifecycle coverage, not a claim of physical-device sleep testing.

The first expanded development run recorded 59 passes and five 320px failures:
the same known development portal intercepted the fixed completion button. The
new footer-button checks therefore use ordinary keyboard activation in
development and ordinary pointer clicks in production. No forced clicks, hidden
overlays, widened timeouts, ignored console errors or relaxed assertions are used.
The production matrix above includes all five midnight/resume cases at all four
widths using pointer actionability. The earlier failed development report remains
preserved separately rather than being counted as a pass.

Final source reviews found no blocking standards violation or new behavioral/data
integrity regression after this correction. Existing authenticated date inputs and
operations are unchanged; reviewed files contain no credentials or machine-local
absolute paths. The staged scope must remain the original ten source/test/report
files, excluding all generated evidence. Docker-dependent authenticated suites,
physical-device sleep/resume and manual visual/accessibility acceptance remain
outside the executed checks; no shared or hosted backend was used.

## Integration risks

- **PR #52, Preview Routing:** independent route/test changes; no fixture/store
  overlap. Its HTTP-status correction is not included here.
- **PR #53, Batch 1:** shares `clinic-flow.tsx`, but its component/navigation
  changes differ from the demo age expression. Preserve its imports, interfaces
  and persisted wrappers during later integration and rerun both suites.
- **PR #54, Batch 2:** shares `clinic-flow.tsx`, but its handoff/actions regions
  are separate. Retain event-only feedback and presentation-only removal.
- **Single-active Patient, `c253546`:** substantial store ownership conflict.
  This branch extracts the store from `demo-clinic.tsx`, while Single-active adds
  locking, asynchronous writes/handoff outcomes, draft keys, `saveVisit` and reset
  cleanup there. Deliberately port those semantics to the extracted store without
  losing the fixed hydration snapshot, runtime date metadata or persisted shape.
  `visit-screen.tsx` also overlaps its autosave changes; this correction must not
  replace those handlers. No integration has been attempted.
- **Doctor Polish, `4623617`:** overlaps shared clinic UI and demo route
  composition. Reconcile after the foundational fixes; do not overwrite this
  provider/calendar contract or copy the branch's other presentation changes.

Recommended approval/integration order: Preview Routing (#52) independently,
this corrected hydration/calendar change, Batch 1 (#53), Batch 2 (#54), then
deliberate Single-active Patient store reconciliation and Doctor Polish. Rerun
the combined suites at every shared-file integration. This is a recommendation,
not authorization to merge any branch.

The authorized local commit is gated on current validation and final safety
review. Publication, integration, merge and deployment remain separate approvals.
