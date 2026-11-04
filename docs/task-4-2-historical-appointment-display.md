# Historical appointment display

## Scope

Integrates local commit `dbd8e0b` onto fetched `origin/master` at `a4eb6d7`,
including PR #55's demo hydration and live-calendar changes. Work is isolated on
`fix/historical-appointment-dates` in `D:/project/mayanaa-history-dates`.

- Completed visits show only their saved appointment. An absent appointment
  displays `لم يُحدّد موعد متابعة` without an automatic-calculation hint.
- Completion timestamps are formatted in `Asia/Damascus`, preserving the
  `YYYY-MM-DD` and `YYYY-MM-DD · HH:mm` labels and a 00–23 hour cycle.
- Stored timestamps, appointments and mutation operations are unchanged.
- No migrations or Secretary flow refactors are included. The only
  `lib/clinical.ts` change is the original completion-date formatting fix.

## Differences from dbd8e0b

The completed-visit guard is applied inside master’s `appointmentOn` helper.
PR #55's live demo calendar, hydration snapshot, custom-date handling, active
suggestions, input minimum and action-time/final-write validation remain intact.

The alternative worktree was inspected read-only. Its leap-day and historical
Damascus winter-offset cases add coverage and are included in the existing
public screen-read test. Its helper extraction and duplicate UI suite are not
adopted. Code Quality CI now runs the history test; the existing UI Audit picks
up the historical appointment spec automatically.

## Validation boundaries

`history-display.test.mjs` exercises `getClinicScreen` with a synthetic,
read-only Supabase adapter. Eight cases cover clinic midnight, year rollover,
an explicit offset, leap day and the pre-2022 winter offset. This proves display
wiring, not database integration, RLS or authenticated persistence.

The historical browser suite uses fictional browser-local data at four widths.
It covers saved/absent appointments, reload, calendar changes, unchanged stored
records, read-only notes, retained diet, active suggestions, invalid custom
dates and final completion. Console errors and mutation requests must be absent.

Local commands:

```powershell
npx next typegen
npm run typecheck
npm run lint
node --test tests/clinical/history-display.test.mjs
node --test tests/demo-hydration/store.test.mjs
npx playwright test --config=playwright.historical-appointment.config.ts tests/ui-audit/historical-appointment.spec.ts --workers=1
npx playwright test --config=playwright.demo-hydration.config.ts
```

The historical config uses a dedicated port and refuses existing servers.
The PR records actual validation results. Docker is unavailable locally:
database/RLS and authenticated browser results must come from PR CI, not from
these synthetic or demo tests. No stored historical dates are repaired or
reinterpreted as suggestions. The PR must remain unmerged for owner approval.
