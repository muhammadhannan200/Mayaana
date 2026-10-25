# Issue #50: isolated baseline and recovery investigation

Date: 2026-10-26. Scope: approved Batches 0 and 1 only.

Source: [Issue #50](https://github.com/muhammadhannan200/Mayaana/issues/50),
including its read-only triage comment. This record does not implement a fix or
claim that hosted recovery settings have been verified.

## Batch 0: isolated implementation baseline

- Branch: `fix/50-auth-ui-password-flow`.
- Base: remote `master`, `4d0695b074a30d6113a10843cfe0b1e900b84e09`
  (`docs(adr): establish initial architecture decision records (#49)`).
- The base matched the GitHub master branch and fetched `origin/master` at
  creation. Local `master` was older and was not moved.
- The new worktree had a clean status before documentation edits. It is separate
  from the original checkout and every Issue #41 worktree. No Issue #41 files,
  checkpoints, uncommitted changes, services or test stacks were inspected or
  changed. No work was copied from another worktree.
- The base commit's GitHub check runs reported success for `secret-scan`,
  `dependency-audit`, `analyze`, `code-quality` and `slice-1`. These are remote
  baseline results, not local test results or proof of recovery behavior.
- No source files, tests, dependencies, credentials, Supabase configuration,
  migrations or authentication policies are changed in these batches.
- Do not push, open a PR, merge or start Batch 2 as part of this checkpoint.

The newer master contains ADRs and Auth E2E work that were not in the earlier
audit checkout. Read [ADR-0001](adr/0001-demo-data-separation.md),
[ADR-0002](adr/0002-immutable-migration-history.md),
[ADR-0003](adr/0003-server-side-authorization.md) and
[ADR-0005](adr/0005-nextjs-proxy-convention.md). They preserve demo separation,
immutable migration history, server/database authorization and the single
`proxy.ts` boundary. No new ADR or amendment is needed to preserve those rules.

Notable integration differences from the earlier audit:

- `app/change-password/password-form.tsx` now uses `app/sign-out-form.tsx`.
- `app/actions.ts` handles failed sign-out; `lib/supabase/server.ts` can defer
  cookie writes. Preserve these fixes rather than restoring older form code.
- `tests/auth/auth.spec.ts` already covers role routing, session persistence,
  generic denial, service failures, duplicate login prevention, failed sign-out,
  mandatory password setup and failed activation after a password update.
  Extend this coverage later; do not replace or weaken it.

## Approved product decisions

The [login-flow decision record](login-flow.md) remains authoritative:

1. A signed-out secretary contacts the doctor; a signed-out doctor contacts the
   system administrator.
2. Until doctor reset controls exist, an authorized administrator handles a
   secretary reset on the doctor's request. The administrator assigns a temporary
   Auth password, sets `clinic_staff.must_change_password=true`, and delivers the
   temporary credential through the approved outside-app process.
3. Normal password sign-in leads to mandatory replacement of the temporary
   password before protected work. The new password is at least eight characters
   and entered twice. A normal secretary cannot use optional password change.
4. A doctor changing a non-temporary password supplies the current password.
5. Email-token recovery and public self-service reset are not supported or
   approved. Do not use recovery email as a substitute for this runbook. Sending
   an email does not change the password or set the staff activation flag.

The owner additionally approved these future implementation choices during
Issue #50 planning:

- Legacy recovery arrivals show fixed administrator-contact guidance only. They
  must not exchange a code/token, establish a recovery session, change a password
  or follow an arbitrary `next` destination. This guidance is not implemented by
  Batches 0 and 1.
- Optional doctor password changes use Back navigation. Mandatory replacement
  retains a clear Sign out escape and cannot be bypassed with Back.

## Batch 1: evidence and limits

### Confirmed repository behavior

| Evidence                             | Finding                                                                                                                                                                    |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/page.tsx`                       | Login/role entry uses existing staff cookies and does not handle recovery URL parameters.                                                                                  |
| `app/change-password/page.tsx`       | Existing staff session is required; a secretary without the temporary-password flag is redirected home.                                                                    |
| `app/actions.ts`                     | Password mutation independently enforces staff/role restrictions and the normal doctor's current-password requirement.                                                     |
| `lib/supabase/server.ts`, `proxy.ts` | SSR cookie plumbing refreshes existing sessions; it is not an email-token callback.                                                                                        |
| Application search                   | No `app/**/route.ts` files or application uses of `resetPasswordForEmail`, `verifyOtp`, `exchangeCodeForSession`, `PASSWORD_RECOVERY` or `createBrowserClient` were found. |
| `supabase/config.toml`               | Explicitly ephemeral tests only; its loopback Site URL uses port 3102. It is not evidence of hosted settings.                                                              |

These facts explain why merely changing an email's destination to
`/change-password` would not implement recovery. They do not establish the actual
hosted email's redirect chain or its end-to-end root cause.

### Hosted inspection: blocked, not verified

Capability checks found no `SUPABASE_ACCESS_TOKEN` in this process and no
Supabase CLI on PATH. No authenticated Supabase tool was exposed; MCP resource
discovery returned no resources/templates. The isolated worktree has no
`.env.local`. No credential values were read, copied, printed or written, and
no login, project linking, configuration update or Auth request was attempted.

| Hosted item                                        | Status                                                              |
| -------------------------------------------------- | ------------------------------------------------------------------- |
| Site URL and exact Redirect URLs                   | Not verified: authenticated read access unavailable.                |
| Recovery email template and variable usage         | Not verified.                                                       |
| Generating action and requested redirect           | Not verified; no generator found in application source.             |
| Deployed commit and actual recovery redirect chain | Not verified.                                                       |
| Valid, expired and invalid recovery email outcomes | Not executed; require a separately authorized isolated environment. |

Hypothesis only: default Site URL fallback, a redirect mismatch or template
behavior may contribute to landing on Login. Do not report a confirmed hosted
misconfiguration or broaden redirect wildcards based on this hypothesis.

### Authorized operator's read-only follow-up

1. Confirm the intended hosted environment and deployed commit without sharing
   project credentials or complete recovery URLs.
2. Inspect Authentication > URL Configuration: Site URL and exact Redirect URLs.
   Report whether they match the intended origin/path, without changing them.
3. Inspect the recovery email template's use of `ConfirmationURL`, `SiteURL`,
   `RedirectTo`, `TokenHash` and `type=recovery`. Record the template structure,
   not any actual token, recipient or email body containing personal data.
4. Identify what generated the reported email: dashboard action, external admin
   tooling or another deployment. Record whether a redirect was supplied and
   its sanitized origin/path. Public app source does not establish this fact.
5. Record only URL shapes using placeholders, such as
   `/?code=<redacted>`, `/auth/confirm?token_hash=<redacted>&type=recovery`, or
   `/#error=<redacted>`. These are candidate shapes, not observed hosted URLs.
   Do not open real links here: verification can consume one-time tokens or
   create sessions. Do not store links in screenshots, traces, logs or tickets.
6. Confirm that operational recovery uses the temporary-password runbook, not
   email recovery. Any later template/settings change or email-recovery proposal
   requires separate authorization; none is authorized by this checkpoint.

Reference: [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).
Site URL is the fallback destination when no redirect is specified. That general
behavior is not proof of this hosted project's actual settings.

## Dependencies and remaining gates

- Node `v24.21.0` and npm `11.19.0` are available; the lockfile is present.
- This worktree has no `node_modules`; no application dependency install or
  browser download was performed. Install its own locked dependencies before code work; do not
  borrow another worktree's dependencies, environment files or build output.
- Docker and Supabase CLI are unavailable on PATH. Auth E2E cannot run here yet.
  [Commands](commands.md) specifies Node 24, Docker and Supabase CLI 2.81.3.
- `scripts/test-auth.mjs` owns an unlinked disposable stack and refuses occupied
  ports 55430, 55431, 55432, 55439 and 3102. Do not stop an existing process to
  free a port or attach to Issue #41's stack. Port availability was not tested.
- Before later Next.js code edits, read the relevant installed guides after the
  dependency install: forms, error handling, redirecting and (if needed) proxy.
  Keep `redirect()` outside catch blocks that would swallow framework control
  flow; expected form errors remain return values.
- Host configuration evidence and observed legacy URL shapes remain blocked on
  authorized read access. They gate claims of end-to-end diagnosis and final
  legacy-link routing coverage, not isolated visibility-control development.
- Form/accessibility fixes, service hardening, Figma parity and legacy-link
  guidance remain future batches. Batch 2 has not begun.

## Validation and stop condition

For this documentation-only checkpoint, validate Markdown formatting, local
links, `git diff --check` and the scoped diff. No application tests, builds,
servers, Docker operations or database resets are needed or claimed as run.
Remote green checks are baseline evidence only. Any unavailable validation must
be reported rather than treated as passing.

Prettier 3.9.10 is run through npm's isolated tool cache, not an application
dependency install. Markdown content checks normalize line endings to LF because
the Windows checkout contains mixed CRLF/LF after the edit. No repository-wide
formatting or line-ending configuration change is included.

Stop after recording this baseline and investigation. Report the blocked hosted
inspection and wait for the owner's instruction before Batch 2. No push, PR or
merge is authorized.
