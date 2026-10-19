-- Patient identity and today's queue are clinic-owned. Visits and measurements follow later.
create table public.patients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  full_name text not null check (char_length(btrim(full_name)) between 2 and 160),
  phone text check (phone is null or char_length(btrim(phone)) between 6 and 32),
  created_at timestamptz not null default now(),
  unique (clinic_id, id)
);

create unique index patients_clinic_phone_idx on public.patients (clinic_id, phone) where phone is not null;
create index patients_clinic_name_idx on public.patients (clinic_id, full_name);

create table public.daily_queue (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  patient_id uuid not null,
  queue_date date not null default (now() at time zone 'Asia/Damascus')::date,
  visit_type text not null check (visit_type in ('follow_up', 'full_exam')),
  status text not null default 'waiting' check (status in ('waiting', 'with_doctor')),
  arrived_at timestamptz not null default now(),
  unique (clinic_id, patient_id, queue_date),
  foreign key (clinic_id, patient_id) references public.patients (clinic_id, id) on delete restrict
);

create index daily_queue_clinic_date_order_idx on public.daily_queue (clinic_id, queue_date, arrived_at, id);

alter table public.patients enable row level security;
alter table public.daily_queue enable row level security;
revoke all on public.patients, public.daily_queue from anon, authenticated;
grant select on public.patients, public.daily_queue to authenticated;
grant insert (clinic_id, full_name, phone) on public.patients to authenticated;
grant insert (clinic_id, patient_id, queue_date, visit_type) on public.daily_queue to authenticated;
grant update (status) on public.daily_queue to authenticated;

create policy "Active clinic staff read patients" on public.patients for select to authenticated
  using (exists (
    select 1 from public.clinic_staff staff
    where staff.user_id = (select auth.uid()) and staff.clinic_id = patients.clinic_id
      and staff.active and not staff.must_change_password
  ));
create policy "Active clinic staff create patients" on public.patients for insert to authenticated
  with check (exists (
    select 1 from public.clinic_staff staff
    where staff.user_id = (select auth.uid()) and staff.clinic_id = patients.clinic_id
      and staff.active and not staff.must_change_password
  ));

create policy "Active clinic staff read queue" on public.daily_queue for select to authenticated
  using (exists (
    select 1 from public.clinic_staff staff
    where staff.user_id = (select auth.uid()) and staff.clinic_id = daily_queue.clinic_id
      and staff.active and not staff.must_change_password
  ));
create policy "Active clinic staff add waiting patient" on public.daily_queue for insert to authenticated
  with check (status = 'waiting' and queue_date = (now() at time zone 'Asia/Damascus')::date and exists (
    select 1 from public.clinic_staff staff
    where staff.user_id = (select auth.uid()) and staff.clinic_id = daily_queue.clinic_id
      and staff.active and not staff.must_change_password
  ));
create policy "Active clinic staff hand off patient" on public.daily_queue for update to authenticated
  using (status = 'waiting' and exists (
    select 1 from public.clinic_staff staff
    where staff.user_id = (select auth.uid()) and staff.clinic_id = daily_queue.clinic_id
      and staff.active and not staff.must_change_password
  ))
  with check (status = 'with_doctor' and exists (
    select 1 from public.clinic_staff staff
    where staff.user_id = (select auth.uid()) and staff.clinic_id = daily_queue.clinic_id
      and staff.active and not staff.must_change_password
  ));
