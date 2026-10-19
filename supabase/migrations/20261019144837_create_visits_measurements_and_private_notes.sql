-- One encounter per queue entry; existing patients and queue rows are untouched.
-- The composite keys enforce clinic and patient identity, not name matching.
create unique index daily_queue_clinic_id_patient_idx
  on public.daily_queue (clinic_id, id, patient_id);

create table public.visits (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  queue_id uuid not null unique,
  patient_id uuid not null,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (clinic_id, id),
  foreign key (clinic_id, queue_id, patient_id)
    references public.daily_queue (clinic_id, id, patient_id) on delete restrict
);

create index visits_clinic_patient_date_idx
  on public.visits (clinic_id, patient_id, created_at desc);

-- A single editable set of intake measurements per encounter prevents repeated submits.
create table public.visit_measurements (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null,
  visit_id uuid not null unique,
  recorded_by uuid not null references auth.users (id) on delete restrict,
  weight_kg numeric(5,2) check (weight_kg > 0 and weight_kg <= 500),
  height_cm numeric(5,2) check (height_cm > 0 and height_cm <= 300),
  systolic_mmhg smallint check (systolic_mmhg between 40 and 300),
  diastolic_mmhg smallint check (diastolic_mmhg between 20 and 200),
  pulse_bpm smallint check (pulse_bpm between 20 and 250),
  temperature_c numeric(4,1) check (temperature_c between 30 and 45),
  recorded_at timestamptz not null default now(),
  foreign key (clinic_id, visit_id) references public.visits (clinic_id, id) on delete restrict,
  check (weight_kg is not null or height_cm is not null or systolic_mmhg is not null
    or diastolic_mmhg is not null or pulse_bpm is not null or temperature_c is not null)
);

-- Notes are separate from shared intake data: never expose them to secretaries.
create table public.visit_private_notes (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null,
  visit_id uuid not null unique,
  author_id uuid not null references auth.users (id) on delete restrict,
  body text not null check (char_length(btrim(body)) between 1 and 20000),
  created_at timestamptz not null default now(),
  foreign key (clinic_id, visit_id) references public.visits (clinic_id, id) on delete restrict
);

alter table public.visits enable row level security;
alter table public.visit_measurements enable row level security;
alter table public.visit_private_notes enable row level security;
revoke all on public.visits, public.visit_measurements, public.visit_private_notes from anon, authenticated;
grant select on public.visits, public.visit_measurements to authenticated;
grant insert (clinic_id, queue_id, patient_id, created_by) on public.visits to authenticated;
grant insert (clinic_id, visit_id, recorded_by, weight_kg, height_cm,
  systolic_mmhg, diastolic_mmhg, pulse_bpm, temperature_c)
  on public.visit_measurements to authenticated;
grant update (weight_kg, height_cm, systolic_mmhg, diastolic_mmhg, pulse_bpm, temperature_c)
  on public.visit_measurements to authenticated;
grant select on public.visit_private_notes to authenticated;
grant insert (clinic_id, visit_id, author_id, body) on public.visit_private_notes to authenticated;
grant update (body) on public.visit_private_notes to authenticated;

create policy "Clinic staff read visits" on public.visits for select to authenticated
  using (exists (
    select 1 from public.clinic_staff s
    where s.user_id = (select auth.uid()) and s.clinic_id = visits.clinic_id
      and s.active and not s.must_change_password
  ));
create policy "Clinic staff open visits" on public.visits for insert to authenticated
  with check (created_by = (select auth.uid()) and exists (
    select 1 from public.clinic_staff s
    where s.user_id = (select auth.uid()) and s.clinic_id = visits.clinic_id
      and s.active and not s.must_change_password
  ));

create policy "Clinic staff read measurements" on public.visit_measurements for select to authenticated
  using (exists (
    select 1 from public.clinic_staff s
    where s.user_id = (select auth.uid()) and s.clinic_id = visit_measurements.clinic_id
      and s.active and not s.must_change_password
  ));
create policy "Clinic staff record measurements" on public.visit_measurements for insert to authenticated
  with check (recorded_by = (select auth.uid()) and exists (
    select 1 from public.clinic_staff s
    where s.user_id = (select auth.uid()) and s.clinic_id = visit_measurements.clinic_id
      and s.active and not s.must_change_password
  ));
create policy "Clinic staff correct measurements" on public.visit_measurements for update to authenticated
  using (exists (
    select 1 from public.clinic_staff s
    where s.user_id = (select auth.uid()) and s.clinic_id = visit_measurements.clinic_id
      and s.active and not s.must_change_password
  ))
  with check (exists (
    select 1 from public.clinic_staff s
    where s.user_id = (select auth.uid()) and s.clinic_id = visit_measurements.clinic_id
      and s.active and not s.must_change_password
  ));

create policy "Clinic doctor reads private notes" on public.visit_private_notes for select to authenticated
  using (exists (
    select 1 from public.clinic_staff s
    where s.user_id = (select auth.uid()) and s.clinic_id = visit_private_notes.clinic_id
      and s.role = 'doctor' and s.active and not s.must_change_password
  ));
create policy "Clinic doctor writes private notes" on public.visit_private_notes for insert to authenticated
  with check (author_id = (select auth.uid()) and exists (
    select 1 from public.clinic_staff s
    where s.user_id = (select auth.uid()) and s.clinic_id = visit_private_notes.clinic_id
      and s.role = 'doctor' and s.active and not s.must_change_password
  ));
create policy "Clinic doctor edits private notes" on public.visit_private_notes for update to authenticated
  using (exists (
    select 1 from public.clinic_staff s
    where s.user_id = (select auth.uid()) and s.clinic_id = visit_private_notes.clinic_id
      and s.role = 'doctor' and s.active and not s.must_change_password
  ))
  with check (exists (
    select 1 from public.clinic_staff s
    where s.user_id = (select auth.uid()) and s.clinic_id = visit_private_notes.clinic_id
      and s.role = 'doctor' and s.active and not s.must_change_password
  ));
