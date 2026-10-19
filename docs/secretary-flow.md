# Secretary intake — first working slice

The secretary home at `/secretary` follows the [S1 Figma queue frame](https://www.figma.com/design/dZPtsNiHOfyhqRgHb6H0yx/clinc?node-id=142-607). It shows today's waiting and with-doctor entries. Search (`/secretary/search`) finds existing patients by name or phone; the new-file form creates a patient and adds them to the queue. A waiting patient can be sent to the doctor **without measurements**, as confirmed by the product owner. Doctors may use these same protected reception routes with their own account.

## Before testing with a real account

1. Apply `supabase/migrations/20261019114924_create_patients_and_daily_queue.sql` to the intended Supabase project using the project's migration process. The app does not apply schema changes at runtime. Ensure the two new public tables are enabled for the Data API; `GRANT` and RLS are defined in the migration.
2. Provision a clinic and staff-linked doctor/secretary Auth account as described in [database.md](database.md). Password-change gating remains in place. No patient fixture is inserted into production.
3. Sign in as secretary and confirm the empty queue, create a patient, verify that patient appears once in the daily queue, try adding them again (duplicate rejected), then send them to the doctor. Check that a second clinic cannot see or write the first clinic's patients or queue. Repeat the queue path with a doctor account.

The date of the queue and shown arrival times currently use `Asia/Damascus`. Make the clinic time zone configurable before onboarding clinics elsewhere. Phone is optional; identical non-empty phone numbers within a clinic are rejected. Creating a patient and adding to the queue are separate database operations: if the second operation fails, search for the newly created patient and add them without recreating their file. Search returns at most 100 matching names plus 100 matching phones; the patient directory shows the 100 newest files and points users to full search for older files.

## Next slices

Follow-up and full-exam measurement forms (`S5`, `S5b`, `S6`), visit completion/counts, full patient file (`S8`), and expanded account management (`S9`) are not included yet. The account destination currently offers sign-out, and the patient directory is read-only. V2 appointments and notifications are separate future work.
