# Deterministic UI audit (v1)

The audit runs on pull requests to `master` without an external API. It checks
the public `/` login screen only. `/change-password`, `/doctor`, `/secretary`,
and `/doctor/staff` require an authenticated Supabase account and are outside
this audit. Playwright starts a local Next.js server with Supabase configuration
cleared, even if local `.env.local` contains credentials. It does not submit the
login form or contact Supabase.

## Run locally

```sh
npm ci
npx playwright install chromium --only-shell
npm run audit:ui:static
npm run audit:ui:browser
# Or run both in sequence:
npm run audit:ui
```

The browser check uses Chromium with fixed 900px height at widths 320, 390,
768, and 1280px. At each width it runs axe against the rendered page, checks
the accessible labels and types of the login inputs, the main region, heading,
language/direction, disabled sign-in button and unavailable-service alert, and
checks document/body width and critical control bounds for horizontal overflow.
Axe covers detectable accessible-name, form-label, and contrast violations;
its absence of violations is not an accessibility certification.

The static command runs the existing ESLint configuration and prints an
informational inventory of authored CSS under `app/`: literal hex and functional
colors (plus `white`/`black`), repeated CSS spacing lengths on spacing
properties, and repeated property/value declarations. It reports locations,
but has no token policy and never exits nonzero because of inventory findings.
It does not attempt to parse all possible CSS syntax or inspect generated CSS.

## Results and CI behavior

- ESLint errors, Playwright assertions and axe violations **fail** the UI Audit
  workflow. There are no automatic suppressions or issue creation.
- Styling inventory results and ambiguous UX/design questions are **report-only**.
- Playwright prints test results in the job log and writes JSON to
  `artifacts/ui-audit/results.json`. Failures retain a screenshot and trace in
  `test-results/`. GitHub Actions uploads these results as a short-lived
  `ui-audit-results` artifact. Generated output is gitignored.

Inspect reported design opportunities manually before filing a tracked issue;
group reproducible findings by cause rather than by viewport. Authenticated
flows can be added later with isolated accounts and deterministic fixtures.
