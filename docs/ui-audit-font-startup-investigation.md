# PR #55 UI Audit font startup investigation

## Decision (2026-10-28)

No application or test-runner correction is supported by the current evidence.
Recommend one isolated rerun of failed job `122807107477` in Actions run
`40685623238`, without changing the branch. Do not push solely to trigger CI.
Keep PR #55 Draft. The rerun has **not** been requested during this investigation.

The immediate failure is confirmed: Next.js 16.4.1's Turbopack Google-font
processing rejected an internal font-resource query while compiling the root
layout. Playwright never obtained a ready application. The 120-second timeout
is a consequence, not the root failure or evidence of slow tests.

The underlying trigger remains unproven. An intermittent font-response or
Turbopack-processing failure is plausible; a Linux-only issue remains possible.
There is no evidence that PR #55 introduced the startup failure. Local success
does not establish that the Ubuntu failure is resolved.

## Checkout and CI identity

- Requested worktree: `mayanaa-demo-hydration-418`, branch
  `fix/demo-hydration-418`; initially clean.
- Local HEAD, remote branch HEAD, and PR head:
  `e30edda4aa9cf9c93eb60cdd74a01035622d84d0`.
- Remote `master`: `4d0695b074a30d6113a10843cfe0b1e900b84e09`.
- GitHub reports PR #55 as Draft, targeting `master`.
- Actions checked out synthetic merge
  `294dd2168f03bb45e50043cf34f3e5cb65f79a6b`, whose parents are the above
  master and PR heads. Its tree is
  `1fb117ca6f33b1b714ab8069902aaec6dea9c2f1`, identical to the local PR tree.
  Thus the merge checkout did not contain a different application tree.
- The initial session checkout was a different, dirty branch. No files in that
  checkout or any other existing worktree were changed. Investigation continued
  in the explicitly requested clean worktree. Master was exported into a new
  temporary snapshot, not checked out over another worktree.

## Verified failed-run evidence

Source: <https://github.com/muhammadhannan200/Mayaana/actions/runs/40685623238/job/122807107477?pr=55>.

- First attempt, `pull_request` event, Ubuntu 24.04 runner image
  `20261012.334.1`; Node `24.21.0`, npm `11.19.0`.
- Dependency installation and Chromium installation succeeded.
- `npm run audit:ui` completed the static stage and entered
  `playwright test --config=playwright.config.ts` at 12:11:01 UTC.
- At 12:11:06 UTC, generated Noto Sans Arabic CSS failed with
  `Module not found: Can't resolve '@vercel/turbopack-next/internal/font/google/font'`.
- The accompanying diagnostic was
  `next/font/google queries have exactly one entry`; debug information named
  `NextFontGoogleFontFileReplacer`. The import trace ended at `app/layout.tsx`.
- Playwright reported `Timed out waiting 120000ms from config.webServer`.
  Normal test execution was not reached. This is not an axe assertion failure.

The preceding run `40662605803` on `a6b853a` **did** start the server and execute
tests (69 passed, 3 failed). Those failures concerned document-title timing and
are distinct from this startup failure. Commit `e30edda` preserves the strict
axe assertion and synchronizes on destination URL, heading, and title first.

## Configuration and environment inspection

- `.github/workflows/ui-audit.yml` runs `npm ci`, installs Chromium headless
  shell with OS dependencies, then runs `npm run audit:ui` with `CI=true`.
  It restores npm's download cache, not `.next` compilation output. It does not
  configure Supabase secrets or font mocks.
- The audit runs lint/style inventory, followed by Playwright. The default
  webServer command is
  `npm run dev -- --hostname 127.0.0.1 --port 3100`, polling `/`.
  It does not reuse an existing server and retains its 120-second timeout.
- `UI_AUDIT_PRODUCTION=1` selects `next start`; CI does not set it.
- Playwright clears the public Supabase URL/key and secret key in the server
  environment and uses two workers under CI. No Supabase changes are needed.
- `next dev` and `next build` use Turbopack by default in the installed version.
  The installed Next.js documentation confirms the optional `--webpack` flag;
  changing bundlers was not justified by a reproduced failure.
- `app/layout.tsx` loads Noto Sans Arabic and IBM Plex Sans Arabic via
  `next/font/google`, with Arabic/Latin subsets and weights 400–700.
- `next.config.ts` applies `@tailwindcss/turbopack` to CSS. This is relevant
  context, not a demonstrated cause. No loader or typography changes were made.
- No differences exist between master and the PR in `app/layout.tsx`,
  `next.config.ts`, `package.json`, `package-lock.json`, `playwright.config.ts`,
  or `.github/workflows/ui-audit.yml`.

## Reproduction and master comparison

Local host: Windows, Node `24.21.0`, npm `11.19.0`, Next.js `16.4.1`.
There is no usable WSL installation or Docker runtime here. Consequently these
are configuration/runtime-equivalent Windows probes, **not Ubuntu reproductions**.

A temporary standalone probe launched the installed Next CLI directly with
`CI=true`, empty Supabase variables, and the same hostname/port, requested `/`,
required HTTP 200, and inspected captured output for the exact font-query
diagnostic. It terminated only its own child process tree. Cold probes moved
the worktree's ignored development output aside rather than deleting it.

| Probe | PR head | Unchanged master |
| --- | --- | --- |
| Direct Turbopack startup | HTTP 200 | HTTP 200 |
| Cold development cache | HTTP 200, twice | HTTP 200 after fresh `npm ci` |
| Exact font-query diagnostic | Not observed | Not observed |
| Playwright public-login checks at 390px | Passed | 3/3 passed |

An initial focused Playwright invocation timed out without the font diagnostic
and was terminated by the outer command deadline. It is not counted as a
reproduction of the CI bug. A diagnostic rerun using `DEBUG=pw:webserver` showed
the same configured command reaching HTTP 200 and executing 19/19 tests.
Subsequent configured-server runs also passed without a timeout increase.

The exact CI failure has therefore **not** been reproduced locally. There is
no failing local regression test that would justify a code-level fix. The
existing audit itself is the end-to-end guard against an unready server.

## Validation on the unchanged PR application

- `CI=true npm run audit:ui`: **76/76 passed**, all four widths, 5.7 minutes.
  This includes actual axe execution and the held-destination navigation test.
- `CI=true npm run audit:ui:browser -- --project=chromium-390`: **19/19 passed**.
- After a second cold-start probe, focused public-login and destination
  accessibility checks: **4/4 passed**.
- `npm run typecheck`: passed.
- `npm run lint`: passed (also covered by the full audit).
- `CI=true npm run build`: passed, default Turbopack production build.
- Master snapshot: fresh `CI=true HUSKY=0 npm ci`, cold startup and the actual
  configured-server public-login checks passed. The full master UI suite was
  not run; it predates PR #55's destination synchronization.

Expected missing-Supabase diagnostics occurred when tests visited protected
staff routes with intentionally empty configuration; guard assertions passed.
No external clinical service or migration was used. Dependency installation
reported an audit advisory; no unrelated dependency changes were attempted.

## Next safe action

With owner approval, rerun **only** the failed UI Audit job, for example:

```sh
gh run rerun 40685623238 --job 122807107477
```

If it passes and executes the normal tests, retain the evidence as an
intermittent startup incident without shipping a speculative workaround. If it
repeats the font-query error, reproduce on Ubuntu with the exact merge tree and
lockfile, then compare cold startup against master on that same runner. Only
then evaluate a test-only startup/bundler alternative and verify rendered font
styling plus the complete, unweakened audit. Do not change fonts, production
configuration, timeouts, destination synchronization, or axe expectations to
hide this failure.

Only this investigation document is intended for a local documentation commit.
No push, rerun, PR state change, merge, deployment, or remote mutation was made.
