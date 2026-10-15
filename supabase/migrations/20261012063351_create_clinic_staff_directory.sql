create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) > 0),
  doctor_user_id uuid not null unique references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.clinic_staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  role text not null check (role in ('doctor', 'secretary')),
  login_phone text not null unique check (login_phone ~ '^[+]9639[0-9]{8}$'),
  display_name text not null check (char_length(btrim(display_name)) > 0),
  must_change_password boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index clinic_staff_one_doctor_per_clinic on public.clinic_staff (clinic_id) where role = 'doctor';
create index clinic_staff_clinic_id_idx on public.clinic_staff (clinic_id);

alter table public.clinics enable row level security;
alter table public.clinic_staff enable row level security;

create policy "Doctors can view their clinic" on public.clinics
  for select to authenticated
  using (doctor_user_id = (select auth.uid()));

create policy "Staff can view their own record" on public.clinic_staff
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Doctors can view clinic staff" on public.clinic_staff
  for select to authenticated
  using (
    clinic_id in (
      select id from public.clinics
      where doctor_user_id = (select auth.uid())
    )
  );

revoke all on public.clinics, public.clinic_staff from anon;
revoke all on public.clinics, public.clinic_staff from authenticated;
grant select on public.clinics, public.clinic_staff to authenticated;
