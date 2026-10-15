# Clinic staff database

The connected Supabase project contains two public tables created by migrations `20261012063351_create_clinic_staff_directory` and `20261012063623_combine_clinic_staff_read_policy`, with the staff login field changed by `20261015053810_switch_staff_login_to_email`. Their checked-in SQL is under [`supabase/migrations/`](../supabase/migrations/). This describes the **clinic login directory**, not patient medical records. The migrations did not insert any clinic, staff or patient data.

## What lives where

- **Supabase Auth (`auth.users`)** owns each person's email login identity and password hash. It handles authentication and sessions. The app has no public sign-up endpoint.
- **`public.clinics`** owns a clinic name and the Auth user ID of its sole doctor. A doctor can read their clinic row.
- **`public.clinic_staff`** links an Auth user to a clinic. It holds `role` (`doctor` or `secretary`), `login_email`, `display_name`, `active`, `must_change_password`, and creation time. Its Auth user ID is the primary key. `login_email` is unique, stored in lowercase and must match that user's Auth email. The app checks both the Auth user and staff record on sign-in and protected page loads. A doctor can read all staff in their clinic; a secretary can read only their own staff row.

`login_email` is a duplicated **directory display and integrity field**, not a second credential store. When an administrator changes an Auth email, update the directory email as part of the same account-change procedure; until they match, app sign-in is denied. Later call/WhatsApp contact numbers are separate data and are **not** modeled here.

## Access control

Both tables have RLS enabled. Anonymous clients cannot select them. Signed-in users have read-only Data API grants: staff can read themselves, doctors can additionally view staff belonging to the doctor-owned clinic, and doctors can read their clinic row. There are **no client insert/update/delete grants or policies** for either table. Supabase administrators can provision staff and change role/active/reset flags using privileged server-side tools; the app's server-only secret is used only for clearing a temporary-password flag after a successful password change. User-editable metadata is never an authorization source.

The unique index on `clinics.doctor_user_id` and the partial unique index on `clinic_staff.clinic_id` for `role = 'doctor'` prevent multiple doctors being assigned to one clinic or one doctor owning multiple clinics. Multiple secretaries per clinic remain possible for a later release.

## Provisioning sequence (operator action)

1. Ensure email/password sign-in is enabled in [Supabase Auth Providers](https://supabase.com/dashboard/project/aisrzeazbnycpdtuadnh/auth/providers). Create a doctor Auth user through an administrator workflow, using an email and temporary password. Confirm the email during administrator provisioning (or have the recipient confirm it before their first login).
2. Create a clinic row referencing that Auth user as `doctor_user_id`.
3. Create the doctor's `clinic_staff` row with the **same** Auth user ID, clinic ID, lowercase email, `role = 'doctor'`, and `must_change_password = true`.
4. Create a secretary Auth user and a `clinic_staff` row in that clinic with the matching lowercase email, `role = 'secretary'` and `must_change_password = true`.
5. Deliver each temporary password outside the app. When the person signs in and sets a new password, the app clears their `must_change_password` flag through its server-only secret key.

To disable a staff member, set `active = false` through an authorized administrative workflow; the app then denies access to its protected routes. If immediate invalidation of already-issued Supabase Auth tokens is needed for other services, separately revoke that user's sessions through Supabase Auth. The doctor-facing account provisioning and reset interface is **not yet implemented**.

## Remaining scope

Patient files, appointments, visits, attachments and medical measurements have **no tables yet**. Define their ownership and RLS separately before adding them. At the email-login migration check, `clinics` and `clinic_staff` both had zero rows; an Auth user existed independently without a linked staff record. Do not assume its role. No end-to-end login with a linked clinic account has been verified yet.
