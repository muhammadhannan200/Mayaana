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

The public demo stays fictional and browser-local. Queue writes, draft autosaves,
handoff, completion and reset use the same scoped Web Lock. Each mutation rereads
the authoritative localStorage state inside that lock. Handoff fails closed if
locking or a storage commit is unavailable; UI disabling is not its boundary.

### Draft autosave and completion

Autosave is **asynchronous**. Input appears immediately in a tab-local overlay,
but the shared per-entry draft key is written only after acquiring the lock and
checking the editor's captured base against the authoritative visit. A conflicting
edit is retained locally, not published over another tab's saved draft. Separate
draft keys do not bypass locking or make pending edits durable. Completed visits
ignore those keys.

While an autosave waits, the editor shows a saving status and registers an unload
warning. Pending or recovered edits also trigger confirmation when following a
link away from the visit. Browser warnings are best-effort, not a backup: accepting
reload, closing/crashing the tab, or otherwise leaving before confirmation can
lose uncommitted edits. **Immediate reload does not guarantee persistence.** Wait
for confirmed saving, or copy a recovered draft before leaving. A reload reads
committed browser state; it never merges or replays the abandoned overlay.

Completion compares the reviewed draft under the same lock and revalidates the
diet and appointment. It reports success only after persisting completion.
Conflict, storage or lock failure does not confirm that attempt or append history;
the editor retains an error and a copyable recovery draft.

Once the store enters its memory-only fallback (for example, after a failed
read/write, an autosave conflict, or an ordinary mutation without a lock),
isolation lasts for the store lifetime, including across visited Demo routes.
Those changes are **never** flushed back to localStorage after recovery. Ordinary
Demo operations may retain a best-effort local fallback; handoff and completion
remain fail-closed. A rejected operation that made no local mutation is not itself
a successful fallback save. Reload creates a fresh store and discards unsaved
edits. This fallback is not durable storage or an authenticated clinical-data
fallback.

### Reset outcomes and partial cleanup

Reset is an explicit, confirmed Demo-only operation. A connected successful reset
removes only this scope's draft keys, persists the seed dataset and returns
`reset`. Other tabs synchronize with that shared reset. No data shapes or storage
versions change, and unrelated keys and other scopes are not deleted.

If draft enumeration or deletion fails, reset makes the store memory-only before
it can publish a fresh shared seed. It returns `local_only`: Account remains open
with an incomplete-reset warning, while only this tab's in-memory view is reset.
The shared main document remains unchanged, so surviving drafts cannot attach to
newly reset shared patient/visit data. Already-isolated reset does not attempt
shared cleanup. Lock or main-document write failure also returns `local_only`,
not successful shared reset.

localStorage cleanup spans multiple keys and is **not transactional**. Keys removed
before a later cleanup/write failure are not restored; some saved draft edits may
therefore be lost even though the shared main document was not reset. Surviving
drafts can still appear with the original shared dataset after reload or in a new
tab. Storage recovery does not reconnect the isolated store. Reload, inspect the
remaining saved data, and explicitly retry reset from the fresh connected store;
do not assume every old draft was removed or that local-only edits survived.

Existing conflicting browser-local records are not silently removed or marked
completed. Doctor Home warns about the conflict and exposes all existing open
visits for explicit completion. New handoffs remain disabled until the slot is
free.

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

Ownership preservation is not permission to replace a function. The preceding
foundation migration transfers the three-argument handoff to
`mayaana_clinical_api`, then revokes that role from `postgres`. Do not assume a
hosted `postgres` login is a true superuser or can replace that function. See the
[read-only executor review and pre-deployment gate](single-active-safety-followup.md).

## Local validation

Use Node 24 and run the maintained browser-local regression entry point:

```text
npm run test:single-active
```

It runs all five `tests/demo-*.test.mjs` suites:

- `demo-visit-drafts.test.mjs`: stale-base detection and memory-only recovery.
- `demo-completion-drafts.test.mjs`: reviewed-draft matching and fail-closed completion.
- `demo-draft-serialization.test.mjs`: queued autosaves, completion races and unload guards.
- `demo-measurement-transitions.test.mjs`: stale intake callbacks after handoff/completion.
- `demo-reset-failures.test.mjs`: enumeration/deletion failures, partial cleanup and reset recovery.

The same command includes `tests/queue-handoff.test.mjs`,
`tests/queue-handoff-boundary.test.mjs` and
`scripts/architecture-inventory.test.mjs` (59 tests at Task 2.3B). Node expands the
quoted Demo glob, so Windows and Linux use the same selection. The existing
Code Quality workflow runs this command after installation, in addition to its
unchanged type generation, typecheck, lint and build checks. No Docker, browser
server, hosted database or real patient fixtures are needed for this command.

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

`tests/ui-audit/demo-reset.spec.ts` verifies reset failures and successful
cross-tab reset. `tests/ui-audit/demo-draft-persistence.spec.ts` deliberately holds
the shared Web Lock: pending input stays visible but uncommitted, cancelled
navigation retains it, accepting reload discards it, and releasing the lock before
reload permits confirmed persistence. These use real Chromium at the configured
320/390/768/1280px widths; they do not establish crash durability or guarantees on
other browser engines.

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

That historical implementation used synchronous separate draft keys to fix a
note-persistence regression. Tasks 2.2A–F superseded that approach with serialized,
asynchronous draft writes. Historical journey passes do not guarantee persistence
while a current autosave is still waiting for its lock. This was not treated as a
framework defect.

No remote database, deployment, push or PR is part of this local validation.
Database integration must pass before any rollout approval.

### Task 2.3C validation (2026-11-02)

- PASS: `npm run test:single-active` — 59 cases, no failures/skips.
- PASS: typecheck, lint, production build and diff checks.
- Expanded production Chromium run — **74 passed, 2 failed**, no skips, at
  320/390/768/1280px. All eight pending-autosave cases, 16 reset cases and 40
  single-active cases passed. Two existing complete journeys failed their
  unchanged `tests/ui-audit/secretary-flow.spec.ts:254` no-browser-error assertion
  at 768px and 1280px after recording React error #418 during navigation to the
  Doctor patient list.
- A separate narrow rerun of those two journeys passed 2/2. This demonstrates
  intermittency, not a repaired or fully passing browser gate. The underlying
  hydration mismatch remains undiagnosed. No Demo-store/UI behavior or existing
  assertions were changed in Task 2.3C.
- The maintained command ran locally on Windows/Node 24. CI wiring is added, but
  the GitHub workflow was not executed remotely. Chromium coverage does not prove
  crash durability or behavior on other engines. Database/RLS, Auth, persistence
  integration and restricted migration-executor acceptance remain BLOCKED/not run.

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
  `tests/ui-audit/secretary-flow.spec.ts`, `tests/ui-audit/demo-reset.spec.ts`,
  `tests/ui-audit/demo-draft-persistence.spec.ts`.
- Focused coverage: the five `tests/demo-*.test.mjs` suites, both
  `tests/queue-handoff*.test.mjs` suites and `scripts/architecture-inventory.test.mjs`.
- Maintained entry point and CI: `package.json`, `.github/workflows/code-quality.yml`.
- Handoff and rollout strategy: this document and `single-active-release-gates.md`.
