# Secretary V1 functional demo

Start at `/demo/secretary`. No login or database migration is needed for the public demo. Use fictional information only.

## Screens and routes

Prefix the routes below with `/demo` to use the public demo. Without that prefix they require the existing activated secretary/doctor login. The public demo and signed-in clinic demos have separate storage namespaces.

| Screen      | Route                                          | Behavior                                                                                                         |
| ----------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| S1 / E1     | `/secretary`                                   | Empty queue, waiting cards, totals and add-patient CTA                                                           |
| S2 / E2     | `/secretary/search`                            | Search seeded or created files by name/phone; no-results recovery                                                |
| S3          | `/secretary/confirm?patient=<id>`              | Select visit type, confirm addition; prevent duplicate queue entries                                             |
| S4          | `/secretary/patients/new`                      | Validate demographics, warn about similar names, prevent duplicate phones, save file then confirm queue addition |
| S5          | `/secretary/measurements/follow-up?entry=<id>` | Enter and validate weight, view visit history                                                                    |
| S5b         | `/secretary/measurements/previous?entry=<id>`  | History detail dialog, edit/cancel/save previous measurements                                                    |
| S6          | `/secretary/measurements/full-exam?entry=<id>` | Validate nine full-exam measurements                                                                             |
| S1b         | `/secretary?sent=1`                            | Show the patient with the doctor after explicit handoff                                                          |
| Doctor home | `/doctor`                                      | Same patients, queue readiness and current patient                                                               |
| Doctor file | `/doctor/patients/<id>`                        | Same identity, today's saved measurements and edited history                                                     |
| D8          | `/doctor/visits/<entry>`                       | Review saved measurements; auto-save doctor notes                                                                |
| D9 / D9b    | `/doctor/visits/<entry>?step=plan`             | Add/remove diet days; add/edit/remove meals; automatic or custom next appointment                                |
| D10         | Finish review sheet on D9                      | Confirm patient, weight, notes, meals and appointment; save and finish                                           |
| Completed   | `/doctor/visits/<entry>`                       | Read-only completed visit; doctor home and secretary queue show completed status                                 |

Supporting patient-list and account routes are functional. The signed-in doctor account link still opens `/doctor/staff`; sign-out remains available. Original `/measurement-preview` routes are kept as isolated design fixtures.

## Walkthrough

1. Open the populated queue and choose **إضافة للدور**. Five fictional patients already show waiting, partial measurements, ready, with-doctor and completed states.
2. Search **ريم**, select her file, choose **مراجعة**, then confirm.
3. Open **أخذ القياس**, enter a positive weight (Arabic/Persian digits work), optionally view/edit previous visits.
4. Save measurements. The queue card becomes ready; choose **إدخال عند الطبيب**.
5. Use **عرض الطبيب** in the public demo, or sign in as the same clinic's doctor in the same browser. The patient appears with the saved measurements. Two public-demo tabs also synchronize.
6. For a new patient, search for a nonexistent name, open a new file, fill required name/phone/height, save, confirm, then complete all nine S6 fields. First visits use full exam.
7. In the doctor file, choose **زيارة اليوم**, review the measurements, and enter **ملاحظاتي**. Continue to the diet plan and appointment.
8. Choose **إضافة يوم**, then **إضافة وجبة**. Select a meal type, enter its description and save. Saved meals can be edited or removed. Each day must contain a meal before finishing.
9. Keep the automatically calculated appointment (day after the diet program), or select a future date. Choose **إنهاء الزيارة**, review, then **حفظ وإنهاء الزيارة**.
10. The visit becomes read-only and visibly completed, its measurements enter patient history, and it leaves the active doctor queue. The secretary's completed total and patient status update in the other tab. Reload retains notes, meals, appointment and completion.

## State and boundaries

- `lib/demo-clinic.tsx` is the small centralized browser store. Versioned localStorage retains records/drafts on reload; a shared browser instance keeps Next's retained routes consistent, and storage events synchronize tabs.
- Signed-in state is namespaced by clinic, public demo by `public`. This is **not** a security boundary or production patient storage. No real clinical data should be entered. Clearing site storage resets the demo. If storage is blocked, only in-memory state is available.
- The fresh browser seed contains أحمد الخطيب (waiting), ليان منصور (partial measurements), سامر درويش (ready), نور الحسن (with doctor), and مريم العلي (completed). ريم الخطيب remains available for the search/add walkthrough. All names, measurements, histories and notes are fictional; seeded phone numbers use the reserved North American `202-555-01xx` example range, not actual patient contacts.
- For an immediate doctor demo, open نور's file from `/demo/doctor`: measurements, previous visit, notes, a sample day with breakfast/lunch/dinner/two snacks, and a follow-up date two weeks ahead are populated. مريم's completed visit also contains a saved sample plan. Appointment time and previous-program copying have no existing UI and remain deferred.
- Existing saved demo records are preserved, not silently replaced. To load the populated seed in a previously used browser, open **الحساب → إعادة ضبط العرض التجريبي** and confirm. Only this browser's public-demo namespace is reset; the reset syncs to its other tabs. No authentication is required.
- No server database writes, migrations, Supabase changes, authentication changes, issue #20 work or directory reorganization.
- Readiness follows `waiting → ready → with_doctor → completed`; editing measurements resets readiness before handoff. Sending is unavailable until successful validation. Missing/stale entry links recover to the queue. Completion is idempotent and archives today's measurements once; completed visits cannot be edited.
- This is one demo-day queue, not a calendar-aware production queue. Multi-device/multi-browser sharing, real clinical persistence, uploads/camera, copying a previous diet plan, patient sharing/PDF delivery, appointment scheduling/reminders and V2/V3 remain deferred. S1b stays visible until the doctor finishes; no undo handoff is introduced. Browser-local state is not suitable for real patient information.
- Visual authority: Figma file `dZPtsNiHOfyhqRgHb6H0yx`, section `181:5616`, particularly S1 `142:607`, S2 `118:226`, S3 `118:276`, S4 `119:66`, S5 `143:1177`, S5b `143:1275`, S6 `119:206`. Reuses PR #24 intake styles and PR #32 measurement/doctor UI. Mobile reference is 390px, RTL and existing Noto Sans Arabic/tokens retained. No decorative phone status bar is added to the web app.

## Validation

`npm run build`, `npm run typecheck`, `npm run lint`, and `npm run audit:ui:browser -- --workers=2`.

Browser tests cover new/existing patient journeys, empty/no-results recovery, duplicate queue protection, localized numeric validation, draft/history persistence, tab synchronization, doctor identity/measurement continuity, modal keyboard behavior, signed-out route guards, axe and viewport overflow at 320/390/768/1280px. Live authenticated sessions require provisioned accounts and are not exercised by the signed-out browser suite.

The existing-patient test now continues through D8 notes, D9 plan and appointment, D9b meal creation/editing, D10 confirmation and completed state, including reload and cross-tab consistency. For this completion pass, the focused suite was run at 390px, with the complete happy path also checked at desktop width; see the PR for exact executed results rather than assuming all browser projects were rerun.

Completion-pass results:

- `npm run typecheck` — pass.
- `npm run lint` — pass, no errors or warnings on the final run. An earlier concurrent run raced Playwright's `test-results` cleanup; serial rerun passed without configuration changes.
- `npm run build` — pass.
- `npm run audit:ui:browser -- --project=chromium-390 tests/ui-audit/secretary-flow.spec.ts --workers=1` — 3 passed (full existing-patient flow, new-patient/full-exam flow, recovery/route guards).
- Final confirmation after visual fixes: `npm run audit:ui:browser -- tests/ui-audit/secretary-flow.spec.ts --grep "complete V1" --project=chromium-390 --project=chromium-1280 --workers=1` — 2 passed. Includes notes/meal/appointment/completion persistence, cross-tab handoff/completion, axe/overflow checks on D8/D9 and no browser errors.
- Mechanical design scan on the changed UI — `[]`.

## Final Visual QA handoff

- New doctor screens follow Figma D8 `122:340`, D9 `122:422`, D9b `142:1326`, D10 `122:533`: 390px RTL shell, existing font and tokens, teal weight card, 16px content spacing, 12/16px corners and bottom review sheet.
- Deliberate demo deviations: extra two-step navigation, always-visible editable native date field instead of the Figma date summary/edit affordance, compact meal edit controls, dynamic real dates and counts. Upload/camera and previous-program copy controls are omitted rather than presenting dead actions.
- D3/D4 retain the inherited functional lists/file summary; the full Figma profile tabs, charts and richer visit history are not reproduced. Check these in final Visual QA, along with icon geometry, text wrapping and vertical density against each frame. Desktop deliberately keeps the centered 390px mobile composition.
- The inherited login still references `/rashaqa/login-mark-layer-b-1e6366b.png`, absent from current tracked public assets; signed-out guard testing reports an image 404. This predates this completion work; authentication, fonts and branding were not modified here.

## Launch-demo polish

- D3 now reuses the existing search, avatars and secondary phone/visit metadata. D4 has Figma-style patient-information rows, compact 12px metric cards and separated visit-history rows; profile tabs/charts remain deferred. Source: D4 `181:3909`, plus the documented Figma system.
- Step tabs reserve their 3px active indicator so switching steps does not shift content. The native date field uses the existing white/teal field styling with stable LTR date numerals inside the RTL page. The pencil geometry is corrected. No new artwork, dependencies, production data paths or migrations.
- Validation: typecheck, lint and production build passed. Focused browser checks cover the seeded queue/featured plan/completed visit, existing- and new-patient handoff, notes/meals/appointment/completion reload persistence, tab synchronization, reset, axe and overflow. The first four-check run had 3 passes and a mobile trace-cleanup ENOENT after the journey; a trace-disabled mobile confirmation passed. Final confirmation results are recorded on PR #34.
- Final focused confirmation: `npm run audit:ui:browser -- tests/ui-audit/secretary-flow.spec.ts --grep "complete V1|new patient" --project=chromium-390 --project=chromium-1280 --workers=1 --trace=off --output=artifacts/demo-launch-final` — **4 passed (1.9m)**. Trace collection was disabled only for this run; no Playwright configuration or dependency changes.
