# Single active consultation per clinic

## Contract

At most one `daily_queue` row per clinic may have `status = 'with_doctor'`,
regardless of its service date. Waiting, ready and completed entries are not
limited. Different clinics have independent slots.

The old handoff locked only the selected queue entry. Two different entries
could both pass readiness checks and commit. The new partial unique index
`daily_queue_one_with_doctor_per_clinic` is the enforcement boundary, including
for privileged direct table writes. UI disabling alone is not the boundary.

The handoff RPC retains its request identity, revision, role and measurement
checks. An index collision rolls back the visit start, queue state, metadata and
revision changes, then returns `PT409` with detail `clinic_occupied`. The server
maps this to a specific Arabic conflict message; other conflicts remain generic.
The two-argument compatibility RPC delegates to the same implementation.

An acknowledged handoff retry returns the original entry, including after its
completion or while a different patient occupies the slot. A failed handoff can
be retried with the same request after the slot becomes available. Completion
releases the index slot in the same transaction as the completed visit.

## Overnight visits

Unfinished consultations from previous days remain visible in authenticated
clinical snapshots. A Doctor may continue/save/complete an already-active visit
after midnight. This narrow exception does not reopen completed visits, permit
Secretary completion or reopen old waiting/ready intake. Existing revision,
private-note, measurement and completion guards remain in place.

## Demo

The public demo stays fictional and browser-local. Queue writes acquire the
same scoped Web Lock and re-read localStorage inside it. Handoff checks the
latest state under that lock; competing tabs cannot overwrite each other's
handoff/completion. Without Web Locks, handoff fails closed with an explanatory
message. Handoff also fails closed if localStorage cannot commit the result;
other demo operations retain their best-effort storage fallback. Visit drafts
use separate per-entry browser keys for synchronous autosave, so an immediate
reload preserves notes without overwriting concurrent queue transitions.
Completed visits ignore those draft keys; confirmed reset clears them.

Existing conflicting browser-local records are not silently removed or marked
completed. Doctor Home warns about the conflict and exposes all existing open
visits for explicit completion. New handoffs remain disabled until the slot is
free. Reset remains an explicit, confirmed demo-only operation.

## Migration and rollout

New migration: `20261026204146_single_active_clinic_patient.sql`.
No historical migration is edited. No migration is applied to a remote project
by this implementation or its test runner.

The migration runs in a transaction, takes a queue write lock with a five-second
lock-acquisition timeout, checks existing data and creates the unique index. It
does **not** use `CREATE INDEX CONCURRENTLY`; plan a reviewed maintenance window
appropriate to the table size. On lock timeout or duplicate consultations it
fails and rolls back without clinical data repair or partial RPC updates.

Before any separately approved rollout, an authorized operator must review:

```sql
select clinic_id, count(*) as active_count
from public.daily_queue
where status = 'with_doctor'
group by clinic_id
having count(*) > 1;
```

Resolve duplicates through an approved clinical reconciliation workflow, retain
the actual notes/measurements and only then retry the migration. Do not blindly
keep the oldest row, fabricate completion or delete clinical records. Legacy
entries without a valid visit/measurement history require individual review.
Function ownership, grants and RLS are retained by `CREATE OR REPLACE`.

## Local validation

Database tests run only through `npm run test:clinical` against its disposable
local Supabase stack. They cover sequential/concurrent handoffs, same-request
retries, legacy RPC conflicts, rollback, clinic isolation, privileged index
enforcement, completion, overnight completion and blocked-upgrade recovery.
The upgrade fixture deliberately creates two synthetic active visits on the
previous schema, expects migration failure with rows preserved, explicitly
completes one visit, then verifies migration success and retry identities.

Authenticated browser coverage in `tests/clinical-browser/flow.spec.ts` holds
two Secretary requests at a barrier, checks the occupied message and refresh,
then checks the next handoff after Doctor completion. Existing shared-clinic
test fixtures now release active slots through the real completion RPC rather
than bypassing lifecycle guards. The disposable runner removes test records.

Public browser coverage in `tests/ui-audit/single-active.spec.ts` checks occupied
buttons, completion, a deterministic cross-tab Web Lock race, missing-lock
failure and absence of backend writes. The complete demo journeys now finish
the seeded consultation before handing off the next patient.

### Results (2026-10-27)

- PASS: `npm run typecheck -- --incremental false`.
- PASS: `npm run lint` and `node scripts/ui-style-inventory.mjs`.
- PASS: `npm run build` with all backend configuration blank.
- PASS: `node --test tests/queue-handoff.test.mjs scripts/architecture-inventory.test.mjs`
  — 9 tests (3 queue policy, 6 architecture).
- PASS: production-mode Playwright on `single-active.spec.ts`,
  `secretary-flow.spec.ts` and `architecture-foundation.spec.ts`, 390px/1280px,
  one worker — **24 passed, zero failed/skipped**. Includes both complete demo
  journeys, deterministic simultaneous handoffs and storage/lock failures.
- PASS: `node --check` for the changed/new integration runner and JS tests.
- BLOCKED / UNVERIFIED: `npm run test:clinical` could not start its disposable
  local Supabase stack because the Docker engine is unavailable. No database
  migration, concurrency, RLS, upgrade or overnight test actually ran.
- NOT RUN: authenticated clinical browser and persistence integration suites,
  blocked by the same local Docker prerequisite. Full UI audit was not run.

An earlier browser run caught loss of immediate-reload notes after queue writes
became asynchronous. That implementation regression was fixed with separate
synchronous visit-draft keys; the unchanged note-persistence assertion passes
in the final complete journeys. This was not treated as a framework defect.

No remote database, deployment, push or PR is part of this local validation.
Database integration must pass before any rollout approval.

## Changed files

- Database: `supabase/migrations/20261026204146_single_active_clinic_patient.sql`.
- Shared handoff policy: `lib/queue-handoff.ts`.
- Demo state/drafts: `lib/demo-clinic.tsx`.
- Authenticated reads/conflict mapping: `lib/clinical.ts`.
- Secretary/Doctor views: `app/secretary/clinic-flow.tsx`,
  `app/secretary/persisted-flow.tsx`, `app/doctor/visit-screen.tsx`.
- Integration runner: `scripts/test-clinical.mjs`.
- Database coverage: `tests/clinical/database.test.mjs`,
  `tests/clinical/security-contract.sql`,
  `tests/clinical/single-active-upgrade.mjs`.
- Authenticated browser/fixture coverage: `tests/clinical-browser/flow.spec.ts`,
  `tests/persistence/slice-1.spec.ts`.
- Public browser coverage: `tests/ui-audit/single-active.spec.ts`,
  `tests/ui-audit/secretary-flow.spec.ts`.
- Unit coverage: `tests/queue-handoff.test.mjs`.
- Handoff and rollout strategy: this document.
