# Rashaqa mobile — observed UI patterns

Scope: the [Rashaqa — Mobile Web (390) canvas](https://www.figma.com/design/dZPtsNiHOfyhqRgHb6H0yx/clinc?node-id=65-147), including its [V0 & V1 section](https://www.figma.com/design/dZPtsNiHOfyhqRgHb6H0yx/clinc?node-id=181-5616). “Reusable” means an actual named Figma component instance **or** a repeated visual pattern worth considering later; it does not instruct an implementation now.

## Shells, navigation and repeated compositions

| Pattern | Observed usage | Figma evidence |
| --- | --- | --- |
| Role-specific bottom nav | Doctor: home/patients/search/account. Secretary: queue/patients/search/account. Patient has a separate named nav set on V3. Active destination is a variant. | `117:132`, `117:249`, `151:114`; `D1` `142:1153`, `S1` `142:737` |
| Top bar | Back/close icon, title, optional subtitle and optional border; multiple title weight/size variants. | `Rashaqa / TopBar` `204:186`; `D8` `206:1604`, `V1-01` `206:1770` |
| Section heading | Title, optional subtitle and optional link. | `Rashaqa / SectionHeader` `204:200`; `D8` `206:1586` |
| Action bar | Bottom actions in forms/visits, often above bottom screen edge. | `D8` `122:416`, repeated `ActionBar` nodes throughout nested section |
| Patient record tabs | Profile (`الملف`), progress (`التطور`), visits (`الزيارات`); active tab uses teal text and underline. | `Rashaqa / Tab` `204:270`; `D4` `181:3925` |

## Controls

- **Buttons:** `Rashaqa / Button` (`199:347`) exposes `Type` primary/secondary/soft/danger, `Size` sm/md and `Weight` bold/semibold variants in file metadata. Instances can show/hide a swapped icon. `D8` uses primary “إنهاء الزيارة”, secondary “رفع ملف”, soft “تصوير”; Login uses primary “دخول”. `Rashaqa / IconButton` (`199:281`) uses ghost, ghost-muted and soft styles with icon sizes 16/18/20. This does not establish disabled/loading button states.
- **Fields:** `Rashaqa / Field` (`204:124`) instances include optional label, hint, icon, required marker and unit; the set has default/focus, filled/placeholder and muted/success-hint variants. In both `00 · Login` frames the phone field is shown **filled and focused**, with `0944 123 456` and a phone icon; password is shown **filled and default**, masked as `••••••••` with a lock icon. `D8` adds a freeform notes textarea with a teal focus border. Numeric measurement fields can include a unit. Error/disabled variants are not established by this Rashaqa field set on the scoped screen data.
- **Chips and statuses:** `Rashaqa / Chip` (`204:262`) has default, active, soft, warn and muted examples; `Rashaqa / QueueStatus` (`117:286`) depicts awaiting measurement, ready for doctor, with doctor and completed; `Rashaqa / VisitType` (`117:263`) differentiates full exam and follow-up. `Rashaqa / WeightDelta` (`117:309`) has good/bad up/down and stable variants; its goodness is relative to the patient's target.
- **Avatars and indicators:** `Rashaqa / Avatar` (`199:365`) exposes size/tone variants; `Rashaqa / NotificationBell` (`117:310`) takes unread/count properties (e.g. `2` on the `E1` header).

## Information display

- **Lists rather than a verified mobile table:** queue/patient and visit screens use stacked rows/cards with names, statuses, dates and actions. `D9` has a bordered `DayCard` containing `Meal` rows and an add-meal action (`122:445`, `122:453`, `122:477`). `D4`–`D6` split patient information by tab. `D8` shows a current weight card, comparison with last visit, notes and attachment row. The scoped page does **not** establish a table component or desktop column widths.
- **Files and plans:** `D8` shows upload and camera actions and a PDF attachment with uploaded state. `V1-12` shows a document-like **patient-view plan preview**; `V1-13` and `V1-14` depict sharing and completion. Whether the preview is generated/downloadable, or which content is public, must be confirmed.
- **Scheduling:** V2 frames depict follow-up lists, overdue patients, scheduling, reminder settings, check-in and a monthly report. These are visible designs, not a verified backend or data model.

## Overlays and feedback

| State | What the canvas actually shows | Unknown behavior |
| --- | --- | --- |
| Empty | `E1` (`181:4512`): empty queue, explanatory copy and “إضافة مريض للدور” CTA via `Rashaqa / EmptyState` (`117:331`). `E2` (`122:903`) depicts no patient-search results. | How filters/search clear, retry or loading work. |
| Destructive confirmation | `E4` (`122:1087`) overlays a day-plan screen with a dark scrim and `Rashaqa / ConfirmDialog` (`117:342`): delete-day title/body and cancel/delete. Directly placed `V1-09` shows archive confirmation; `A8` confirms logout. | Destructive action semantics, undo, and whether dismissing scrim is allowed. |
| Success | `S1` variant (`181:4591`) includes a success toast after adding a patient; `A9` (`196:1688`) includes “تم حفظ التغييرات”. `V1-14` is labeled Saved & Sent. | Toast duration, persistence and send failure behavior. |
| Error | `Rashaqa / Toast` component metadata lists an Error variant, and `E2` is a no-results state; a complete login-invalid-credentials/code design was **not** verified on this page. | Exact error copy, field error visuals, retry handling. |
| Loading/offline | No named loading/skeleton/offline screen or scoped Rashaqa instance was verified on this canvas. | Loading, network failure and offline design. |

## RTL and responsive notes

Arabic copy, right-hand headers, right-aligned content stacks and navigation icon direction make this a visibly RTL mobile design. Numerals, dates, phone numbers and filenames mix scripts; their bidirectional handling is not specified by these static frames. Screens are drawn at **390px** width; no other responsive breakpoint or layout adaptation is evidenced within the scoped canvas.

## Inconsistencies and questions visible in the design

- Two `00 · Login` frames have identical main form content but different recovery text and image fills. The product owner identified `118:3` as the secretary reference and `181:3622` as the doctor reference; see [login-flow.md](login-flow.md).
- V1 recovery screens depict verification/new-password, but the confirmed first-release policy is administrator-assisted recovery rather than self-service recovery. The doctor's signed-out copy needs revision to describe contacting the system administrator.
- Duplicate labels (`S1` ×3, `D3` ×2, `D6` ×2) appear as separate frames; do not silently select one state as canonical.
- V3 patient access explicitly says **no password, four-digit code every login**, whereas clinic login uses a password. Role boundaries should remain explicit.
- Several numbered frames have gaps (`V1-05`, `S7`, `D13`, `E3` in the nested section); absence of a label is not evidence of a missing feature.
- Prototype transitions, mobile keyboard states, accessibility behavior, validation messages, and approval of image assets are unverified by the MCP data examined.
