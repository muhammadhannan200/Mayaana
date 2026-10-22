# Secretary measurement screens

The S5/S5b/S6 UI from PR #32 is reused by the [continuous V1 demo](secretary-v1-demo.md).

| Screen                      | Figma node | Isolated fixture                 | Connected route                                |
| --------------------------- | ---------- | -------------------------------- | ---------------------------------------------- |
| S5 — Follow-up              | `143:1177` | `/measurement-preview/follow-up` | `/secretary/measurements/follow-up?entry=<id>` |
| S5b — Previous measurements | `143:1275` | `/measurement-preview/previous`  | `/secretary/measurements/previous?entry=<id>`  |
| S6 — Full exam              | `119:206`  | `/measurement-preview/full-exam` | `/secretary/measurements/full-exam?entry=<id>` |

Connected routes load the selected demo queue patient's identity, history and measurement draft. Prefix with `/demo` for public access. Saving marks the patient ready in the queue; the secretary explicitly sends them to the doctor from there. History edits and drafts survive navigation/reload when browser storage is available. Missing entry links recover to the queue.

Isolated `/measurement-preview` fixtures remain verification-only and intentionally do not affect the shared demo. Neither mode writes to Supabase. Existing role/password checks remain in staff route layouts.

Validation accepts positive values within field-specific ranges, Arabic/Persian/Latin digits and two decimal places. Historical BMI remains read-only. The history dialog supports focus containment/restoration, Escape, editing and cancel.

Build, typecheck, lint and all 52 browser tests pass at 320/390/768/1280px. Lint has 17 pre-existing warnings in local skill files, none in feature code. See the V1 demo document for routes, walkthrough and remaining production gaps.
