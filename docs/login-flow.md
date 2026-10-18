# Clinic Login Flow — decisions and implementation status

This is the **product-owner decision record** from the interview after the [Figma analysis](product-overview.md); it is not presented as a Figma token specification. The two relevant visual frames are [secretary `118:3`](https://www.figma.com/design/dZPtsNiHOfyhqRgHb6H0yx/clinc?node-id=118-3) and [doctor `181:3622`](https://www.figma.com/design/dZPtsNiHOfyhqRgHb6H0yx/clinc?node-id=181-3622).

## Agreed behavior

- First release has doctor and secretary accounts. A clinic has one doctor and initially one secretary; a second secretary may be supported later. Patient login is a separate later flow.
- The system administrator provisions the doctor account; the doctor provisions secretary access. Each person signs in with their own unique email address and password. Call/WhatsApp contact numbers, including those used to share a food program, are separate from the login identifier.
- Both roles use one sign-in entry point and are routed according to the server-controlled account role: doctor to `/doctor`, secretary to `/secretary`. No role selector is required.
- An initially assigned or reset password is temporary. The account owner must set a new password (at least 8 characters, entered twice) before continuing. A secretary may change their own password only at this required step. A signed-in doctor may change their own password normally, and that new password takes effect immediately.
- A signed-out secretary with a forgotten password contacts the doctor; a signed-out doctor contacts the system administrator. No self-service SMS recovery is in the first release. The `V1-01` code screen is **not** the clinic's first-release forgotten-password path.
- Incorrect credentials receive the same general message whether the email is unknown or the password is wrong. Connection/service errors are distinct and retryable. The submit button shows a pending state and prevents duplicate submissions. Entered values remain available on retry. The session normally persists until logout or expiry.
- The doctor can perform essential secretary work (add a patient to the queue and record measurements) using the doctor account. Those workflow pages are outside this Login Flow implementation.

## Implemented in the app

- Arabic RTL login form styled against the scoped Figma frame, with its placed mark and Noto Sans Arabic; accepts an email address and sends its lowercase trimmed form to Supabase Auth.
- Server-side email/password authentication with Supabase SSR cookies, staff role, matching Auth email and activation checks from the administrator-managed `clinic_staff` table, role-specific guarded destinations, and a first-login change-password screen. Doctor-only signed-in password change, sign-out and distinct form/service errors are included.
- The `/doctor` and `/secretary` routes are **minimal authenticated destinations**, not the doctor dashboard or secretary queue UI from Figma.
- `/doctor/staff` is a read-only staff directory for the doctor's clinic. The `active` column can disable an account at the app's authorization boundary, including an otherwise valid Auth session.

## Setup required for a real sign-in

1. Ensure **email authentication** is enabled for the chosen Supabase project in [Auth Providers](https://supabase.com/dashboard/project/aisrzeazbnycpdtuadnh/auth/providers). An Auth user needs a confirmed email before password sign-in when email confirmation is required by the project.
2. Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. These are public connection details. Local development currently has them in an ignored `.env.local`; use `.env.example` for other environments.
3. Supply `SUPABASE_SECRET_KEY` as a **server-only** environment value. It is required to clear `clinic_staff.must_change_password` after the user successfully changes a temporary password. Never expose it in a browser or `NEXT_PUBLIC_` variable. Without it, temporary-password accounts cannot complete activation.
4. Provision clinic accounts through an authorized administrator workflow (not a public sign-up form). Create a Supabase Auth user for each person, then the corresponding `clinics` and `clinic_staff` records described in [database.md](database.md). Roles and active/temporary-password flags now live in the staff table, **not** editable user metadata. No clinic or staff rows have been provisioned yet; any existing Auth users are not automatically assigned a role.
5. Share temporary credentials with the person outside the app, as agreed. The doctor-facing secretary-creation and password-reset controls remain future work. Until the doctor reset control exists, an authorized administrator handles a secretary reset on the doctor's request: assign a new temporary password through Supabase Auth, set that staff member's `must_change_password` flag to `true`, and deliver the temporary password outside the app. The doctor continues to contact the administrator for their own reset. Do not use the public login page as a recovery flow.

Exact Arabic copy and session lifetime can be refined later. The doctor Figma Login frame still displays signed-out “change password” copy; the implemented entry point instead tells the doctor to contact the system administrator, matching the agreed recovery policy.
