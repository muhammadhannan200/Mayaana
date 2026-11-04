# PR #55: CI document-title investigation

## Disposition

The blocking title failure is **pre-existing on unchanged master**, not introduced
by the Demo hydration/calendar fix. Do not change application metadata or relax
accessibility checks in PR #55 to force CI green. Keep the PR in Draft until the
owner approves a separate fix or an explicit baseline disposition.

Investigated commits:

- PR head: `a6b853ac0972fa79452adeb45805a60b2324a64e`.
- Freshly fetched `origin/master`: `4d0695b074a30d6113a10843cfe0b1e900b84e09`.
- Both were unchanged throughout this investigation. No commits, pushes, merges,
  deployment commands, database operations, or changes to other worktrees.

## Exact CI failure

[UI Audit run 40662605803](https://github.com/muhammadhannan200/Mayaana/actions/runs/40662605803)
at the PR head finished **69 passed / 3 failed**. Downloaded artifact:
`ui-audit-results`, ID `12805175208`; its JSON report, screenshots, error contexts
and all three failure traces were inspected.

All failures are the complete-V1 journey at 390/768/1280px:

- `tests/ui-audit/secretary-flow.spec.ts:87`: open `/demo/doctor` in a new tab.
- Line 88: click the current patient's “فتح الملف” link.
- Line 89: call `checkSurface(doctor)`.
- The destination is `/demo/doctor/patients/demo-noor` (fictional patient).
- `checkSurface` line 5 successfully checks a non-empty title, but the final
  `expect(result.violations).toEqual([])` at line 13 fails with axe's serious
  `document-title` violation: no non-empty `<title>` in the document.

The violation belongs to the main application document, not axe's temporary
`about:blank` result-aggregation page or an iframe.

The trace explains the apparently contradictory assertions. In the 390px CI
trace, the title assertion passes at approximately 74781ms while snapshots still
show `/demo/doctor`. Navigation reaches the patient URL at approximately 75193ms;
axe's `runPartial` starts at approximately 75196ms. The other two traces likewise
show the title/RTL prechecks completing on Doctor home and the scan overlapping
the transition. These are trace-relative times, not wall-clock durations.

## Confirmed cause and metadata path

The test starts its accessibility scan before the client navigation is settled.
Its generic non-empty-title and RTL checks can both pass on the outgoing Doctor
home. During the Next.js route/metadata transition, the old hoisted title is
removed before the destination's identical title is available. Axe can sample
that real titleless interval. The title returns without any application or
storage change; this is not a permanently untitled patient page.

Direct browser MutationObserver evidence records:

```text
before scan: Doctor home, title = Mayaana — V1 Demo
navigation: patient URL, no title elements, document.title = ""
later:      same patient URL, title restored in HEAD
axe result: document-title (depending on when the scan samples the transition)
```

Observed failing reduced PR runs had approximately 590ms and 600ms titleless
intervals; failing master probes also captured approximately 730ms and 742ms
intervals. These timings vary and are not timeout recommendations.

Source tracing:

- `app/layout.tsx:19` exports a non-empty Arabic root title.
- `app/demo/layout.tsx:2` exports static metadata overriding it with
  `Mayaana — V1 Demo`, plus noindex/nofollow.
- `app/demo/[[...path]]/page.tsx` asynchronously awaits route params and renders
  the shared demo provider/screen. It does not override the title.
- There is no application `generateMetadata`, `document.title` assignment,
  explicit `<title>`, or route-specific `loading.tsx` on this path. No patient
  data or authenticated backend request is needed to resolve its static title.
- Installed Next.js 16.4.1 documentation describes root-to-leaf metadata
  overriding and separate metadata streaming. The installed metadata renderer
  resolves metadata asynchronously under `MetadataBoundary` / `Next.Metadata`
  Suspense and hoists tags out of a hidden wrapper. Cache Components and Partial
  Prefetching are enabled in the unchanged configuration.
- The observed removal/restoration is a Next/React navigation metadata lifecycle
  effect, not a browser-local store writing the title. This investigation does
  not identify an upstream internal framework defect or establish that disabling
  any particular framework feature is an appropriate fix.
- Root/demo layouts, demo page, framework configuration, dependency lockfile,
  Playwright configuration and the failing test are identical between master and
  PR #55. The reduced reproduction also fails without any Secretary operations,
  custom storage state, calendar simulation, or a hydration error.

## Master-versus-PR experiment

A standalone `git archive` of the fetched master was created outside the working
tree. It is not another Git worktree. Its own dependencies were installed from
the unchanged lockfile. All 144 tracked snapshot files were verified against
master's Git blobs, allowing only Windows text CRLF normalization.

The exact original test was run with `CI=true`, development mode, two workers,
blank backend configuration, Chromium and the three failing viewport widths.
The baseline used another localhost port and external output paths; assertions
and application source were unchanged.

| Experiment                                                                                          | PR head             | Unchanged master                        |
| --------------------------------------------------------------------------------------------------- | ------------------- | --------------------------------------- |
| Original complete-V1 journey, clean focused run                                                     | 3 passed            | 2 passed / 1 failed                     |
| Original journey failure on master                                                                  | —                   | 1280px, same line 89 / `document-title` |
| Reduced home → patient navigation + unchanged full axe assertion, 3 repeats per width               | 7 passed / 2 failed | 6 passed / 3 failed                     |
| Reduced diagnostic control awaiting destination URL, patient heading and exact title, then full axe | 9 passed            | 3 passed                                |
| Direct patient entry + full axe                                                                     | 3 passed            | Not rerun                               |

The original PR CI failures and reduced failures remain failures; later passing
runs do not erase them. Counts from the reduced probes measure timing-sensitive
reproduction, not statistically comparable failure probabilities.

The control uses retrying assertions on the actual destination URL, its patient
heading and its exact title. It does not sleep, retry axe until green, suppress
console errors, disable rules, alter metadata, or change the empty-violations
expectation. It demonstrates a settled destination is accessible; it does not
prove title continuity during loading and must not hide that separate concern.

The local environment matches CI's Node 24, installed dependency versions,
development server, workers and browser engine. It is Windows rather than
Ubuntu, so this is not a complete OS-equivalence claim.

## Validation and experimental limitations

- Fresh `npm run typecheck`: PASS.
- Fresh `npm run lint`: PASS.
- Fresh blank-backend `npm run build`: PASS.
- `git diff --check`: PASS before adding this report; rechecked at completion.
- Existing unchanged-head evidence reused: 64 development hydration/calendar
  passes, 64 production hydration/calendar passes, 32 production Secretary/
  architecture passes, 64 store executions and 6 architecture self-test passes.
  None is a replacement for the failed full development CI audit.
- Prior GitHub checks already passed Auth, Persistence, Clinical DB/RLS, clinical
  cross-session browser coverage, code quality and security checks. No hosted
  backend was contacted for local diagnosis.
- The initial local run reproduced line 89 but was otherwise confounded by a
  separate Windows Turbopack file-lock crash while large extracted traces were
  read inside the source tree. That run is excluded from the comparison table.
  Evidence was moved outside the source tree before the clean comparisons.
- Initial baseline harness setup attempts (external node_modules junction and
  runner-instance mismatch) failed before executing tests. They are not counted
  as application failures. An independent install and correct runner resolved
  the setup problems without changing baseline source.

Downloaded traces, reports and clearly marked diagnostic probe/config files are
retained outside the worktree in `mayaana-pr55-ui-investigation`. No diagnostic
instrumentation was added to application or existing test files.

## Recommended next action

1. Open a separately approved test/navigation follow-up: assert the intended
   destination URL and patient heading before its title and full accessibility
   scan. Retain every accessibility rule and the empty-violations assertion;
   cover delayed client navigation explicitly rather than adding time delays.
2. Track title continuity during pending navigation separately. The titleless
   interval is observable on master; settling the test is not a declaration that
   loading-state accessibility is correct. A framework/configuration workaround
   requires its own reproduction, scope review and approval.
3. Keep PR #55 Draft. Either land the approved baseline fix through the normal
   review process or have the owner explicitly disposition this known baseline
   failure. Do not call the full CI audit green or rerun until lucky.
4. Preserve existing physical-device/manual acceptance and future Single Active
   Patient/UI integration gates. No integration is authorized by this report.

Only this local investigation report was added to the branch. No application,
metadata, dependency, workflow or test expectation changes are proposed here.

## Authorized test-synchronization follow-up

The sections above preserve the original read-only investigation. The owner
subsequently authorized the scoped test correction described here and a local
commit after validation, but not a push, merge, deployment or migration.

### Correction

`tests/ui-audit/secretary-flow.spec.ts` retains `checkSurface` and every existing
accessibility assertion. Its optional destination description adds three
preconditions, used at the previously failing Doctor-home → patient navigation:

1. The URL is exactly `/demo/doctor/patients/demo-noor`.
2. The unique exposed level-one heading is exactly `نور الحسن`.
3. The document title is exactly the non-empty `Mayaana — V1 Demo`.

Only then do the original non-empty-title, RTL, overflow, complete axe analysis
and empty-violations assertions run. Existing screenshots, traces, error/mutation
collection, viewports, timeouts, workers and reporters are unchanged. The test
does not sleep, force a click, rerun axe until it passes, or exclude any rule.

### Focused regression

The new `patient accessibility scan waits for the destination navigation` test
holds the actual destination network response with an explicitly released
promise. It checks that the still-visible outgoing Doctor page has its valid
title/heading and that no axe scan has started there. After releasing the
response, it verifies that the sole scan starts at the destination URL and runs
the real full axe analysis with the existing empty-violations assertion.

A temporary wrapper observes the public `AxeBuilder.analyze` entry point and
always delegates to the original implementation; it does not fabricate results.
The wrapper and response gate are restored/released in `finally`. Cleanup drains
an outstanding audit without overriding an assertion failure already in flight.

Before the synchronization change, the new test failed at 390px with the same
`document-title` violation. After the change, it passed at all four configured
widths (320/390/768/1280). This is new regression coverage, not a retry of the old
journey until lucky.

### Application concern remains unresolved

The pre-existing titleless interval during pending client navigation is **not
fixed** by this test correction. The correction identifies the page whose
settled accessibility is being audited; it does not establish title continuity
through loading, suppress transition accessibility concerns, or change any
application metadata. That behavior still requires its own approved application/
framework follow-up. Any genuine axe violation after the destination preconditions
pass remains a hard failure and blocks this change.

### Follow-up validation

The baseline comparison uses the same standalone master archive, applying only
the identical test-file correction; master's application, dependencies and
configuration remain unchanged. Git-blob checks confirm the corrected test is
the only changed tracked baseline file, and its content matches the PR test
(allowing Windows text line endings).

| Check                                                                    | Fresh result                                                                              |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Request-gated regression before correction, 390px                        | Failed with the original `document-title` violation                                       |
| Request-gated regression after correction, all four widths               | 4 passed                                                                                  |
| Full PR development UI audit, `CI=true`, two workers                     | 76 passed, zero skipped/flaky                                                             |
| Same full development audit on master plus the identical test correction | 75 passed / 1 unrelated guard-test timeout                                                |
| Corrected Secretary tests within that master audit                       | 16 passed, including all four complete-V1 journeys and all four request-gated regressions |
| Isolated unchanged master 320px guard test, original timeout/assertions  | 1 passed in 9.4 seconds                                                                   |
| PR production Secretary/architecture browser suite, two workers          | 36 passed, zero skipped/flaky                                                             |
| Typecheck and lint                                                       | PASS                                                                                      |
| Blank-backend production build                                           | PASS                                                                                      |
| Formatting and diff checks                                               | PASS                                                                                      |

The master audit's sole failure was
`architecture-foundation.spec.ts:90`, the unchanged 320px signed-out route-guard
test exceeding its original 30-second budget. Two complete development audits
were running concurrently on this Windows host. Its trace shows cumulative
navigation delays, including approximately 6.8 seconds and 8.7 seconds for the
two unknown-record routes. No title/axe failure was reported; the trace records
the expected redirect/login assertions and empty-storage assertion completing,
but the overall deadline had already elapsed. Host contention is a plausible
contributor, not a separately proven framework root cause.

A single isolated diagnostic execution of that unchanged guard passed using the
same 30-second limit, without application changes, widened timeouts or enabling
Playwright retries.
The original 75/76 result is preserved; it is **not** relabeled a clean 76/76
baseline run. The navigation-test parity claim is specifically supported by
the corrected Secretary tests passing on both application revisions.

Expected blank-backend diagnostics occurred in passing signed-out guard checks.
No genuine accessibility violation remained after the destination preconditions
passed. The current local validation supports another CI run once publication
is separately authorized; it does not mark the existing failed GitHub run green
or guarantee Ubuntu timing from Windows measurements.

Only the corrected test file and this preserved/extended investigation report
belong in the authorized local commit. Application/clinical/Auth/database files,
dependencies, existing Playwright configuration and workflows are unchanged.
PR #55 remains Draft at its published head until a later authorized push. No CI
rerun on GitHub, push, merge, deployment or migration is performed by this follow-up.
