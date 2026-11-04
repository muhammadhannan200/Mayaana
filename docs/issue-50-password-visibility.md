# Issue #50: Batch 2 password visibility

Scope: password visibility only, on `fix/50-auth-ui-password-flow`, following
the [Batch 0/1 baseline](issue-50-auth-baseline.md) and the approved plan.
Batch 3 and later are not started.

## Behavior

- Login password and Change Password current/new/confirmation fields use the
  shared `app/password-input.tsx` component. Mandatory first-use screens retain
  only their existing new/confirmation fields.
- Each mounted field starts hidden and owns independent in-memory visibility
  state. No visibility or password value is saved to browser storage.
- Native `type="button"` controls expose Arabic show/hide action names and
  `aria-controls`. The label names the affected field; the eye/eye-off SVG is
  decorative. Changing action labels communicate the available action rather
  than combining changing labels with `aria-pressed` toggle semantics.
- Controls support Tab, Shift+Tab, Enter, Space, pointer and touch. Pointer
  activation preserves input focus when the input was being edited; keyboard
  activation keeps focus on the button. Selection direction/range and horizontal
  input scroll are restored after changing type without remounting the input.
- Existing values, names, autocomplete, required/minimum-length attributes,
  controlled/uncontrolled ownership and form actions remain unchanged. Toggles
  have no submitted name/value and cannot submit the form.
- RTL places the control on the left, opposite Login's existing lock. Scoped
  padding avoids text overlap. Touch targets are 44 by 44px and keyboard focus
  uses the existing deep-teal token. Input size and screen layout are unchanged.

## Intentional Figma addition

The reviewed Login frames `118:3` and `181:3622`, Change Password `195:1276`
and New Password `146:846` show lock icons, not visibility controls. Eye toggles
are an intentional Issue #50 accessibility/usability addition, using the
existing 20px/1.8px-stroke icon treatment, muted slate and teal tokens, and
existing rounded field styling. This batch does not claim full Change Password
Figma parity or alter navigation, help text or recovery policy.

## Tests and validation

- Focused public suite: `tests/ui-audit/public-login.spec.ts` and
  `tests/ui-audit/password-visibility.spec.ts`, using production mode at
  320/390/768/1280px. Covers default masking, mouse/touch reveal/hide, field value,
  selection, keyboard focus, native button semantics, no accidental submission,
  unchanged form data, reload masking, 44px targets, RTL/overflow and axe.
- Shared assertions live in `tests/password-visibility.ts`. Existing input
  locators now use exact label matching where needed: accessible button names
  intentionally contain the corresponding input label.
- Three added cases in `tests/auth/auth.spec.ts` exercise independent current,
  new and confirmation toggles for a doctor, plus new/confirmation for mandatory
  doctor and secretary setup. Each waits for the expected authenticated destination
  after Login before navigating to Change Password, using the existing retrying
  URL assertion pattern rather than a timeout. They also verify Enter still
  dispatches a native form submit. Submission is intercepted in the test before
  any server action; synthetic visibility-test values never mutate Auth or staff records.
- Final validation: `npm run typecheck`, `npm run lint` and `npm run build`
  passed (exit 0); the production build used blank backend configuration.
  With `UI_AUDIT_PRODUCTION=1`, `npx --no-install playwright test
  --config=playwright.config.ts tests/ui-audit/public-login.spec.ts
  tests/ui-audit/password-visibility.spec.ts --workers=2` passed **20/20** in
  34.2 seconds (zero failures or skips), across all four Chromium widths. Auth test
  discovery found all 13 cases, including the three additions; discovery is not
  an authenticated test pass. Discovery initially failed because the module-level
  Supabase client requires a key even with `--list`; repeating discovery with a
  synthetic placeholder key succeeded without running hooks, a server or requests.
- Auth E2E execution is **NOT RUN**: Docker and Supabase CLI are absent. This
  blocks all 13 Auth cases, including the three new authenticated visibility cases
  for doctor, first-doctor and first-secretary. Do not
  substitute hosted credentials or another issue's stack. Dependencies were
  installed locally from the unchanged lockfile; no dependency update is made.
- Mobile/desktop Login screenshots were inspected at 320 and 1280px with fake
  input only. No control overlap or horizontal overflow was observed. Change
  Password rendering and actual authenticated submission remain unverified
  locally until the isolated Auth runner is available. Other browser engines
  and external password-manager overlays have not been verified.

## Safety and handoff

Authentication actions, SSR/proxy clients, Supabase settings, credentials,
schemas, RLS and administrator-managed temporary-password recovery are unchanged.
Issue #41 worktrees, checkpoints and uncommitted work were not inspected or
modified. Generated browser artifacts are local evidence, not commit contents.

The owner authorizes a local Batch 2 commit after all runnable checks pass,
with the authenticated coverage limitation explicitly retained. A local commit
does not establish that blocked Auth tests or authenticated Change Password
execution passed. No push, PR, merge or Batch 3 is authorized by this work.
