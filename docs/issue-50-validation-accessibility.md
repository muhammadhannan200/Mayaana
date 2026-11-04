# Issue #50: Batch 3 validation and error accessibility

Scope: the owner's approved Batch 3 continuation only, after Batch 2 commit
`67dacbd7e6009547cb91094f0977243dffe789f6`, on
`fix/50-auth-ui-password-flow`. The issue and its triage comment, the
[product decisions](login-flow.md), [baseline](issue-50-auth-baseline.md) and
[Batch 2 record](issue-50-password-visibility.md) were reviewed. No separate
batch-plan file was found in the repository or issue; the owner's explicit
Batch 3 instructions define this batch's implementation scope.

## Behavior and boundaries

- `lib/auth-validation.ts` defines structured field errors shared by server
  validation and client correction feedback. Arabic text is never inspected to
  decide which field is invalid. Email uses the existing trimmed-email format
  rule; the server still lowercases email before authentication.
- Login validates required email/password and email format. Existing short
  passwords are not rejected by a new Login minimum-length policy.
- Change Password validates required fields, the existing eight-character new
  password minimum and exact confirmation equality. Passwords are not trimmed.
  The current field is validated when submitted; omitting it cannot bypass the
  existing server account/role check that requires it for optional doctor changes.
- Field errors and password hints have stable IDs, linked through
  `aria-describedby`. `aria-invalid` follows the field error map. DOM order
  determines first-invalid focus after each failed validation response.
- One form-level alert announces a short validation summary, or the existing
  credential/service error. Inline errors are descriptions, not competing live
  regions. Pending submissions hide stale summaries; correction clears stale
  messages and revalidates fields without moving focus.
- Dismissal and correction feedback are tied to the exact response being edited,
  not a form-wide edited flag. Edits during a pending submission cannot dismiss
  the server error that arrives afterward, including a repeated identical error.
  React's existing sequential action/pending lifecycle hides superseded responses
  while queued submissions are unresolved. Server Action wiring is unchanged.
- Server Actions remain directly attached through `useActionState`; browser
  submission and pending-button behavior are preserved. Both forms use
  `noValidate` for consistent Arabic errors rather than browser-language bubbles;
  required, email, minlength and autocomplete attributes remain present.
- Password fields are controlled to retain their values after an action returns
  an error. Batch 2 components are not remounted or changed, preserving independent
  visibility state and keyboard/selection behavior during correction. No password
  or form data is stored in browser storage, error responses or logs.
- No authentication/authorization policy, credential-denial policy, recovery
  behavior, Supabase settings/clients, migrations, RLS or clinical flows change.
  Other worktrees, including Issue #41, remain untouched. Batch 4 is not started.

## Validation evidence

- `node --experimental-strip-types --test tests/auth-validation.test.mjs`:
  **4 passed, 0 failed/skipped**. Covers missing/non-string values, invalid email,
  email whitespace, existing short Login passwords, new-password 7/8 boundary,
  exact matching, correction, repeated validation and non-echoed synthetic values.
  Node reports a harmless module-type detection warning; dependencies/package
  configuration were not changed to silence it.
- `npm run typecheck`, `npm run lint` and `npm run build`: **passed** in the final
  regression-fix pass. ESLint reported no warnings. Production build used blank
  Supabase configuration.
- Final production Chromium suite: **44 passed, 0 failed/skipped/flaky, 70.7 seconds** at
  320/390/768/1280px. Files: `tests/ui-audit/public-login.spec.ts`,
  `tests/ui-audit/password-visibility.spec.ts`,
  `tests/ui-audit/auth-validation.spec.ts` and
  `tests/ui-audit/auth-pending-errors.spec.ts`, two workers. This includes all 20
  Batch 2 checks plus 24 Batch 3 checks, including JavaScript-disabled native
  submission proving Login's server validation runs independently of hydration.
- Isolated delayed-response suite: **12 passed, 0 failed/skipped, 35.3 seconds**
  before the final combined run. Test-only Playwright interception fetches the
  loopback app's blank-configuration response and substitutes credential/service
  failures in its serialized action result. Explicit receive/release gates, not
  sleeps, hold responses while users edit. It covers both failure classes,
  correction after arrival, repeated identical errors, queued/superseded responses,
  preserved values/selection/visibility/focus, RTL and axe. It does not execute
  real credential checking or inject behavior into production authentication code.
- The new tests exercise blank-backend forms via native `requestSubmit()` while
  the unavailable Login button remains disabled. Valid synthetic Login input
  reaches only the blank-configuration guard, never a hosted Auth service.
- Port 3100 was occupied, so its service was neither reused nor stopped. The
  production suite used a temporary config inheriting `playwright.config.ts`,
  overriding server command, URL and baseURL to loopback port 3110 and preserving
  blank-backend environment and `reuseExistingServer: false`. The temporary config
  was removed; no production or committed Playwright configuration changed.
- Initial browser execution had **20 passed, 8 failed** because new unscoped
  alert locators also matched Next.js's empty route announcer. Scoping assertions
  to the auth form corrected the test ambiguity without changing expectations.
  The subsequent final suite above passed all checks. Final review then found the
  pending-edit dismissal regression; the response-aware fix and gated tests above
  resolve that issue. No failed checks occurred in the regression-fix runs.
- Auth suite discovery: **16 cases listed**, including three new doctor,
  first-doctor and first-secretary validation cases. Discovery used a synthetic
  placeholder key only; no hooks, server, stack or Auth requests were executed.
- Authenticated integration execution: **NOT RUN**. Docker and Supabase CLI are
  unavailable on PATH. Authenticated Change Password rendering, current-password
  enforcement, mutation, activation and end-to-end error correction remain
  unverified. No shared/hosted stack or another issue's test environment was used.

## Visual/accessibility verification and handoff

RTL, accessible field descriptions, first-invalid focus, repeated submission,
correction, password value/selection/visibility retention and axe checks passed
for Login across the four widths. Mobile 320px and desktop 1280px screenshots of
required errors and corrected/service-error states were inspected: Arabic text
wraps without control overlap or horizontal overflow. The incumbent Figma-derived
type, spacing, field and message treatment is retained; this batch does not claim
a fresh Figma pixel comparison or authenticated Change Password visual parity.

Manual screen-reader speech, external password-manager overlays and non-Chromium
engines remain unverified. Screenshots, traces, reports and other generated files
are local evidence only and are excluded from the commit. Runnable checks permit
the authorized local commit; blocked authenticated coverage remains a later gate.
No push, PR, merge or Batch 4 execution is authorized.
