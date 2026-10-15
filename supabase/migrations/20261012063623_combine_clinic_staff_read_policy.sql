drop policy "Staff can view their own record" on public.clinic_staff;
drop policy "Doctors can view clinic staff" on public.clinic_staff;
create policy "Clinic staff can be viewed by self or doctor" on public.clinic_staff
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or clinic_id in (
      select id from public.clinics
      where doctor_user_id = (select auth.uid())
    )
  );
