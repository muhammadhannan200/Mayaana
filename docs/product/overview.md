# Rashaqa mobile — product overview

## Source and scope

This document describes only the Figma canvas [Rashaqa — Mobile Web (390)](https://www.figma.com/design/dZPtsNiHOfyhqRgHb6H0yx/clinc?node-id=65-147), including its linked [V0 & V1 section](https://www.figma.com/design/dZPtsNiHOfyhqRgHb6H0yx/clinc?node-id=181-5616). The Figma **file** is named `clinc`; other canvases in that file are outside this analysis. Screen names and version labels below are Figma labels, not a confirmed delivery schedule. See [figma-structure.md](figma-structure.md) for the complete screen inventory.

## What the screens depict

An Arabic, right-to-left, 390-pixel-wide mobile clinic experience named رشاقة in parts of the canvas. Three roles appear:

- **Secretary:** maintains the day's queue, searches for an existing patient before adding them, creates or views patient files, records follow-up or full-exam measurements, and hands a patient to the doctor. The secretary also has an account screen.
- **Doctor:** sees home/this-week/all-patients views; opens a patient record with profile, progress, and visit tabs; reviews earlier visits; records today's measurements, private notes, attachments, meals and next appointment; finishes a visit; and manages account settings. Later frames show patient instructions, plan preview and sharing, follow-up appointments, notifications and reports.
- **Patient (V3-labeled screens):** receives an invitation, enters through a phone/code flow, sees a home screen, plan, progress, visits, visit details and account, and can request rescheduling or upload a lab result before a visit. The canvas explicitly says the patient **never sees the doctor's private notes** (text node `151:1126`).

This section describes depicted screens. The decisions subsequently confirmed by the product owner are recorded separately in [login-flow.md](../auth/login-flow.md); do not mistake user decisions for Figma-derived facts.

## Main depicted journeys

| Journey                     | Evidence on this canvas                                                                                                                                                                                                                                 | What remains unverified                                                                                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clinic sign-in and recovery | Two `00 · Login` frames (`118:3`, `181:3622`) show phone, password and دخول. `V1-01` shows a four-digit verification code; `V1-02` a new password. `V1-03`/`V1-04` show clinic and secretary onboarding.                                                | The role-specific use of these frames and recovery policy were settled in [login-flow.md](../auth/login-flow.md). Figma does not depict invalid-credentials or loading screens. |
| Secretary queue handoff     | `S1` queue (three repeated frames), `S2` patient search, `E2` no results, `S4` new file, `S3` add confirmation, `S5` weight-only follow-up, `S5b` previous measurements, `S6` full exam, `S1b` patient with doctor. `E1` shows an empty queue.          | Exact branching and persistence, queue ordering and check-in rules.                                                                                                             |
| Doctor visit                | `D1` home, `D2` this week, `D3` all patients, `D4` profile, `D5` progress, `D6` visits, `D7` previous visit, `D8` today's measurements/notes, `D9` diet plan/next appointment, `D9b` add meal and `D10` finish review.                                  | Whether `D8 → D9 → D10` is a required sequence or alternate entry states; save/draft behavior.                                                                                  |
| Sharing a plan              | Directly placed `V1-10` patient instructions, `V1-11` finish/send, `V1-12` patient-view preview, `V1-13` share and `V1-14` saved/sent frames.                                                                                                           | Exact channels, delivery status and the relationship to `D10`.                                                                                                                  |
| Follow-up operations        | `V2-01` through `V2-09` cover this week's appointments, overdue/dropped patients, overdue action, scheduling, notifications, reminders, patient WhatsApp reminder, secretary check-in and monthly report.                                               | Whether V2 is in the first release; actual notification transport, timing and report calculations.                                                                              |
| Patient journey             | `V3-01` invite, `V3-02` login, `V3-02b` code, `V3-03` home, `V3-04` plan, `V3-05` progress, `V3-06` visits, `V3-07` visit details, `V3-08` reschedule, `V3-09` lab upload, `V3-10` account, `V3-11` doctor sees activity and `V3-12` post-request home. | Whether V3 is in scope; invitation, consent, request approval and attachment rules.                                                                                             |

The rows express plausible reading order from names and visible text; the MCP data does not prove every tap connection or an executable prototype transition.

## Navigation shown

- The reused **doctor bottom navigation** exposes `الرئيسية` (home), `المرضى` (patients), `البحث` (search), `الحساب` (account), with an `Active` variant for each destination (component set `117:132`; example `D1` instance `142:1153`).
- The reused **secretary bottom navigation** exposes `الدور` (queue), `المرضى`, `البحث`, `الحساب` (component set `117:249`; example `S1` instance `142:737`).
- Patient navigation is depicted on V3 patient screens via a separate `Rashaqa / BottomNav / Patient` component set (`151:114` in file metadata); do not conflate it with doctor/secretary navigation. Its named variants are Home, MyPlan, MyProgress and MyAccount.
- Patient-record sections use a three-tab strip `الملف` / `التطور` / `الزيارات`, with an active underline (example `D4` `181:3925`). Subscreens use top bars with titles, optional subtitles and a back/close icon. Queue screens have a header, content and persistent bottom navigation; visit and form screens frequently end in a bottom `ActionBar`.

## Login decisions made after the Figma review

The product owner identified `118:3` as the secretary reference and `181:3622` as the doctor reference. These are two role-specific visual references for one clinic sign-in entry point, with no role selector. The two frames differ in recovery text. The signed-out doctor text suggesting self-service password change is superseded by the agreed administrator-assisted recovery policy. See [login-flow.md](../auth/login-flow.md) for the agreed behavior, implementation scope, and still-pending operational setup.
