# Issue #50 — A2 / Phase 1 results

Date: 2026-11-02. Worktree: `mayanaa-issue-50`, branch
`fix/50-auth-ui-password-flow`. All incoming staged, unstaged and untracked
candidate changes were retained. No commit, staging, push, PR or merge performed.

## Small outstanding fix

The approved guidance-only legacy recovery behavior in
[the decision record](login-flow.md) and [baseline](issue-50-auth-baseline.md)
was still missing. A new synthetic URL regression failed before implementation.

- `/auth/confirm` now explains the administrator-managed temporary-password path,
  explicitly says email links do not change passwords, and offers a fixed Login
  link with visible keyboard focus. It uses existing Auth styles and Arabic RTL.
- The existing `proxy.ts` redirects recognized Login query shapes to that fixed
  page before rendering. Login handles matching fragment shapes after hydration,
  including later hash changes, using a fixed replacement destination.
- Codes, tokens, errors and `next` values are not verified, exchanged, followed,
  stored or displayed by the added code. No recovery session or password-update
  form is created. The guidance page sets a no-referrer policy.
- No existing Auth action, validation policy, password control, authorization,
  Supabase client/configuration, migration or activation behavior was changed by
  this pass. The incoming preflight, Back navigation and validation fixes remain.
- Added public regressions for code/token-hash, fragment and expired-error URL
  shapes, unsafe `next`, no cookies/storage/mutation, keyboard navigation, axe,
  viewport fit and query guidance without JavaScript.
- Added five isolated real-Auth cases for existing-session retention through
  guidance (both roles and mandatory replacement) and optional doctor change with
  wrong-current-password correction, field retention and old/new credential checks.
  These cases are discovered but **NOT RUN**.

## Fresh executable evidence

| Check | Result |
| --- | --- |
| `node --experimental-strip-types --test tests/auth-validation.test.mjs tests/password-preflight.test.mjs` | **25/25 PASS**: 4 validation + 21 offline preflight |
| Production public Chromium suite, two workers, 320/390/768/1280px | **52/52 PASS**, no skips or retries, 1.7 minutes |
| `npm run build` with blank Supabase configuration | **PASS** |
| `npm run typecheck` | **PASS** |
| `npm run lint` | **PASS** |
| Auth E2E discovery only | **26 cases listed**, not executed |

Public suite files: `public-login.spec.ts`, `password-visibility.spec.ts`,
`auth-validation.spec.ts`, `auth-pending-errors.spec.ts`, `legacy-recovery.spec.ts`
under `tests/ui-audit`. The production run used a temporary config inheriting
`playwright.config.ts`, overriding only the server/base URL to loopback port 3110;
blank-backend guards and `reuseExistingServer: false` were preserved. The temporary
config was removed afterward. Existing Playwright configuration was not changed.

An intermediate production run had 44 passes and 8 failures: awaiting query
parameters in the page broke no-JavaScript action-state replay and streamed
redirects did not show guidance without JavaScript. Moving query routing into
the existing proxy restored the original Login render path. The final 52/52 run
above includes the unchanged no-JavaScript validation test. Dev-only passes were
not used as production evidence.

The final suite covers Login visibility/value/selection retention, required and
format correction, first-invalid focus, pending/repeated/queued error responses,
touch, RTL and axe. Mobile/desktop guidance screenshots were inspected: no text
overlap or horizontal overflow. Generated screenshots/results are local evidence,
not Auth acceptance. Node's existing module-type detection warning remains.

## Real Auth acceptance: NOT RUN

Executable probes for both `docker --version` and `supabase --version` returned
`ENOENT`. No isolated Auth stack is available. No stack, migrations, real accounts,
hosted Supabase requests or configuration changes were attempted. The isolated
runner was not started; test discovery used synthetic placeholders only and ran
no hooks, server or Auth requests.

Still **NOT RUN** against real Auth:

- Doctor/secretary login, denial, session persistence and logout/retry.
- Authenticated Change Password visibility, validation, error correction and
  field retention; optional doctor's current-password enforcement and mutation.
- Temporary-password mandatory replacement for both roles, activation, activation
  failure recovery and route-bypass prevention.
- Real session retention through the new legacy guidance.
- Valid/expired/invalid real email links and deployed redirect/template settings.
  Synthetic URL-shape passes do not establish token validity or hosted behavior;
  email-token recovery remains unsupported by policy.

Manual screen-reader speech, external password managers, non-Chromium engines and
authenticated mobile/desktop visual acceptance remain unverified. Issue #50 must
not be represented as fully accepted or closed on these offline/public results.
