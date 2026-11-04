# Single-active patient: safety follow-up

Baseline: `fix/single-active-clinic-patient` at `c253546`. Scope is the confirmed
defects enumerated in the continuation request. A separate latest read-only
safety-review artifact was not present in this worktree or the main repository's
artifact directory; no claim is made to have read that missing artifact.

## Fix boundaries

- The overnight fixture submits one atomic `DO $$ ... END $$` statement to the
  existing isolated `supabase db query --local` runner. `PERFORM set_config`
  retains the transaction-local synthetic Doctor identity for the exact-row
  date/revision update. Existing lifecycle/security assertions are unchanged.
- A failed Demo store can keep best-effort queue edits in memory, but never
  publish that disconnected whole-store snapshot. Recovery requires reload,
  which reads committed disk state and abandons unsaved queue edits. There is no
  automatic flush/merge. Missing/rejected locks use the same isolated fallback;
  handoff remains fail-closed. Separate note keys still autosave synchronously.
- `lib/queue-handoff.ts` owns a minimal neutral entry/status contract and policy
  outcome. Its generic policy preserves caller-owned fields. Demo-only storage
  outcomes belong to the Demo store. The shared module imports no Demo, React,
  routes or backend modules. This is not a broader extraction of existing debt.
- No authentication, clinical permissions, RPC conflict mapping, roles, grants,
  migration bytes or hosted state are changed. `PT409 / clinic_occupied` remains
  unchanged. Issue #41 and Doctor polish worktrees are not modified or integrated.

## Migration executor/ownership review (read-only)

Reviewed source:

- `20261023162459_clinical_foundation.sql` creates the NOLOGIN, NOBYPASSRLS
  `mayaana_clinical_api` executor, assigns mutation RPC ownership to it, and
  revokes temporary `public` CREATE and membership from `postgres` at the end.
  It deliberately excludes `clinical_queue_guard` from that ownership transfer.
- `20261026204146_single_active_clinic_patient.sql` replaces the three-argument
  handoff and the queue guard, and creates the unique queue index in one
  transaction. It makes no grants or ownership changes.

### Required privileges and invariants

For the **migration login/effective role**, not the web app:

1. CONNECT to the intended database; USAGE and CREATE on `public`; USAGE on
   `plpgsql` and on function argument/return types (UUID, integer, queue row type,
   trigger). Existing functions/signatures must already exist: missing objects
   must block rollout, not create a fresh broadly executable definer RPC.
2. Own `public.daily_queue` (or have effective owner privileges / true superuser)
   to create its index. Also be able to acquire `SHARE ROW EXCLUSIVE` on it
   (`UPDATE`, `DELETE` or `TRUNCATE` suffices for that lock; ownership supplies
   privileges). Have SELECT and visibility of **all clinics'** queue rows for the
   duplicate preflight. Partial RLS visibility is not an adequate preflight.
3. Own **both** exact functions, have effective privileges of their owning roles,
   or be a true PostgreSQL superuser. Three-argument handoff is expected to be
   owned by `mayaana_clinical_api`; guard remains owned by the original migration
   executor. EXECUTE, BYPASSRLS, CREATEROLE, a Supabase API service key or a login
   named `postgres` alone is **not** function ownership.
4. Preserve existing function owners/ACLs. Handoff remains SECURITY DEFINER with
   empty search_path and explicit staff/readiness/revision/measurement checks.
   Queue guard remains SECURITY INVOKER. Preserve authenticated EXECUTE and the
   existing lack of PUBLIC/anon execution on mutation RPCs. Do not broaden table
   writes to authenticated roles or disable/bypass RLS to get rollout working.

For the **runtime handoff owner** (`mayaana_clinical_api`), preserve the preceding
foundation's NOLOGIN/NOSUPERUSER/NOBYPASSRLS posture, inherited authenticated
membership, schema USAGE, helper EXECUTE and clinical SELECT/INSERT/UPDATE grants
and policies. The handoff needs queue SELECT/UPDATE, visits SELECT/UPDATE,
measurement SELECT, `auth.uid()` and `clinical_private.staff_role`, `lock_queue`
and `valid_measurements`. Its invoker queue trigger also requires the existing
`clinical_role` helper and measurement/visit reads under that effective role.
Do not change this runtime role as part of the follow-up.

### Safe pre-deployment verification plan

Nothing below has been run against a hosted database. An authorized operator
must separately approve and execute this plan with the actual migration login.

1. Confirm target identity, applied migration history and PostgreSQL version.
   Compare history/checksums without repairing history. Snapshot function
   definitions/owners/ACLs, role flags, memberships, table owners, RLS flags and
   policies; retain this metadata as rollout evidence (no patient exports).
2. Run catalog-only inspection in a read-only transaction. Example queries:

   ```sql
   begin read only;
   select current_user, session_user, current_database(), version();
   select rolname, rolsuper, rolinherit, rolcanlogin, rolbypassrls
   from pg_roles
   where rolname in (current_user, 'postgres', 'mayaana_clinical_api');
   select p.oid::regprocedure as signature, pg_get_userbyid(p.proowner) as owner,
          p.prosecdef, p.proconfig, p.proacl,
          pg_has_role(current_user, p.proowner, 'USAGE') as effective_owner
   from pg_proc p
   where p.oid in (
     to_regprocedure('public.clinical_handoff(uuid,integer,uuid)'),
     to_regprocedure('public.clinical_handoff(uuid,integer)'),
     to_regprocedure('public.clinical_queue_guard()')
   );
   select c.oid::regclass, pg_get_userbyid(c.relowner) as owner,
          c.relrowsecurity, c.relforcerowsecurity,
          pg_has_role(current_user, c.relowner, 'USAGE') as effective_owner
   from pg_class c where c.oid = 'public.daily_queue'::regclass;
   select has_schema_privilege(current_user, 'public', 'USAGE') as schema_usage,
          has_schema_privilege(current_user, 'public', 'CREATE') as schema_create,
          has_language_privilege(current_user, 'plpgsql', 'USAGE') as language_usage,
          has_table_privilege(current_user, 'public.daily_queue', 'SELECT') as queue_select;
   rollback;
   ```

   Verify all three signatures were returned and owners/ACLs match the source
   history. Inspect role memberships including inheritance/SET options on the
   target version; do not rely on `MEMBER` alone as effective ownership. A
   read-only transaction cannot prove DDL replacement succeeds. Do **not** probe
   DDL/locks against live data, even with an intended rollback.

3. With separately approved full-row read access, run the aggregate duplicate
   query in `single-active-patient.md`. Do not retrieve clinical content or
   auto-reconcile rows. Any duplicate requires an approved clinical workflow.
4. On a disposable local/staging database representing the same history,
   ownership, grants and **actual non-superuser migration execution context**,
   replay the migration. A local superuser-only pass does not establish hosted
   executor compatibility. Prove clean replay, duplicate rollback, lock timeout,
   owner/ACL retention, index predicate/validity, concurrency, cross-clinic RLS,
   Secretary denials, overnight Doctor completion and unchanged PT409 detail.
5. If executor ownership/CREATE is insufficient, **stop deployment**. Present
   options for separate approval: use an already-authorized migration executor;
   or commission a separately reviewed additive privilege/ownership strategy.
   Do not grant membership, change owners, edit historical migrations, use an API
   key as a DDL workaround or weaken runtime permissions in this task.
6. Only after those gates pass, plan a separately approved maintenance window:
   the five-second timeout bounds lock acquisition, not index-build duration.
   Non-concurrent index creation blocks queue writes. Recheck duplicates in that
   window; the migration rechecks under its lock. Schedule rollback/recovery and
   post-deployment owner/ACL/index/behavior checks. No rollout is authorized here.

References: PostgreSQL [CREATE FUNCTION](https://www.postgresql.org/docs/current/sql-createfunction.html),
[CREATE INDEX](https://www.postgresql.org/docs/current/sql-createindex.html),
[LOCK](https://www.postgresql.org/docs/current/sql-lock.html),
[role membership](https://www.postgresql.org/docs/current/role-membership.html).

## Validation and integration gate

Local validation results are recorded below after execution. Database, Auth,
RLS, persistence integration and authenticated browser suites require the
disposable Docker stack. Docker is not available in this environment; these
suites are **NOT RUN**, not passed. No hosted substitute is allowed.

### Local results (2026-10-27, Node 24.21.0)

- PASS: `npm run typecheck -- --incremental false`.
- PASS: `npm run lint` (the first combined-command invocation hit the shell's
  120-second limit; a standalone rerun completed successfully).
- PASS: `npm run build` with `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` blank.
- PASS: `node --test tests/queue-handoff.test.mjs tests/queue-handoff-boundary.test.mjs scripts/architecture-inventory.test.mjs`
  — 11 tests, zero failed/skipped. Node emits the pre-existing typeless-package
  warning when importing TypeScript directly; no package/module mode is changed.
- PASS: `node scripts/ui-style-inventory.mjs` (report-only existing style debt).
- PASS: `node --check` for `tests/clinical/database.test.mjs`,
  `tests/clinical/single-active-upgrade.mjs` and `scripts/test-clinical.mjs`.
  JavaScript syntax checks are not PostgreSQL execution evidence.
- PASS: `git diff --check`; no diff from `c253546` in `supabase/`, production
  authentication, clinical server operations or PT409 conflict mapping.
- Targeted production browser run: six recovery/concurrency tests passed at
  1280px before expanding lock-recovery assertions and running the full suite.
- Full production public browser audit:
  `$env:UI_AUDIT_PRODUCTION='1'; npm run audit:ui:browser -- --workers=1`
  — **108 passed, 4 failed, zero skipped**, 6.8 minutes, widths
  320/390/768/1280px. All **40 single-active cases** passed, including all
  **24 new recovery/concurrency regression runs**. Complete Secretary/Doctor
  journeys (including synchronous note autosave/reload), public accessibility,
  and architecture characterization cases passed.
- The four failures are the unchanged
  `tests/ui-audit/measurements.spec.ts:149` assertion at each width: expected
  HTTP 404, received HTTP 200 for `/measurement-preview/not-a-screen`.
  [Foundation validation](architecture/foundation-validation.md) already records
  these same four production-streaming failures. The route, assertion and
  framework config have no diff from `c253546`. This task does not alter or
  weaken the test, change production routing/auth, or claim the full suite green.
  Blank-backend signed-out checks also emit the already documented missing
  Supabase configuration diagnostic while passing their protection assertions.
- NOT RUN: `npm run test:clinical`, `npm run test:clinical:browser`,
  `npm run test:auth`, `npm run test:persistence`: Docker executable unavailable
  (`docker info` could not be invoked). No DB, Auth, RLS, upgrade, overnight or
  authenticated-browser integration verdict is inferred from browser/unit tests.

**Local commit withheld:** the request permits a commit only if all runnable
tests pass. The existing four full-audit failures keep that gate closed, even
though every scoped regression passes. HEAD remains
`c25354602bb0c622c61b335e89c6d21caca88ec1`; the eight task files are left staged,
uncommitted, for review. No push, PR, merge, deployment or branch integration.
The separately missing review artifact and the database/executor gates also
remain explicit follow-up items. A baseline-failure exception or separately
approved resolution is required before creating the follow-up commit.

Regression evidence: before the implementation change, production-browser
reproductions showed a read failure and a draft-write failure each reverting
another tab's committed handoff to `ready`; unlocked completion wrote the shared
store, and rejected locks prevented fallback completion. The architecture test
also failed on the direct `demo-clinic` type import. These are test-driven
confirmations, not hypothetical findings. A first queue-write reproduction
needed its test navigation corrected; that timeout was not an application bug.

Recommended order (no integration started):

1. Retain `c253546` and this follow-up as sequential local checkpoints.
2. Read the missing review artifact when supplied; run the isolated DB/upgrade,
   Auth/RLS/persistence and authenticated browser suites on a Docker-capable
   machine, then verify the real migration executor in disposable staging.
3. Obtain a fresh safety review and human approval of the behavior/rollout gates.
4. Plan integration with Issue #41 and Doctor polish owners only after preserving
   their checkpoints. Re-run combined branch validations before any later PR or
   deployment. Do not start merges/cherry-picks or hosted migration now.
