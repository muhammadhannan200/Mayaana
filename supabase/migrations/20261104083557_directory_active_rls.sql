-- Forward-only directory authorization fix. No table grants or data change.
-- A direct staff lookup inside either policy would recurse through
-- clinic_staff -> clinics -> clinic_staff. This private, caller-only helper
-- reads as postgres to break that cycle; it cannot inspect another identity.
create function clinical_private.directory_doctor_clinic() returns uuid
language sql stable security definer set search_path = '' as $$
  select c.id
  from public.clinic_staff s
  join public.clinics c on c.id = s.clinic_id
  where s.user_id = (select auth.uid())
    and c.doctor_user_id = s.user_id
    and s.role = 'doctor' and s.active and not s.must_change_password
$$;
alter function clinical_private.directory_doctor_clinic() owner to postgres;
revoke all on function clinical_private.directory_doctor_clinic() from public, anon, authenticated;
grant execute on function clinical_private.directory_doctor_clinic() to authenticated;

alter policy "Doctors can view their clinic" on public.clinics
  using (id = (select clinical_private.directory_doctor_clinic()));

alter policy "Clinic staff can be viewed by self or doctor" on public.clinic_staff
  using (
    -- Login must still read active/login_email/must_change_password to reject
    -- inactive users cleanly and allow active first-use password activation.
    user_id = (select auth.uid())
    or clinic_id = (select clinical_private.directory_doctor_clinic())
  );
