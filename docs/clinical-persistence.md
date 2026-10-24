# Clinical persistence foundation

## Deployment boundary

This branch never applies migrations to a hosted project. Production deployment is a separate reviewed step after merge review, clean replay, upgrade tests, grant/RLS review and advisor review. Do not run `db push`, repair migration history, or use production records as fixtures.

The target's user-verified historical versions are `20261012063351`, `20261012063623`, `20261015053810` and `20261019092326`. The first three remain unchanged. The fourth is restored from the existing local persistence baseline, not from the differently numbered PR #24 file. Compare its SQL to the actual applied history read-only before production deployment; do not reapply it. No old PR is merged.

New migration: `20261023162459_clinical_foundation.sql` (generated with Supabase CLI `migration new`). It extends patients and daily_queue, and adds visits, visit_measurements, visit_private_notes, diet_plans and appointments. No records are deleted or backfilled. Historical waiting entries acquire their visit on first measurement save; historical in-progress rows without a visit require explicit operator reconciliation rather than guessed clinical data. Existing demographic nulls must be corrected before first clinical use.

## Authorization

All seven clinical tables have RLS. Every read requires an active, same-clinic `clinic_staff` row with password setup complete. Notes and diet plans require doctor role. Secretary reads exclude private notes entirely, not just hidden UI fields. Appointment reads expose appointment metadata only. No authorization uses user-editable Auth metadata.

Authenticated users receive SELECT only, no table or column INSERT/UPDATE/DELETE grants. The narrow mutation RPCs use a dedicated `mayaana_clinical_api` owner: NOLOGIN, NOSUPERUSER, NOBYPASSRLS, no schema creation privilege, and no membership granted to application roles. It inherits existing authenticated identity-helper privileges; the membership is strictly one-way, so authenticated cannot assume the writer role. This avoids modifying Supabase-owned Auth grants and avoids PostgreSQL-16-only membership syntax. This is an intentional exception to preferring SECURITY INVOKER: an invoker RPC would need direct table-write privileges, enabling callers to bypass transition validation. Unlike postgres-owned definers, this role does not bypass RLS. Every function pins an empty search_path and explicitly checks the session's database-managed staff record. Policies apply to this role too, and UPDATE policies have USING plus WITH CHECK.

Anonymous has no table or RPC access. Helpers live in an unexposed private schema. Only the staff lookup is callable by authenticated sessions for RLS. All public mutation responses are queue metadata or patient IDs/revisions, never private notes. There is no browser service-role use. The only DELETE grant is to the non-login function owner for a doctor's optional, uncompleted appointment; authenticated callers cannot delete tables.

## Transactions and concurrency

- `clinical_create_patient`: caller-generated UUID supports exact retries, without treating name or contact phone as identity. Shared family phones are allowed.
- `clinical_update_patient`: metadata-preserving, revision-checked demographic correction; cannot reassign identity/clinic.
- `clinical_enqueue`: clinic/service-date uniqueness plus one exact visit per entry, serialized duplicate requests, composite foreign keys.
- `clinical_save_measurements`: validates the actual current UI fields (weight, fat, muscle, visceral, bmr, waist, arm, thigh, hip), requires the full set for full examinations and weight for follow-ups, saves and transitions waiting/ready to ready atomically.
- `clinical_handoff`: locks queue, checks revision, eligibility and measurements; ready → with_doctor with visit start timestamp. A stable request UUID returns the committed result after a lost response.
- `clinical_save_doctor_draft`: a single visit's notes, ordered diet document and optional appointment, with expected queue revision. This is not a whole-clinic state replacement API.
- `clinical_finish`: validates and commits final notes/diet/appointment/visit/queue in one transaction. Requires doctor and with_doctor; same request UUID safely returns completed result, while a new/stale request fails. Completed records are protected by database triggers and no exposed direct writes.

Queue revision is the concurrency token for all visit mutations; child records also retain their own revision and actor/timestamps. Every visit mutation locks the queue first, preventing cross-operation races. Revision/lifecycle conflicts use PostgREST SQLSTATE PT409 (HTTP 409), authorization 42501 and invalid input 22023. Ordinary PostgreSQL transaction-state errors map to HTTP 500 and can trigger SDK retries; explicit HTTP 409 prevents that. Clients must preserve unsaved input on recoverable failures and refresh authoritative state before consciously retrying conflicts.

Diet storage is a bounded single-visit document preserving stable UUIDs and array ordering. It matches the existing editor, avoids per-meal network partial saves, rejects unknown fields, duplicate IDs and invalid descriptions, and requires populated days/meals on finish. No attachments, reminders, admin features or public demo changes are included.

## Isolated verification

`npm run test:clinical` requires Node 24, Docker and Supabase CLI 2.81.3. The Actions **Clinical DB and RLS** check uses an ephemeral unlinked local stack with generated keys, never a hosted URL or production credentials. It tests clean replay and upgrade from the four live historical versions with synthetic pre-upgrade rows, then runs lint and security/performance advisors. The stack is destroyed on exit. An advisor result is not considered reviewed merely because its command exits successfully; findings must be inspected before release.

The integration suite covers role/clinic boundaries, anonymous/inactive/first-use denial, direct-write denial, forged relationships, retries and concurrency, measurement validation, notes secrecy, failed operation rollback and completed-record immutability. Catalog assertions check grants, RLS, both UPDATE predicates, function ownership, non-login/non-bypass role properties and one-way membership. Isolated denial triggers force failures _after_ the handoff's visit write and completion's notes/diet writes, then verify rollback. These test-only triggers are never migrations, application endpoints or production switches; they are removed in finally blocks and the stack is destroyed.

## Authenticated application

Both authenticated layouts no longer mount DemoClinicProvider. `app/secretary/clinic-flow.tsx` retains the current screens with explicit operations from `app/clinical-actions.ts` and the server-only `lib/clinical.ts`. `app/doctor/visit-screen.tsx` edits an in-memory unsaved draft and explicitly saves or atomically finishes it. No whole-clinic replace API exists. Persisted data is Supabase-authoritative and never written to browser storage. The obsolete authenticated V1 demo key for the known clinic is retired on load; public `/demo`'s separate `public` key and fictional flow are unchanged. No local demo data is imported into clinical tables.

Reads and every mutation revalidate the user's verified Auth identity and database-managed staff record. Notes/diet are fetched only for an explicitly opened visit in a doctor session. There are no fictional seeds or browser-local fallbacks on authenticated routes. Search is debounced 350ms, patient lists page in groups of 50, and explicit patient detail loads up to the latest 100 completed visits. The active service day uses Asia/Damascus, matching the existing queue schema. Queues over 500 return a load failure rather than silently showing incorrect totals; higher-volume operation is a documented follow-up.

Writes refresh the screen after a confirmed commit. Visible screens poll every **10 seconds** and refresh on focus/visibility return; no Realtime infrastructure is needed. Drafts retain their original revision and input on network/conflict failure. Reloading a saved copy requires an explicit discard confirmation. Another session's completion displays the authoritative completed record, not an unsaved local draft, while warning about and retaining the draft in memory. Completed history is read-only, including secretary measurement sheets.

Initial loading, empty, saving, committed, request-failure/retry, conflict and session-expiry states reuse the incumbent RTL styles. Buttons prevent duplicate submits. A failed operation never navigates to a success state. Draft notes/diet must be explicitly saved before leaving; the visit warns on abandoning dirty edits. No offline clinical writes or offline-sync claim exists.

`npm run test:clinical:browser` runs real isolated Auth plus two independent browser contexts through secretary intake → full measurements → handoff → doctor notes → diet → appointment → finish → completed state and reload, at 320/390/768/1280px. It checks axe, overflow, RTL, keyboard dialog behavior, browser errors, storage separation, failed-save input retention and independent-doctor concurrency. Browser build assets are checked for accidental server-key exposure. Artifacts contain synthetic data only and expire after seven days.

The separate integrated Auth check runs the approved #20 suite twice against this clinical app/SQL. Until PR #37 merges, its test-only harness is copied from immutable commit `7e3657c234b9c446804099043241724c6435e0c6`; no application code is replaced. After #37 merges the workflow uses the checked-in harness directly. Both implementation PRs remain unmerged; recommend #37 before #38.
