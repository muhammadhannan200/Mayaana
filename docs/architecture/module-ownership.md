# Architecture ownership

Scope: ARCH-01/02/03, based on merged clinical baseline `ca3892b` (PRs #36,
#37 and #38). This document describes current ownership and future direction;
it does not authorize moving application files or changing product behavior.

## Current ownership

| Area                    | Current modules                                                                                                                 | Responsibility and intended ownership                                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Routes                  | `app/**/page.tsx`, layouts, error files                                                                                         | Compose screens, parse route inputs and apply role-specific entry checks; not domain logic. Preserve current URLs.                                                       |
| Secretary               | `app/secretary/clinic-flow.tsx`, `measurements/measurement-screen.tsx`                                                          | Queue, intake, search, confirmation, measurements and account screens.                                                                                                   |
| Doctor                  | `app/doctor/visit-screen.tsx`, Doctor routes; Doctor branches in `app/secretary/clinic-flow.tsx`                                | Home, patient records and visit editing. Doctor screens must not be owned by Secretary modules long-term.                                                                |
| Clinical model          | `lib/clinical-types.ts`; types/metadata currently also in `lib/demo-clinic.tsx` and `app/secretary/measurements/mock-visits.ts` | Patient, queue, measurements, visits and diet contracts need neutral ownership. Current demo/route dependencies are recorded debt, not an approved pattern.              |
| Authenticated client    | `app/secretary/persisted-flow.tsx`                                                                                              | Authoritative snapshot refresh, polling, revisions, mutation locking and retry identities for both roles. Unsaved drafts remain in memory.                               |
| Clinical server         | `app/clinical-actions.ts`, `lib/clinical.ts`                                                                                    | Explicit server-action entry points, verified session/staff checks, clinic-scoped reads and existing transactional RPC calls.                                            |
| Demo and preview        | `app/demo/`, `app/measurement-preview/`, `lib/demo-clinic.tsx`, `mock-visits.ts`                                                | Fictional fixtures, public browser-local demo store and preview defaults. Never import demo records into clinical tables.                                                |
| Shared UI               | `app/secretary/components.tsx`, shared markup/styles embedded in screens                                                        | Icons, navigation mechanics and repeated presentation currently lack neutral ownership. There is no root `components/` directory at this baseline.                       |
| Authentication          | `lib/auth.ts`, `app/actions.ts`, `proxy.ts`, sign-in/password/sign-out forms                                                    | Verified identity, administrator-managed staff membership, role routing and session lifecycle.                                                                           |
| Supabase infrastructure | `lib/supabase/server.ts`, `admin.ts`; `supabase/config.toml`, `supabase/migrations/`                                            | Server cookie/session client, narrowly used privileged Auth client, disposable test-stack configuration and immutable SQL history. Not shared UI or demo infrastructure. |
| Tests                   | `tests/ui-audit/`, `auth/`, `persistence/`, `clinical/`, `clinical-browser/`                                                    | Public RTL/accessibility/demo checks; isolated Auth; Slice 1 contracts; SQL lifecycle/security/upgrade contracts; authenticated multi-session browser journeys.          |
| Test tooling            | `scripts/test-{auth,persistence,clinical}.mjs`, Playwright configs, `.github/workflows/`                                        | Own disposable local stacks, synthetic identities, test servers and validation evidence. Never attach to production.                                                     |

## Dependency rules

These are design rules, not newly enforced lint/CI failures. Existing exceptions
remain visible in [the dependency baseline](dependency-baseline.md).

- Route files should compose screens, not own domain logic.
- Doctor screens must not be owned by Secretary modules long-term.
- Clinical model code must not depend on React or `app/`.
- Production contracts must not depend on `Demo*` types or fictional fixtures.
- Shared UI must not import Supabase code or server actions. Pass display data
  and callbacks through its interface instead.
- Demo persistence and authenticated persistence must remain separate. The
  public demo key is `mayanaa-demo-v1:public`; authenticated routes may retire
  the obsolete clinic-scoped demo key but must not store clinical data locally.
- Server-only modules must remain server-only. Preserve `server-only` markers,
  server-action entry points and the privileged-client separation. Client
  controllers may call explicit server actions; neutral shared UI may not.
- Historical migrations remain immutable. Never rename, repair or rewrite
  history as part of an application refactor.
- Refactors must preserve auth, RLS, revisions, retry identities, RPC contracts
  and current URLs. Layout checks do not replace mutation authorization.
- Preserve Doctor-private notes/diet isolation, failed-draft retention and
  explicit discard confirmation. A failed request is not a successful save.
- Keep pure logic, browser journeys and database contracts distinguishable.
  Tests cross the same interface as callers; avoid exporting internals just
  for tests or adding shallow pass-through modules.

## Task reconciliation

Status checked on 2026-10-25:

- PR #36 (Slice 1), PR #37 (isolated Auth E2E) and PR #38 (clinical lifecycle)
  are merged. Older slice documents describe historical scope, not the full
  current implementation. PR #38 merged on 2026-10-24.
- Issue #20 is still open. PR #37 supplies substantial coverage, but a human
  must compare its acceptance criteria with repeatable CI evidence before
  deciding whether to close it. This task does not close or edit the issue.
- Issue #41 remains open and untouched. Its UI and behavior work is not part
  of these foundation tickets. Do not inspect or alter its uncommitted worktree.
- Issue #19 was repository housekeeping, not a completed application-module
  refactor. Do not reopen it merely to track the work below.

## Ticket sequence

| Ticket  | Foundation scope                                      | Verification                                                                                                                             |
| ------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| ARCH-01 | Ownership, dependency rules and status reconciliation | Review references against merged code and GitHub status; no application changes.                                                         |
| ARCH-02 | Independent route/storage characterization            | Public tests in the existing UI audit; authenticated tests only through the disposable clinical runner. Existing assertions stay intact. |
| ARCH-03 | Report-only dependency inventory                      | Self-tests plus a source inventory detecting known debt without rewriting files or failing CI on findings.                               |

ARCH-04 and later are not started. Contract extraction, cycle removal, screen
extraction and CSS migration must wait for preservation/integration of the
relevant #41 work and a fresh review of then-current `master`.

## Characterization commands

```sh
node --test scripts/architecture-inventory.test.mjs
node scripts/architecture-inventory.mjs
npm run audit:ui:browser -- tests/ui-audit/architecture-foundation.spec.ts
npm run test:clinical:browser
```

The last command discovers `tests/clinical-browser/architecture-foundation.spec.ts`
alongside existing clinical journeys. It needs Node 24, Docker, the pinned
Supabase CLI and a disposable local stack. Do not replace it with hosted
credentials or claim local authenticated validation when those tools are absent.

Public tests check direct demo/preview entry, reload persistence, invalid-route
recovery, signed-out role entry guards and no demo backend writes. Authenticated
tests check both roles' direct entry, cross-role redirects, local-demo poisoning,
real snapshot refresh and preservation of the public demo key. They characterize
the existing interface, not unfinished #41 designs. Existing UI tests continue
to own the broader accessibility, RTL and responsive baseline.

See [foundation validation](foundation-validation.md) for executed checks,
existing failures and local infrastructure limitations.
