# Issue #41 Batch 1 review handoff

Date: 2026-10-26. Branch: `fix/41-figma-parity`.

## Scope

Review only the three Global UI items: secondary buttons, VisitType/visit choices,
and Secretary/Doctor bottom-navigation icons and active/inactive states.

Unfinished Account/Profile work is separated and recoverable from
`chore/41-account-profile-backup-20261026` at
`ff1f481b168c572c642485390830015bb1634bb1`. The original preservation backup at
`356d7a6` is unchanged. Secretary Account uses master's existing screen;
Doctor's account tab links to the existing `/doctor/staff`, not a new profile.
The Doctor staff page, auth and clinical contracts are unchanged. Doctor Search
is an essential destination for shared navigation and reuses existing search.

See [validation and recovery evidence](issue-41-batch-1-validation.md).
Historical provisioning/Issue #50 operator notes remain in the backup, not this
Batch 1 handoff. No account is provisioned by this work.

## Preview boundaries

Use `D:\project\mayanaa-issue-41`, not the main worktree. Confirm the branch and
process before starting a server; never stop an unrelated worktree's process.
Normal live routes require existing authentication and appropriate role access.
Do not introduce a login bypass or copy secrets/environment files for review.

Public `/demo` remains fictional/browser-local and intentionally keeps its older
styling. It is not evidence for the live-only Batch 1 UI. The focused browser
suite renders real controller/views with synthetic clinical snapshots and mocked
server-action/navigation boundaries. Its screenshots are generated artifacts,
not committed source or proof of backend behavior. The Doctor account-active
fixture renders only DoctorNav, not the real staff page.

## Prepared Draft PR outline (not published)

Title: `fix(ui): Issue #41 Batch 1 Global UI parity`

### Summary

```text
Existing clinical controller/server contracts
  -> live-only secondary buttons and VisitType/visit choices
  -> shared Secretary/Doctor navigation
     -> existing Secretary Account / Doctor staff destination
     -> existing patient-search operation for Doctor Search
```

Refs #41; do not use `Closes #41`. No Account/Profile redesign, Batch 2 feature,
migration deployment, recovery change or Supabase configuration change.

### Evidence

Previously verified Figma nodes: `199:299`, `117:263` and badge variants,
`118:276`/`118:312`/`118:313`/`118:318`, `117:249`, `117:132`.
The separation preserves those shared primitives.

Post-separation typecheck, static audit (including lint), blank-backend production
build and six architecture self-tests passed. The adapted focused suite passed
all 64 cases, with no failures/skips, at 320/390/768/1280px.
The latest post-separation complete full audit was **132 passed, 4 failed,
0 skipped**, one worker, 530.3 seconds: only the unchanged streamed HTTP status
assertions failed. All four complete-V1 journeys passed. Hydration #418 did not
recur in this daytime run and is not claimed fixed. See the validation document
for the isolated artifacts and exact limitations.

The pre-separation latest complete full audit was **131 passed, 5 failed**:
four streamed HTTP 404/200 contract failures and one date-sensitive hydration
#418 failure. The unchanged fixture initialization is present in remote master;
an in-memory clock probe reproduces the date split there, but a separate master
browser run did not establish occurrence of that exact hydration error.
No failing assertion was changed or suppressed.

Persistence, Auth, Clinical Browser and Clinical DB integration suites were
**NOT RUN** because Docker/local Supabase CLI is unavailable. No hosted backend
was substituted. These remain merge gates even if focused UI checks pass.

### Merge Danger

**Door:** two-way (presentation and essential navigation compatibility; no new
database migration or deployment).

**Blast Radius:** clinical-ui.

Ready only for human review once final scope/validation checks are recorded.
Do not merge, mark all of Issue #41 complete, or start Batch 2. The current
authorization is a local scope-separation commit only: no push or PR yet.
