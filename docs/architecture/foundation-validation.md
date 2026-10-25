# Architecture foundation validation

Scope: ARCH-01/02/03 only, from refreshed remote `master` at `ca3892b`.
No application implementation, test configuration, dependency manifest,
workflow, Supabase configuration or SQL file is changed.

## Checks

| Check                                                 | Result                                                                                                                                                           |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                                   | Passed, including both new browser specs.                                                                                                                        |
| `npm run lint`                                        | Passed.                                                                                                                                                          |
| `npm run build`                                       | Passed with backend environment variables blank; production compile/static generation completed.                                                                 |
| `node --test scripts/architecture-inventory.test.mjs` | Six passing self-tests: runtime/type-only cycles, re-exports/lazy imports, ownership rules, parser false positives, size signals and scoped filesystem scanning. |
| `node scripts/architecture-inventory.mjs`             | Passed; report contains the retained runtime cycle and production/demo coupling. Findings do not fail the command.                                               |
| Focused public browser tests, production server       | 20 passed: five cases at 320/390/768/1280px.                                                                                                                     |
| Full public browser audit, production server          | 68 passed, four existing status-code assertion failures (one at each width); see below. All 20 new cases passed.                                                 |
| Full public browser audit, development server         | 70 passed, two document-title accessibility failures in the unchanged Secretary journey at 390/1280px. All 20 new cases passed.                                  |
| `npm run audit:ui:static`                             | Passed; existing CSS inventory remains report-only.                                                                                                              |
| Authenticated spec discovery                          | Eight cases discovered: Doctor/Secretary at four widths. Discovery uses dummy keys and performs no database/network operations. This is not an integration pass. |
| Authenticated execution                               | Not run locally: Docker and Supabase CLI are unavailable. Existing Clinical Browser Flow CI discovers the new spec automatically.                                |

Public browser command:

```powershell
$env:UI_AUDIT_PRODUCTION='1'
npm run audit:ui:browser -- tests/ui-audit/architecture-foundation.spec.ts --workers=2
```

Authenticated execution must use `npm run test:clinical:browser`, which owns
a disposable local stack. No hosted credentials or personal accounts are needed.
Existing Auth and Persistence harnesses are unchanged; their local execution
has the same missing-tool prerequisites.

## Existing diagnostics, not fixed here

- The normal development-server run reports axe `document-title` violations
  in the unchanged `tests/ui-audit/secretary-flow.spec.ts:89` journey at 390px
  and 1280px: the document title is empty when axe inspects after navigation.
  That journey passed at those widths in production mode. The cause is not
  established by these foundation tickets; no title assertion, accessibility
  rule or application metadata is changed. An earlier development run exceeded
  the command's two-minute limit; the complete rerun used a longer limit.
- The unchanged `tests/ui-audit/measurements.spec.ts:149` requires HTTP 404
  for `/measurement-preview/not-a-screen`. Production streaming returns 200
  with the not-found UI and `noindex`; the assertion fails at all four widths.
  The installed Next.js guide `dist/docs/01-app/03-api-reference/03-file-conventions/not-found.md`
  documents this streaming status behavior. The existing assertion is not
  changed, skipped or weakened. New characterization tests check the actual
  not-found UI/robots contract and allow the documented 200/404 transport split.
- Signed-out direct-route checks with deliberately blank backend configuration
  emit a server-side `Supabase public configuration is missing` diagnostic.
  Redirect/login assertions still pass. The staff page performs its own account
  lookup, whereas the surrounding layout checks configuration. Application
  source is unchanged; do not hide this diagnostic by weakening tests or adding
  a production test switch.
- `npm audit` reports one high-severity **development-only** transitive finding:
  `zod@4.6.5`, GHSA-mrhx-c7xc-m3w5, through the React Hooks ESLint tooling.
  `npm audit --omit=dev` reports zero findings. Dependency updates are outside
  these tickets; the manifest and lockfile remain unchanged.

## Safety audit

- Only this new architecture worktree is used for implementation and validation.
  The protected Issue #41 worktree is not inspected, moved, stashed or modified.
- Application source, current URLs, role checks, RPC contracts and retry/revision
  behavior are unchanged. ARCH-04 and later are not started.
- No database, RLS, RPC, migration/history, production environment or production
  data changes are made. No hosted deployment is performed.
- Issue #20 is not closed; Issue #41 is not edited or closed. The PR must remain
  unmerged for human review.
