# Secretary measurement screens

## Design coverage

Reference: Figma file `dZPtsNiHOfyhqRgHb6H0yx`, section `181:5616`.

| Screen                            | Figma node | Public fictional preview         | Protected route                     |
| --------------------------------- | ---------- | -------------------------------- | ----------------------------------- |
| S5 — Follow-up, weight only       | `143:1177` | `/measurement-preview/follow-up` | `/secretary/measurements/follow-up` |
| S5b — Previous visit measurements | `143:1275` | `/measurement-preview/previous`  | `/secretary/measurements/previous`  |
| S6 — Full exam                    | `119:206`  | `/measurement-preview/full-exam` | `/secretary/measurements/full-exam` |

The preview index is `/measurement-preview`. All measurement routes use fictional fixtures, including the protected routes. They are not linked to real queue entries. The previous-visit sheet supports keyboard dismissal, modal focus containment, local editing and cancel. Values accept Arabic, Persian and Latin digits, with positive ranges and up to two decimal places. Local changes reset on navigation/reload. BMI is historical, read-only data; there is no height-based recalculation in this slice.

The primary action deliberately says “verify measurements only” rather than the Figma save/send wording, alongside an explicit fictional-preview notice. Neither verification nor historical editing writes to the database or sends a patient to the doctor. This is an intentional safety deviation, not a completed clinical handoff.

## Preserved related work and prerequisites

The restored doctor home, patient list and patient record UI are retained with their read-only, clinic-filtered queries. Existing authentication, staff-directory roles and password-change checks remain authoritative. These reads require the patients/daily-queue schema from the separate secretary queue PR [#24](https://github.com/muhammadhannan200/Mayaana/pull/24). A load failure is not displayed as an empty patient list.

Live measurement persistence and handoff remain blocked on review/integration of the queue work and visit foundation [#25](https://github.com/muhammadhannan200/Mayaana/pull/25), then a clinic-scoped persistence adapter. This PR intentionally does not import their migrations, mutate production data, or change Auth/RLS. No D8–D10 visit editor, V2/V3 flows, password recovery, new infrastructure or dependencies are included.

## Reconciliation

The original `feature/secretary-measurement-screens` branch is preserved. Its restored WIP is additionally saved in a named local git stash before creating `feature/secretary-measurements-review` from `master`. Only the measurement UI and related doctor/read helpers were carried over. Old branding, documentation reshuffles, generic skills, `skills-lock.json`, default Next.js public assets, the accidental `-files --others --exclude-standard` file, temporary measurement scripts and reference screenshots were not carried over. Current `master` branding, PWA, fonts, docs and project-specific skills remain unchanged.

## Validation

Run `npm run typecheck`, `npm run lint`, `npm run build` and `npm run audit:ui:browser`. The measurement browser suite uses fictional public previews and disables Supabase credentials, so it cannot touch production data. Authenticated doctor data reads and live measurement saving are not covered by these browser tests.

Verified for this delivery: typecheck and production build pass; lint exits successfully with 17 warnings confined to an ignored, pre-existing local skill installation (no feature-file warnings); all 40 browser tests pass at widths 320, 390, 768 and 1280. The measurement screens have no detected axe violations or horizontal overflow. The design detector reports no findings. The automatically generated Next.js feedback block in `AGENTS.md` is retained as required by the framework.
