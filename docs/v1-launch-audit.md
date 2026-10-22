# V1 launch/demo audit

Source: Figma `dZPtsNiHOfyhqRgHb6H0yx`, section `181:5616`, plus explicitly named V1 continuation frames on canvas `65:147`. Audited actual `ClinicFlow`, `MeasurementScreen`, `DoctorVisit`, login and route implementations, not route existence. Desktop retains the centered mobile composition. No merge authorized.

## 1. Screen coverage

Routes below use `/demo` for the public fictional demo; unprefixed core routes require existing authentication. **READY** = implemented, functional and visually close for the demo, not production persistence. **PARTIAL** = implemented functional core but visibly simplified Figma (omissions described per row). **DEFERRED** = intentionally outside the core demo (including absent screens); **MISSING** = absent required core screen. Rendered comparisons are recorded in section 3; live authenticated login is not claimed verified.

Final frame counts (duplicates counted separately): **READY 12 / PARTIAL 14 / MISSING 0 / DEFERRED 29**; 55 total.

| Figma screen                                  | Node ID  | Route / component                                        | Implemented / functional / visual                                         | Status   |
| --------------------------------------------- | -------- | -------------------------------------------------------- | ------------------------------------------------------------------------- | -------- |
| 00 Login                                      | 118:3    | `/`, `LoginForm`                                         | Email auth differs from Figma phone/recovery; exact artwork restored      | PARTIAL  |
| 00 Login (alternate)                          | 181:3622 | `/`, `LoginForm`                                         | Same email-auth UI; recovery remains administrator-assisted               | PARTIAL  |
| S1 Queue                                      | 142:607  | `/demo/secretary`, `ClinicFlow`                          | Queue, totals, intake and state actions implemented                       | READY    |
| S1 Queue (variant)                            | 181:4813 | Same                                                     | Waiting/ready variants implemented                                        | READY    |
| S1 Queue (variant)                            | 181:4591 | Same                                                     | Multiple status groups implemented                                        | READY    |
| S1b After Send-In — Patient With Doctor       | 181:2682 | `/demo/secretary?sent=1`                                 | Explicit handoff and doctor group work                                    | READY    |
| S2 Add to Queue — Search                      | 118:226  | `/demo/secretary/search`                                 | Name/phone search and new-file recovery                                   | READY    |
| S3 Add to Queue — Confirm                     | 118:276  | `/demo/secretary/confirm?patient=<id>`                   | Type selection, duplicate prevention and enqueue                          | READY    |
| S4 New Patient File                           | 119:66   | `/demo/secretary/patients/new`                           | Validated form; first full exam enforced                                  | READY    |
| S5 Measurement — Follow-up                    | 143:1177 | `/demo/secretary/measurements/follow-up?entry=<id>`      | Localized weight validation and history                                   | READY    |
| S5b Previous Visit Measurements               | 143:1275 | `/demo/secretary/measurements/previous?entry=<id>`       | History sheet and local editing                                           | READY    |
| S6 Measurement — Full Exam                    | 119:206  | `/demo/secretary/measurements/full-exam?entry=<id>`      | Nine fields, validation, draft and save                                   | READY    |
| S8 Patient File (Secretary View)              | 157:1410 | No dedicated screen; list currently opens intake confirm | Not core to intake/measure/handoff                                        | DEFERRED |
| S9 My Account (Secretary)                     | 157:1531 | `/demo/secretary/account`                                | Demo notice/reset only, not full account UI                               | DEFERRED |
| D1 Home (Doctor)                              | 142:991  | `/demo/doctor`                                           | Live queue/current/completed; weekly/overdue modules omitted              | PARTIAL  |
| D2 This Week Patients                         | 120:264  | None                                                     | Non-core appointment list absent                                          | DEFERRED |
| D3 All Patients                               | 181:3823 | `/demo/doctor/patients`                                  | Search/list works; richer Figma row metadata omitted                      | PARTIAL  |
| D3 All Patients (variant)                     | 181:5109 | Same                                                     | Same simplified list                                                      | PARTIAL  |
| D4 Patient Record — Profile                   | 181:3909 | `/demo/doctor/patients/<id>`                             | Identity, measurements/history and today CTA; no record tabs              | PARTIAL  |
| D5 Patient Record — Progress                  | 181:4019 | None                                                     | History exists; chart/tab deliberately absent                             | DEFERRED |
| D6 Patient Record — Visits                    | 181:4143 | History section in patient file                          | Read-only history summary; separate tab deferred                          | PARTIAL  |
| D6 Patient Record — Visits (variant)          | 181:5493 | Same                                                     | Same simplified summary                                                   | PARTIAL  |
| D7 Previous Visit Details                     | 181:4238 | No dedicated doctor history detail                       | Secretary history sheet exists; doctor expansion deferred                 | DEFERRED |
| D8 Today Visit — Measurements & Notes         | 122:340  | `/demo/doctor/visits/<entry>`, `DoctorVisit`             | Notes/measurements persist; uploads/camera intentionally omitted          | PARTIAL  |
| D9 Today Visit — Diet Plan & Next Appointment | 122:422  | Same, `?step=plan`                                       | Days/meals/date work; prior-plan copy omitted                             | PARTIAL  |
| D9b Add Meal                                  | 142:1326 | Inline editor on D9                                      | Add/edit works; inline rather than separate screen                        | PARTIAL  |
| D10 Finish Visit — Quick Review               | 122:533  | Native review dialog on D9                               | Finish/read-only completion works; simplified review                      | PARTIAL  |
| D11 Account & Settings                        | 122:692  | Demo account notice; signed-in `/doctor/staff`           | Full settings not implemented                                             | DEFERRED |
| D12 Search                                    | 127:1877 | Search integrated into `/demo/doctor/patients`           | Functional search, separate layout/navigation deferred                    | PARTIAL  |
| D14 Expected & Overdue — View All             | 158:1848 | None                                                     | Follow-up scheduling outside demo                                         | DEFERRED |
| E1 Empty Queue                                | 181:4512 | Empty-state branch in `/demo/secretary`                  | Implemented when waiting list empty                                       | READY    |
| E2 No Search Results                          | 122:903  | Secretary/doctor search                                  | Recovery copy and new file CTA on secretary                               | READY    |
| E4 Confirm Delete Day                         | 122:1087 | D9 delete action                                         | Functional native confirmation added; custom Figma overlay deferred       | PARTIAL  |
| V1-01 Forgot Password — Verification Code     | 146:813  | None                                                     | Existing login directs to administrator instead                           | DEFERRED |
| V1-02 New Password                            | 146:846  | `/change-password`                                       | Existing authenticated password change, not recovery flow                 | DEFERRED |
| V1-03 Onboarding — Clinic Details             | 146:893  | None                                                     | Provisioned clinic demo; onboarding absent                                | DEFERRED |
| V1-04 Onboarding — Secretary Account          | 146:943  | `/doctor/staff` provisioning                             | Full onboarding absent                                                    | DEFERRED |
| A1 Name & Specialty                           | 195:1154 | None                                                     | Full account editing absent                                               | DEFERRED |
| A2 Change Phone Number                        | 195:1212 | None                                                     | Not core                                                                  | DEFERRED |
| A3 Verify New Number                          | 195:1245 | None                                                     | Not core                                                                  | DEFERRED |
| A4 Change Password                            | 195:1276 | `/change-password`                                       | Existing secure form, different Figma composition                         | DEFERRED |
| A5 Full Exam Frequency                        | 196:1153 | None                                                     | Advanced preference absent                                                | DEFERRED |
| A6 Secretary Account                          | 196:1269 | `/doctor/staff`                                          | Existing provisioning, not final settings screen                          | DEFERRED |
| A7 Reset Secretary Password                   | 196:1365 | `/doctor/staff`                                          | Existing staff action, not dedicated Figma form                           | DEFERRED |
| A8 Confirm Logout                             | 196:1492 | Existing sign-out actions                                | Logout works without Figma confirmation                                   | DEFERRED |
| A9 Changes Saved                              | 196:1605 | Existing action feedback                                 | Dedicated settings success state absent                                   | DEFERRED |
| V1-06 Secretary Account                       | 146:1969 | `/doctor/staff`                                          | Existing provisioning; full settings deferred                             | DEFERRED |
| V1-07 Patient Options Menu                    | 146:2065 | None                                                     | Edit/archive menu absent, not core                                        | DEFERRED |
| V1-08 Edit Patient Details                    | 146:2225 | None                                                     | Intake creates files; later editing deferred                              | DEFERRED |
| V1-09 Confirm Archive                         | 146:2301 | None                                                     | Archive absent, not core                                                  | DEFERRED |
| V1-10 Today Visit — Patient Instructions      | 147:899  | Doctor notes only                                        | Separate patient-facing instructions deferred; no unsupported field added | DEFERRED |
| V1-11 Finish Visit + Send Plan                | 147:994  | D10 local completion only                                | Sending intentionally absent                                              | DEFERRED |
| V1-12 Plan Preview (Patient View)             | 147:1159 | None                                                     | Patient sharing/PDF outside scope                                         | DEFERRED |
| V1-13 Share Plan                              | 147:1222 | None                                                     | Real delivery outside scope                                               | DEFERRED |
| V1-14 Saved & Sent                            | 147:1333 | Local completed state only                               | No false sent claim; delivery deferred                                    | DEFERRED |

Arbitrary Frame 23–33 annotation boards are not screens; V2/V3 excluded. No top-level S7/D13/V1-05 exists in the audited source.

## 2. Core flow audit

Browser audit exercised existing/new patient → confirm → validated measurements → ready → explicit handoff → same doctor file → notes → plan/add/edit meal → appointment → review → completed, using one browser-local store with tab storage events. Duplicate enqueue and repeated finish are guarded. Completed visits are read-only. Reload retained measurement drafts/history edits, notes, saved meals, date and completion; a second tab reflected handoff/completion/reset. Existing-patient, new-patient and recovery tests each passed during auditing; shared-process/server interruptions require the clean final results below, not an aggregate claim from those runs.

Login is real configured authentication, while `/demo/secretary` intentionally bypasses it without granting protected-route access. Signed-out guards are checked. Successful live authenticated login/role sessions need provisioned credentials and are **not E2E-verified here**; issue #20 remains out of scope. Public browser-local demo readiness is not production clinical-data readiness.

## 3. Visual QA

Compared rendered 390px screenshots with exported final D3 `181:5109`, D4 `181:3909`, D8 `122:340`, D9 `122:422`, D9b `142:1326`, D10 `122:533`. Existing font, brand colors, RTL and mobile shell retained.

- D3: darker patient names, compact 12px row padding/radius/gaps, working search, last visit/weight metadata.
- D4: teal progress/weight summary computed from existing measurements, bordered demographics and measurement cells, structured history and clear Today Visit action.
- D8/D9: stable tab underline, existing 16px spacing/weight treatment retained, teal meal labels, compact edit/remove actions, neutral appointment card with usable styled native date input.
- D9b/D10: teal editor outline, readable meal pills, final-design review heading and bordered summary rows, dominant finish button. Back/edit/trash icon geometry corrected.
- Login: restored placed Figma artwork from node `186:5617`, imageRef `afc5847f7b9f92e941043fb946c92d56b273c5b0`, crop `1e6366`. No invented replacement or branding change.

Deliberate deviations: integrated two-step visit tabs, always-editable native date, inline meal editor, native delete-day confirmation, simplified profile/history rather than full tabs/charts. Attachments, previous-plan copy, account/settings, delivery/PDF remain omitted rather than dead CTAs. Known simplifications stay PARTIAL/DEFERRED, not silently counted READY.

## 4. Launch-critical fixes

No required core screen was entirely missing. Above visible refinements retained the existing flow. Day deletion now asks before removing all meals. No redesign, fonts/branding changes, persistence architecture, migrations or authentication rewrite.

## 5. Fictional demo data and reset

Reviewed and retained the candidate seed/reset work (now committed as `df14d40`): six entirely fictional Arabic patients, five queued across waiting (أحمد), partial measurements (ليان), ready (سامر), with doctor (نور), completed (مريم); ريم remains available for the intake walkthrough. Reserved fictional `+1 202-555-01xx` numbers avoid accidental real contacts. Ages derive from birth years; arrival times and supported body measurements are populated. Four files have previous measurements; no unsupported BMI or history-note field was invented.

Featured نور: prior 76.4 → current 74.8 kg (−1.6 kg), waist 88 → 86 cm, full supported measurements, natural Arabic doctor notes, five meals (breakfast/lunch/dinner/two snacks), future appointment (+14 days). مريم has a read-only completed visit with notes/plan/date. Fictional demonstration content, not medical advice.

Reset: `/demo/secretary/account` → **إعادة ضبط العرض التجريبي** → confirm. Restores only this browser's public demo store, synchronizes open demo tabs, and survives reload. No admin tooling/server writes. Existing saved demos are preserved until explicit reset; blocked browser storage falls back to memory with an existing warning. Queue is intentionally one demo day, not calendar-aware production scheduling.

## 6. Old PR and open issue recommendations

Reviewed open PR titles/bodies/changed-file lists, not just branch names. Recommendations only: nothing closed, merged or cherry-picked.

| PR                                 | Recommendation         | Evidence / action                                                                                                                                                                                                                                         |
| ---------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #24 Secretary queue/intake         | SUPERSEDED BY #34      | Intake UI is integrated into the local demo. Its database-backed queue/migration is intentionally NOT required/ported; preserve for a separately approved persistence project, not an overlapping merge.                                                  |
| #25 Visit schema foundation        | KEEP FOR LATER         | Production visits/private notes are outside this demo. Important scope mismatch: current GitHub changed-file list is generic skill files, not the migration promised by its body. Reconcile/re-scope before any future schema review; do not merge as-is. |
| #32 Measurement previews/doctor UI | SUPERSEDED BY #34      | Preview/measurement assets and doctor shell are retained; #34 adds real local handoff and visit completion. No missing demo-critical change needs porting.                                                                                                |
| #33 Secretary functional demo      | SUPERSEDED BY #34      | Same connected intake/store/handoff is integrated; #34 continues through doctor plan and completion. Recommend closing only after human approves #34.                                                                                                     |
| #34 V1 integration                 | KEEP current candidate | Continue this PR only; review and merge decision remain human-owned.                                                                                                                                                                                      |
| #23 Security policy                | KEEP FOR LATER         | Independent documentation, no demo dependency.                                                                                                                                                                                                            |
| #13–#16 dependency bots            | KEEP FOR LATER         | Separate dependency upgrades; do not mix into V1 demo.                                                                                                                                                                                                    |

Only one open issue was returned by GitHub:

| Issue                           | Classification | Reason                                                                                                                                                                                                     |
| ------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #20 Authentication E2E coverage | POST-LAUNCH    | Dedicated provisioned-account/CI work; public demo and signed-out guard coverage do not satisfy it. Not implemented or closed. Required follow-up before claiming production authentication E2E assurance. |

No known issue currently BLOCKS the browser-local V1 demo. Post-launch tasks stay documented here rather than creating new issues: full profile/progress/history screens, settings/onboarding, real persistence and isolated live-auth verification, plan delivery, and day-aware scheduling. Production launch is not certified by this demo audit.

## 7. Final validation

- `npm run typecheck` — PASS.
- `npm run lint` — PASS, zero errors/warnings.
- `npm run build` — PASS (Next.js 16.4.1). Also built with explicitly blank test backend variables, because `NEXT_PUBLIC_*` values are inlined at build time; the public-login unavailable-state fixture needs matching build/server configuration.
- Production browser command (PowerShell): `$env:UI_AUDIT_PRODUCTION='1'; npm run audit:ui:browser -- tests/ui-audit/secretary-flow.spec.ts tests/ui-audit/public-login.spec.ts --project=chromium-390 --project=chromium-1280 --workers=1` — **12 passed, 0 failed** (final confirmation recorded on PR).
- Both widths cover full existing-patient completion and new-patient/full-exam intake; public login labels/unavailable-state/axe/overflow; recovery/cancel/unknown route/signed-out guards. Happy path checks measurement/history/notes/meals/date/completion reload, duplicate prevention, tab synchronization, reset/reload, delete-day cancel/confirm, axe on queue/file/notes/editor/plan/review/completed, RTL, no horizontal overflow and **zero browser console/runtime errors**. No mutation requests originate from secretary demo.
- Rendered final D3/D4/D8/D9/D9b/D10 mobile and desktop captures inspected in one confirmation pass; desktop retains centered 390px layout. Mechanical design scan on changed UI — `[]`. `git diff --check` — PASS.
- Initial dev audit runs were disrupted by concurrent server/artifact work; isolated production rerun is authoritative. Production recovery initially assumed HTTP 404; Next's documented streamed `notFound()` may retain HTTP 200. Test now requires the actual 404 UI plus `noindex`, allowing only 200/404. No application guard was weakened.
- Public login test initially ran against a configured build while expecting the unconfigured fixture. Rebuilt with blank backend variables; no production authentication code changed. Live authenticated E2E (#20) and the full 320/768px suite were not run in this focused launch pass.

For a local `.env.local`, build the isolated public fixture without exposing credentials:

```powershell
node -e "const r = require('child_process').spawnSync(process.execPath, ['node_modules/next/dist/bin/next', 'build'], { stdio: 'inherit', env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: '', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '', SUPABASE_SECRET_KEY: '' } }); process.exit(r.status ?? 1)"
```

### Requirement-to-evidence checklist

| Gate                                                     | Concrete evidence                                                                           |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| All relevant Figma screens, IDs, routes and status       | Section 1, 55 frames including continuation and explicit defer reasons                      |
| Existing/new patient, same identity and complete visit   | `secretary-flow.spec.ts`, both 390/1280px production projects                               |
| Reload, same-browser role/tab sync, completed read-only  | Happy-path assertions on measurements/history/notes/meals/date/completion/reset             |
| Figma-led visual fixes, not redesign                     | Section 3 and six exported reference/rendered comparisons; existing fonts/branding retained |
| Active fictional clinic, histories, featured plan, reset | Section 5, `lib/demo-clinic.tsx`, featured/reset browser assertions                         |
| Old PRs and all open issues reviewed                     | Section 6; recommendations only, #20 not implemented                                        |
| Typecheck/lint/build, axe/overflow/console               | Exact commands/results above; no claimed successful authenticated login                     |
| Small scope, no merge                                    | No dependency/auth/RLS/migration changes; PR #34 remains human-reviewed and unmerged        |
