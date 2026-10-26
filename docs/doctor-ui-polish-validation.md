# Doctor UI focused improvement pass

Date: 2026-10-26. Branch: `feature/doctor-ui-polish`.

## Baseline and isolation

- Dedicated worktree: `mayaana-doctor-ui` in the OpenCode temporary directory.
- Base: Issue #41 Batch 1 checkpoint `de1e04d`. Its merge base with remote
  master is `4d0695b`, which was confirmed as the current remote master before
  creating this worktree. This branch depends on the preserved Batch 1 work.
- The original worktree and Issue #41 worktree were inspected read-only.
  Their uncommitted changes were not copied, reverted or modified.
- Issue #41's separate Account/Profile backup and existing account/staff pages
  were not edited. No backend, auth, role, migration or environment-file changes.

## Design evidence and changes

Exact Figma references were read with MCP; D1, D3 and D4 were exported for
side-by-side inspection with actual browser screenshots:

| Surface | Figma node | Before / after |
| --- | --- | --- |
| Doctor navigation | `117:132` | Public demo's three-item queue-icon navigation now reuses Batch 1's four-item Doctor navigation and exact active/inactive SVGs. Search uses the existing patient-search surface. Nav spacing, active text, keyboard focus and 56px targets match the reference. Live destinations remain unchanged. |
| D1 dashboard | `142:991`, current card `142:1006` | Replaced the stretched visit-type pill with a compact visit/weight summary; added the exact door icon. Aligned current-card spacing, queue number tiles, waiting/ready status pills and metadata. Kept real counts, all current-patient entries and existing record links. |
| D3 patients | `181:3823` | Moved the existing count into the header, applied the soft search surface, 16/24 semibold patient names, 12/16 metadata, 40px avatars, 18px chevrons and consistent row spacing. Existing filtering and patient links remain functional. |
| D4 patient record | `181:3909` | Right-leading 44px back target, goal subtitle, Figma target icon, 14px progress heading, aligned weight/baseline/unit hierarchy, grouped record sections and smaller metric units. Existing information, measurements, history and visit access remain intact. |
| Doctor primary buttons | D4 primary button instance `199:2322` | Doctor-workspace-only typography now uses 16px / 700 / 24px. Secretary and account styling is unchanged. |

The only added demo URL is `/demo/doctor/search`; it reuses the existing search
implementation rather than introducing a new feature or state model.

### Explicitly preserved differences

- Doctor Account still uses existing `/doctor/staff` in the live app and the
  existing `/demo/secretary/account` fallback in the demo. A correct role-specific
  demo account remains dependent on the excluded Account/Profile work.
- D1 retains today's count rather than claiming an unsupported weekly metric.
  Current-card navigation still opens the patient record, preserving its behavior.
- No new D2, D5-D7 screens, record tabs, attachment UI, notifications, appointment
  sections, patient filters or new-patient action were implemented.
- D4 still presents the existing combined record, not full Figma screen parity.
- The 390px centered shell is retained at desktop width; no desktop redesign
  is inferred from mobile-only Figma references.

## Validation

Final checks:

- PASS: `npm run typecheck`.
- PASS: `npm run lint`.
- PASS: `npm run build`, with Supabase environment values blank.
- PASS: Impeccable mechanical detector on changed UI files; no findings.
- PASS: `git diff --check` and review of all task changes.
- PASS: 48 targeted Playwright cases, zero skipped, unexpected or flaky cases,
  in 235.2 seconds. Command:

```sh
npx playwright test tests/ui-audit/doctor-ui.spec.ts tests/ui-audit/issue-41.spec.ts tests/ui-audit/secretary-flow.spec.ts --project=chromium-390 --project=chromium-1280 --workers=1
```

This includes 10 new Doctor cases, 32 unchanged Issue #41 fixture cases and
6 unchanged Secretary-to-Doctor regression cases. Checks include navigation,
active states, icon loading, RTL alignment, overflow, touch targets, keyboard
focus, filtering, empty results, visit entry/reload, long Arabic names, mixed
numeric content and axe accessibility scans. Public demo tests use isolated
browser-local fictional data; the long-name case observes zero backend writes.
Issue #41 fixtures substitute server-action boundaries and do not prove hosted
backend behavior.

First run: 43 passed / 5 failed. Four failures were new-test mistakes: selectors
included hidden retained Next pages and an incorrect expectation that all three
queue patients were waiting (two wait, one is ready). The tests were corrected
to use the visible main landmark and the actual existing seed states. One
unchanged Secretary journey timed out at its previous-measurement dialog check;
it passed unchanged in the complete final run. It is not claimed fixed.
No existing test or shared fixture was modified or weakened.

### Screenshot evidence (local, uncommitted)

- Figma exports: `artifacts/doctor-ui/figma/{d1,d3,d4}.png`.
- Baseline: `artifacts/doctor-ui/before/{d1,d3,d4}-{390,1280}.png`.
- First implementation inspection: `artifacts/doctor-ui/after/` (D4 images there
  precede the final metric-unit refinement).
- Final screenshots: `test-results/doctor-ui-*/{d1,d3,d4,search}.png`, separated
  by `chromium-390` and `chromium-1280` directories.
- Final machine-readable results: `artifacts/ui-audit/results.json`.
- First-run results retained as `artifacts/doctor-ui/first-run-results.json`.

Rendered screens were inspected at 390px and 1280px. The 1280px shell and nav
both measured 390px wide at x=445px; the 390px shell and nav measured x=0px.
No document horizontal overflow was observed. Full-page screenshots retain
fixed navigation at the original viewport boundary, not at the image bottom.

## Remaining verification and integration notes

- No authenticated Supabase browser/DB suite was run: Docker and Supabase CLI
  were unavailable. No hosted service or real clinical data was substituted.
- Browser checks were desktop Chromium at mobile/desktop widths, not physical
  iOS/Android keyboard or notch/safe-area testing. Safari/Firefox are unverified.
- No full UI-audit run is claimed; the focused suites above are the evidence.
- Dependency install reported one high-severity advisory; dependencies and
  lockfile were not changed as part of this UI-only task.
- No textual conflict with Issue #41 was introduced because this branch starts
  from its committed checkpoint. Both tasks touch Doctor sections inside
  `app/secretary/clinic-flow.tsx` and `DoctorNav` in `clinic-ui.tsx`; later #41
  changes to those sections will need integration review. Shared SecretaryNav,
  persisted controllers, auth, account/staff code and existing fixtures remain
  unchanged.
- No qualifying Next.js feedback candidate was retained from this pass.
- Local validation only: no push, PR, merge, deployment or issue updates.
