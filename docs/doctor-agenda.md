# Doctor Home appointments

Doctor Home shows **متوقع اليوم** and **متأخر**, using saved date-only
appointments. Today and completed-visit dates are interpreted in Asia/Damascus.
Each patient appears once, using their latest appointment date. A future
appointment supersedes an older overdue appointment. Any entry in today's queue
(including completed entries), or a completed visit on/after the appointment
date, excludes the patient. Incomplete visits do not fulfil an appointment.

`app/doctor/agenda-actions.ts` authenticates each request and resolves the active
staff account on the server. Only doctors who have completed password setup can
read the agenda. The caller's RLS-protected client is used; no privileged client,
client-supplied clinic, migration, RPC or clinical write is introduced.

`lib/doctor-agenda.ts` selects only patient ID/name, appointment dates, queue
patient IDs, and visit completion timestamps. All reads filter by the resolved
clinic. It never selects private notes, diet, measurements or contact details.
Reads have explicit safety bounds:

- Up to 200 candidate appointment rows dated today or earlier (201st sentinel).
- At most two batches of 100 distinct patient IDs.
- Per batch: 100 patients, 100 today's queue entries, 500 appointment rows
  (including future dates), and 500 completed visits, each with a sentinel.

An exceeded bound, read error or missing patient produces an Arabic unavailable
state with retry, not a silently incomplete or false-empty agenda. This is a
bounded operational view, not an unbounded appointment archive. The UI refreshes
every ten seconds while visible and on focus/visibility changes; midnight uses
the next read's Damascus date. No appointment time-of-day is inferred.

`/demo` never calls the server action. It derives the same sections from fictional
browser-local visit appointment metadata and its current-day queue. Legacy demo
records without appointments remain valid; no fake appointments are substituted
for missing data. New demo completions retain date-only service/appointment
metadata without changing their localized display date.

Validation: `npm run test:agenda` covers classification, Damascus midnight,
authorization, clinic isolation and query bounds. `doctor-agenda.spec.ts` covers
RTL, patient navigation, empty states, local-only data and midnight refresh at
all UI-audit widths. The clinical DB/RLS CI suite runs the actual reader against
isolated PostgREST fixtures; Docker is required and is not available locally.
