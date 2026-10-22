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

Supporting patient-list and account routes are functional. The signed-in doctor account link still opens `/doctor/staff`; sign-out remains available. Original `/measurement-preview` routes are kept as isolated design fixtures.

## Walkthrough

1. Open the empty queue and choose **إضافة مريض للدور**.
2. Search **ريم**, select her file, choose **مراجعة**, then confirm.
3. Open **أخذ القياس**, enter a positive weight (Arabic/Persian digits work), optionally view/edit previous visits.
4. Save measurements. The queue card becomes ready; choose **إدخال عند الطبيب**.
5. Use **عرض الطبيب** in the public demo, or sign in as the same clinic's doctor in the same browser. The patient appears with the saved measurements. Two public-demo tabs also synchronize.
6. For a new patient, search for a nonexistent name, open a new file, fill required name/phone/height, save, confirm, then complete all nine S6 fields. First visits use full exam.

## State and boundaries

- `lib/demo-clinic.tsx` is the small centralized browser store. Versioned localStorage retains records/drafts on reload; a shared browser instance keeps Next's retained routes consistent, and storage events synchronize tabs.
- Signed-in state is namespaced by clinic, public demo by `public`. This is **not** a security boundary or production patient storage. No real clinical data should be entered. Clearing site storage resets the demo. If storage is blocked, only in-memory state is available.
- No server database writes, migrations, Supabase changes, authentication changes, issue #20 work or directory reorganization.
- Readiness follows `waiting → ready → with_doctor`; editing measurements resets readiness. Sending is unavailable until successful validation. Missing/stale entry links recover to the queue.
- This is one demo-day queue, not a calendar-aware production queue. Visit completion, multi-device/multi-browser sharing, real clinical persistence and doctor treatment workflows remain outside this milestone. S1b remains visible instead of disappearing after a timer; no undo handoff is introduced.
- Visual authority: Figma file `dZPtsNiHOfyhqRgHb6H0yx`, section `181:5616`, particularly S1 `142:607`, S2 `118:226`, S3 `118:276`, S4 `119:66`, S5 `143:1177`, S5b `143:1275`, S6 `119:206`. Reuses PR #24 intake styles and PR #32 measurement/doctor UI. Mobile reference is 390px, RTL and existing Noto Sans Arabic/tokens retained. No decorative phone status bar is added to the web app.

## Validation

`npm run build`, `npm run typecheck`, `npm run lint`, and `npm run audit:ui:browser -- --workers=2`.

Browser tests cover new/existing patient journeys, empty/no-results recovery, duplicate queue protection, localized numeric validation, draft/history persistence, tab synchronization, doctor identity/measurement continuity, modal keyboard behavior, signed-out route guards, axe and viewport overflow at 320/390/768/1280px. Live authenticated sessions require provisioned accounts and are not exercised by the signed-out browser suite.
