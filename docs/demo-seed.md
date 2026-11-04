# Fictional clinic seed

`npm run seed:demo` prints a plan only. It performs **no network calls**, reads
no environment files, and creates no files. `--dry-run` is an explicit alias.
This is independent of the browser-local `/demo` fixtures; none are imported.

## Dataset

- Exactly one clinic: **عيادة العرض - بيانات وهمية**.
- Doctor: `doctor@mayaana-demo.example.com`; secretary:
  `secretary@mayaana-demo.example.com` (reserved example-domain addresses).
- Eight original fictional Arabic patients, each explicitly marked وهمي.
  Phones `+12025550100`–`+12025550107` use NANPA's reserved fictional
  202-555-0100–0199 range, not Syrian subscriber numbers. Never call/message them.
- One Asia/Damascus service day: two waiting, two ready, one with the doctor,
  three completed. Six measurement sets, eight visits, three completed history
  entries, and four private notes/diet documents/future appointments (including
  the active patient's draft). Three sample meals per diet day; not medical advice.
- Completed history is created by actually finishing visits today, **not by
  backdating**. The exposed RPCs do not support historical service-day insertion.

## Configuration and deliberate writes

Node 24 and installed npm dependencies are required for writes. The owner must
separately prepare a **disposable local Supabase database** with this repository's
checked-in migrations. This script does not deploy migrations or reset databases.
Do not target production or any real clinic. Hosted URLs are explicitly refused.

Supply these through the process environment, never `.env.local` or CLI secrets:

| Variable                               | Meaning                                                         |
| -------------------------------------- | --------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Loopback Supabase API URL, e.g. `http://127.0.0.1:54321`        |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | That local stack's public/anon key                              |
| `SUPABASE_SECRET_KEY`                  | That local stack's server-only secret/service-role key          |
| `SEED_DOCTOR_PASSWORD`                 | Doctor password, at least 12 characters                         |
| `SEED_SECRETARY_PASSWORD`              | Different secretary password, at least 12 characters            |
| `SEED_CONFIRM_PROJECT_REF`             | Exact URL hostname (`127.0.0.1` in the example)                 |
| `SEED_LEDGER_PATH`                     | Absolute private path outside the repository; parent must exist |

For local URLs, the hostname is the confirmation identifier (there is no hosted
project ref). Every request is restricted to that origin; redirects are refused.
Keys, passwords and Auth session tokens are never printed or saved by the script. Supply
passwords securely, not via shell history. Seed accounts are created confirmed,
active and password-ready solely for this disposable fictional environment.

```sh
npm run seed:demo
npm run seed:demo -- --dry-run
# Owner only, after configuring all variables and reviewing the dry-run:
npm run seed:demo -- --write
```

No write mode was executed during implementation. No hosted connection is needed
for validation. A safe offline validation example in PowerShell:

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL = 'https://fictional.invalid'
$env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'fake-public-key'
$env:SUPABASE_SECRET_KEY = 'fake-server-key'
$env:SEED_CONFIRM_PROJECT_REF = 'fictional'
$env:SEED_DOCTOR_PASSWORD = [guid]::NewGuid().ToString()
$env:SEED_SECRETARY_PASSWORD = [guid]::NewGuid().ToString()
node --check scripts/seed-demo-clinic.mjs
npm run lint
npm run seed:demo -- --dry-run
```

## Ownership, reruns and boundaries

Keep the same private ownership ledger for every rerun. It binds the exact clinic
name, fixed clinic UUID, database origin, random ownership token, Auth IDs,
original service day and full synthetic row snapshots. Auth ownership is checked
against admin-controlled `app_metadata`, not user-editable metadata. These markers
are **not** used for application authorization; actual staff rows and RLS are.
Protect the ledger with OS permissions (POSIX mode 0600 is requested; Windows
operators must protect its directory with ACLs). It contains fictional records
only, no passwords, API keys or session tokens. Never commit it.

Before every privileged write the script verifies the exact clinic name and
ownership against the ledger and existing directory/Auth records. Before the
clinic exists, it verifies absence at the fixed UUID and exact name, then uses
the ledger's intended name and token. Existing rows are never adopted. Privileged
writes are **inserts only**: two Auth users, one clinic and two staff rows. Admin
reads inspect only the directory and those known Auth IDs, not clinical tables.
All patient/enqueue/measurement/handoff/draft/finish mutations use real separately
authenticated secretary/doctor RPC clients. Doctor-authenticated reads inspect
every row in all seven clinical tables for this clinic, including private data.
Truncated results, unknown rows, altered rows, missing rows or changed ownership
cause refusal. Each RPC's captured delta must match its own patient/visit and actor.

A successful second run verifies the same records and writes **no seed
records** (password sign-in still creates Auth sessions). It never creates a second service day, even on a later date. Keep the
ledger: losing it intentionally makes the script refuse an existing clinic.
Incomplete seeds can resume completed, acknowledged steps on the same day only.
Each mutation is journaled before sending it. A lost response, crash or uncertain
write leaves a pending journal entry and is **not retried or adopted**. A stale
exclusive lock also refuses execution; owner investigation is required. This
fail-closed behavior favors avoiding duplicates over automatic crash recovery.

Run on an unused local stack with no concurrent app sessions, other seeders or
manual database edits. The local lock serializes runs sharing the ledger; it is
not a database-wide lock. The existing RPCs provide revision checks but cannot
make multi-request ownership verification atomic against arbitrary concurrent
database administrators. The script does not claim that guarantee. The three
completed handoffs run sequentially before the single active handoff.

There is **no cleanup mode**, deletion, trigger disabling or completed-record
protection bypass. For a fresh demo, the owner separately resets the disposable
database and uses a new ledger path. Never reset a shared or production database
as a demo refresh. Do not erase the ledger to try to adopt existing records.

## Verification limits

Static syntax, lint and offline fake-environment dry runs do not establish live
RPC compatibility, applied migration state or end-to-end idempotency. Those need
a separately authorized disposable-local write test; they were not run here.
