# Recovered safety review: single-active clinic patient

Recovered on 2026-10-27 from OpenCode session history, not reconstructed from
the subsequent fixes:

- Session: `ses_e88232aa2ffePWj87JRHgr3gly`, "Secretary and doctor flow links".
- Assistant message: `msg_17c42571b0012VPNVWuaBgZcQQ`.
- Reviewed commit: `c25354602bb0c622c61b335e89c6d21caca88ec1`.
- Comparison master: `4d0695b074a30d6113a10843cfe0b1e900b84e09`.
- SHA-256 of the original message's UTF-8 review text (before this document's
  provenance header and Markdown reflow):
  `d6186d19fe0da2e631bbb6cc7d306d680b5255b91c70856c00be0ef455d5919d`.
- Supporting scratch snapshot:
  `C:\Users\LapZone\AppData\Local\Temp\opencode\mayaana-review-c253546-20261027`.

The report below is the recovered original text. Its clean-worktree statement,
test counts, defect locations and integration assessment describe the original
review, not today's staged candidate. Recovery does not approve the fixes.
Current disposition is recorded in [release gates](../single-active-release-gates.md).

The earlier staged `docs/single-active-safety-followup.md` says the artifact was
missing. This recovery resolves that provenance gap without editing that staged
file. Accepted ADRs and the original source checkpoint remain unchanged.

---

## Verdict: hold PR and deployment

Reviewed `c253546` against latest remote master, **`4d0695b`**. The branch is clean. Issue #41 (`de1e04d`) and Doctor polish (`4623617`) remain untouched.

## Standards

**One new architecture violation:** `lib/queue-handoff.ts:1` depends on `DemoEntry`, while production `lib/clinical.ts` imports that module. This expands the coupling prohibited by `docs/architecture/module-ownership.md:31–32`. It is type-only coupling—not evidence of clinical-data leakage.

Historical migrations, server-only authorization, Doctor-private reads and `proxy.ts` are preserved. All four accepted ADRs were reviewed.

## Spec — risk matrix

| Priority             | Finding                                                                  | Evidence / required action                                                                                                                                                                                                                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P1**               | **Overnight integration fixture uses a known-unsupported SQL format.**   | `tests/clinical/database.test.mjs:283–285` sends multiple statements through `supabase db query`; `docs/clinical-persistence.md:39` documents its rejection. Use one atomic `DO` statement. **Code-confirmed; DB test NOT RUN.**                                                                                                               |
| **P1 — conditional** | **Migration may lack permission to replace the handoff function.**       | New migration `20261026204146_single_active_clinic_patient.sql:23` replaces an API-owned function. The foundation migration transfers ownership and revokes `postgres` membership at lines 457–463. A restricted executor without owner privileges will fail. Verify executor metadata and establish narrowly controlled migration privileges. |
| **P2**               | **Demo storage recovery can overwrite another tab’s committed handoff.** | **Browser-reproduced.** `lib/demo-clinic.tsx:283,340–347,368,401–402`: `memoryOnly` stops reconciliation, but later ordinary mutations can publish stale whole-store state. A confirmed `with_doctor` entry reverted to `ready`.                                                                                                               |
| **Release gate**     | **Database behavior remains unverified.**                                | Concurrency, rollback, upgrade, overnight behavior, authenticated integration and RLS tests are **NOT RUN**.                                                                                                                                                                                                                                   |
| **Integration gate** | **Issue #41 still tests the superseded multi-active behavior.**          | `tests/ui-audit/issue-41.spec.ts:362–380` expects an enabled handoff and two active patients. Reconcile with the newly approved invariant before merging branches.                                                                                                                                                                             |

### Database design assessment

By source inspection, the core approach is sound:

- Unique partial index covers **clinic**, not clinic/date.
- Named-index conflicts translate to `PT409` / `clinic_occupied`.
- The exception block encloses both writes, providing rollback of visit-start and queue changes.
- Authorized retry acknowledgement precedes revision/readiness checks.
- Existing simultaneous same-request retry coverage remains present.
- Overnight continuation/completion is limited to Doctors and already-active visits.
- Clinic scoping and private-note boundaries remain intact.

### Migration operations

Duplicate preflight and index creation occur under one transactional write lock. Failure should roll back without automatically repairing clinical records.

However:

- The five-second timeout limits **lock acquisition**, not total index-build duration.
- Existing duplicates intentionally block rollout.
- Executor privileges, applied migration history, duplicate counts and table size remain unknown.

**No authorized read-only database connection was exposed; no metadata, aggregate counts, patient identities or clinical content were queried.**

## UI overlap and preservation

Both UI branches overlap this fix in exactly:

- `app/secretary/clinic-flow.tsx`
- `app/secretary/persisted-flow.tsx`

Preserve Batch 1 navigation/VisitType components and `.persisted-clinic` wrappers, Doctor workspace markup/styles/search routing, and this branch’s handoff safeguards/conflict refresh. **Do not resolve integration by replacing whole files.** Combined behavior has not been merge-tested.

## Fresh validation

- **PASS:** TypeScript, ESLint, production build.
- **PASS:** 9 unit/architecture tests, syntax checks and static inventories.
- **Full public browser suite:** **84 passed / 4 failed**, across 320/390/768/1280px.
- Failures: unchanged streamed-status assertions at `tests/ui-audit/measurements.spec.ts:149`—expected 404, received documented HTTP 200.
- **NOT RUN:** database concurrency, migration upgrade, authenticated integration and RLS tests.

## Recommended PR/merge order

1. Address the overnight fixture, migration privilege risk and reproduced Demo overwrite.
2. Pass isolated database/security/integration checks before approval.
3. Review this invariant fix first.
4. Integrate Issue #41 Batch 1, reconciling its multi-active test.
5. Integrate Doctor polish, which depends on Batch 1; rerun combined functional and visual checks.
6. Separately approve database preflight, maintenance-window migration and compatible application release.

No files, migrations, SQL, commits, PRs or deployments were changed.

**Summary:** Standards: **1 finding**. Spec: **2 confirmed defects**, plus migration and integration release gates.
