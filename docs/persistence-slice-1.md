# Clinical persistence — Slice 1

## Scope

Authenticated secretary: patient → dated queue → visit → nine supported measurements → ready → transactional handoff. Doctor: read the same patient, visit and measurements from another authenticated session. No notes, diet, appointments or completion are implemented. Public `/demo` and measurement previews remain fictional and browser-local.

## Migration reconciliation

The owner externally verified the target's applied versions and RLS-enabled tables before implementation:

| Version        | Name                             |
| -------------- | -------------------------------- |
| 20261012063351 | create_clinic_staff_directory    |
| 20261012063623 | combine_clinic_staff_read_policy |
| 20261015053810 | switch_staff_login_to_email      |
| 20261019092326 | create_patients_and_daily_queue  |

Target tables were `clinics`, `clinic_staff`, `patients`, `daily_queue`; visits and measurements were absent. The last applied migration was missing from master. Its exact bytes are restored from PR #25 commit `0ac4e536d15e12f49e13d0c13768a2d756bf3b61`; no applied version is renamed or edited. This is a history reconciliation, **not an instruction to execute it again on the target**.

The new additive migration extends existing patient/queue tables and creates visits/measurements, constraints, RLS, invoker functions and trigger-enforced lifecycle rules. No rows are seeded or deleted, and existing queue states remain valid. Optional demographic columns leave existing records null rather than inventing values. Legacy queue rows can be read without a visit; repeating enqueue creates their missing visit idempotently. Legacy handed-off entries remain read-only, with no fabricated measurements.

PR #25 is not merged. Reused: composite clinic/patient/queue relationships, one visit per queue, separate numeric measurement columns, active/first-use policy checks and test patterns. Not reused: notes, unsupported vitals, mismatched measurement ranges, unrestricted historical corrections, or overlapping UI/skill changes.

## Integrity and permissions

- Clinic ownership is checked by RLS on every table using the caller's current staff row, active status and `must_change_password=false`.
- Both roles can read clinic-scoped records. Only secretaries can create patients/queue/visits, save measurements and hand off in this slice. No authenticated deletion grants.
- Same-clinic composite foreign keys bind patient → queue → visit → measurements. Unique constraints enforce one check-in per patient/service date, one visit per queue and one measurement set per visit.
- Service dates use `Asia/Damascus`, matching the existing applied queue migration. This slice does not introduce timezone settings.
- Queue revision is the concurrency token for the encounter. Measurement writes and handoff serialize on the queue row. RPCs reject stale revisions with `PT409` (HTTP 409); the UI retains the editor's original revision and requires explicit reload/review on conflict. Business conflicts deliberately do not use PostgreSQL's reserved serialization-failure code `40001`, which can cause request retries rather than prompt user-visible conflicts.
- Create-patient retries reuse a form UUID; a reused UUID with different input is rejected. Enqueue returns an existing check-in rather than duplicating it. Measurement retries reuse a request UUID/payload; replay with changed input is rejected. Repeated handoff returns the existing result without another revision increment.
- Trigger checks also protect direct Data API writes: no skipping readiness, no arbitrary revision jumps, and no measurement changes after handoff. A handoff commits once, atomically, from ready to with-doctor. Numeric validation and full-exam completeness live in the database, not just the browser.
- All functions run as `SECURITY INVOKER`; clinical code never uses the server admin client. No service-role credential is sent to a browser.

## Application behavior

`app/clinical-actions.ts` revalidates the current Auth user and directory membership on every read/mutation, then uses the session-scoped Supabase client. Authenticated `ClinicFlow` selects `PersistedClinicFlow` instead of mounting a demo store. Existing screen CSS, RTL, labels and measurement editor are retained. Doctor views are read-only for this slice; no visit-completion controls are exposed.

Reads are refreshed after successful mutations, every five seconds, and on window focus. Independent devices use the same database; localStorage events are irrelevant. Polling does not authorize writes or resolve stale drafts. Failed loads are not shown as an empty successful clinic; failed mutations retain entered values and show retryable errors. A successful mutation followed by a failed refresh can be retried safely.

No browser-local data is uploaded or migrated, and authenticated routes never fall back to fictional seeds. The public demo cannot call production mutations through its UI. Unsaved live measurement edits are memory-only; leaving/reloading before save discards them. Historical editing is outside this slice.

## Validation and CI

`npm run test:persistence` requires **Docker plus Supabase CLI 2.81.3 on PATH**. No hosted Supabase secrets, PATs, database passwords or personal accounts are required. CI installs the pinned CLI with `supabase/setup-cli` and uses a disposable local stack.

The runner creates an owned temporary Supabase project, refuses busy test ports, clears inherited hosted connection variables, starts local services and runs `db reset --local` for clean migration replay. It obtains local API keys privately and uses them for both `next build` and `next start`. Tests refuse any backend other than `http://127.0.0.1:55431` and require the runner marker. Production `.env.local` connection values are overridden, not copied into test fixtures.

Playwright creates synthetic Auth users and clinic rows through the local admin client, then exercises ordinary authenticated clients and independent browser contexts. Tests cover isolation, inactive/first-use denial, FK substitution, malformed measurements, concurrent saves, stale revisions, duplicate enqueue/save/handoff, direct-write bypass attempts and cross-session UI handoff/reload. Test data is removed in FK-safe order; the runner discards its local stack with no backup. It never links a hosted project or runs `db push`.

The separate **Persistence Integration** workflow runs twice from fresh databases. The existing **UI Audit**, its blank-backend fixtures and **Code Quality** remain separate. Failure-only traces/screenshots contain synthetic data and potentially local session tokens; artifacts expire after three days. Do not upload runtime keys, raw Supabase status output or environment files.

Commands:

```sh
npm run test:persistence
npm run test:persistence
npm run audit:ui
npm run typecheck
npm run lint
npm run build
```

Local Docker-dependent results must not be claimed when Docker is unavailable. Use the dedicated CI job and report its actual outcome. This slice is not whole-product production certification; auth E2E #20 and other release gates remain separate.

## Deployment gate

No hosted migration is applied by this PR or its CI. Before release, recheck target migration versions against the verified history, inspect any unexpected policies/constraints, take the required backup, apply only the new pending additive migration through the approved operator process, and smoke-test with synthetic records in staging first. Do not use migration repair to conceal drift. Keep the prior application available for rollback, but never drop clinical tables/data as an application rollback strategy.
