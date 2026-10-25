# Isolated Auth E2E

Run `npm run test:auth` with Node 24, Supabase CLI 2.81.3, Docker, and Playwright Chromium installed. The dedicated **Auth E2E** Actions workflow runs the command twice, each time on a newly created stack with cleanup. No hosted credentials or production users are required.

The runner copies migrations into a temporary unlinked directory, checks exclusive local ports (55430–55432, 55439, 3102), starts Supabase, resets its database, builds the application with runtime-generated local keys, and runs the real browser suite. It never loads `.env.local`, links a project, or runs remote migrations. Auth users and clinic/staff fixtures are synthetic and deleted; the runner also destroys its own stack/volumes on exit.

The test-only HTTP proxy on 55439 forwards to local Supabase on 55431. It can delay password requests to verify pending/duplicate-submit behavior or return a synthetic 503 to distinguish service failure from invalid credentials. No application test switches, auth bypasses, or production fault endpoints exist.

Coverage: both roles' login and routing, cross-role denial, unauthenticated redirects, invalid credentials, inactive staff, service failure, pending duplicate-submit protection, both roles' forced first-use password setup, server length/mismatch validation, activation flag clearing, session/reload/navigation persistence, and sign-out. Only synthetic test data may appear in failure artifacts; artifact retention is seven days. Public UI Audit remains independent and unmodified.

Approved plan: https://github.com/muhammadhannan200/Mayaana/issues/20#issuecomment-6350112435

Explicit owner approval: https://github.com/muhammadhannan200/Mayaana/issues/20#issuecomment-6350156577
