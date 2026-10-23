-- Additive Slice 1. The four verified applied migrations are never rewritten.
-- No production seeds, notes, plans, appointments or completion state.
alter table public.patients
  add column height_cm numeric(5,2) check (height_cm between 50 and 250),
  add column gender text check (gender in ('female', 'male')),
  add column birth_year smallint check (birth_year between 1900 and 2200),
  add column goal text check (goal in ('نقص وزن', 'زيادة وزن'));

alter table public.daily_queue drop constraint daily_queue_status_check;
alter table public.daily_queue
  add constraint daily_queue_status_check check (status in ('waiting', 'ready', 'with_doctor')),
  add column revision integer not null default 0 check (revision >= 0),
  add column handed_off_at timestamptz,
  add column handed_off_by uuid references auth.users(id) on delete restrict,
  add constraint daily_queue_clinic_entry_patient_key unique (clinic_id, id, patient_id);

create table public.visits (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  queue_id uuid not null unique,
  patient_id uuid not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (clinic_id, id),
  foreign key (clinic_id, queue_id, patient_id)
    references public.daily_queue(clinic_id, id, patient_id) on delete restrict
);
create index visits_clinic_patient_idx on public.visits(clinic_id, patient_id, created_at desc);

create table public.visit_measurements (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null,
  visit_id uuid not null unique,
  recorded_by uuid not null references auth.users(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  request_id uuid not null,
  expected_revision integer not null check (expected_revision >= 0),
  request_payload jsonb not null check (jsonb_typeof(request_payload) = 'object'),
  weight_kg numeric(5,2) check (weight_kg > 0 and weight_kg <= 500),
  body_fat_percent numeric(5,2) check (body_fat_percent > 0 and body_fat_percent <= 100),
  muscle_mass_kg numeric(5,2) check (muscle_mass_kg > 0 and muscle_mass_kg <= 300),
  visceral_fat_level numeric(5,2) check (visceral_fat_level > 0 and visceral_fat_level <= 100),
  basal_metabolic_rate_kcal numeric(7,2) check (basal_metabolic_rate_kcal > 0 and basal_metabolic_rate_kcal <= 10000),
  waist_cm numeric(5,2) check (waist_cm > 0 and waist_cm <= 300),
  arm_cm numeric(5,2) check (arm_cm > 0 and arm_cm <= 200),
  thigh_cm numeric(5,2) check (thigh_cm > 0 and thigh_cm <= 200),
  hip_cm numeric(5,2) check (hip_cm > 0 and hip_cm <= 300),
  unique (clinic_id, request_id),
  foreign key (clinic_id, visit_id) references public.visits(clinic_id, id) on delete restrict
);
create index measurements_clinic_visit_idx on public.visit_measurements(clinic_id, visit_id);

alter table public.visits enable row level security;
alter table public.visit_measurements enable row level security;

-- Session-backed membership, not editable JWT metadata. This helper itself uses RLS.
create function public.clinical_role(p_clinic uuid) returns text
language sql stable security invoker set search_path = '' as $$
  select role from public.clinic_staff
  where user_id = (select auth.uid()) and clinic_id = p_clinic
    and active and not must_change_password
$$;

-- Replace only the earlier clinical write policies; keep directory policies intact.
drop policy "Active clinic staff create patients" on public.patients;
drop policy "Active clinic staff add waiting patient" on public.daily_queue;
drop policy "Active clinic staff hand off patient" on public.daily_queue;
create policy "Secretaries create patients" on public.patients for insert to authenticated
  with check (public.clinical_role(clinic_id) = 'secretary');
create policy "Secretaries enqueue today" on public.daily_queue for insert to authenticated
  with check (public.clinical_role(clinic_id) = 'secretary' and status = 'waiting'
    and revision = 0 and queue_date = (now() at time zone 'Asia/Damascus')::date);
create policy "Secretaries update queue" on public.daily_queue for update to authenticated
  using (public.clinical_role(clinic_id) = 'secretary')
  with check (public.clinical_role(clinic_id) = 'secretary');
create policy "Staff read visits" on public.visits for select to authenticated
  using (public.clinical_role(clinic_id) in ('doctor', 'secretary'));
create policy "Secretaries open visits" on public.visits for insert to authenticated
  with check (public.clinical_role(clinic_id) = 'secretary' and created_by = (select auth.uid()));
create policy "Staff read measurements" on public.visit_measurements for select to authenticated
  using (public.clinical_role(clinic_id) in ('doctor', 'secretary'));
create policy "Secretaries record measurements" on public.visit_measurements for insert to authenticated
  with check (public.clinical_role(clinic_id) = 'secretary' and recorded_by = (select auth.uid()));
create policy "Secretaries update measurements" on public.visit_measurements for update to authenticated
  using (public.clinical_role(clinic_id) = 'secretary')
  with check (public.clinical_role(clinic_id) = 'secretary' and recorded_by = (select auth.uid()));

revoke all on public.visits, public.visit_measurements from anon, authenticated;
grant select on public.visits, public.visit_measurements to authenticated;
grant insert (id, clinic_id, full_name, phone, height_cm, gender, birth_year, goal) on public.patients to authenticated;
grant insert (clinic_id, queue_id, patient_id, created_by) on public.visits to authenticated;
grant update (status, revision, handed_off_at, handed_off_by) on public.daily_queue to authenticated;
grant insert (clinic_id, visit_id, recorded_by, request_id, request_payload, expected_revision,
  weight_kg, body_fat_percent, muscle_mass_kg, visceral_fat_level, basal_metabolic_rate_kcal,
  waist_cm, arm_cm, thigh_cm, hip_cm) on public.visit_measurements to authenticated;
grant update (recorded_by, request_id, request_payload, expected_revision,
  weight_kg, body_fat_percent, muscle_mass_kg, visceral_fat_level, basal_metabolic_rate_kcal,
  waist_cm, arm_cm, thigh_cm, hip_cm) on public.visit_measurements to authenticated;
-- Explicit provisioning/test/admin grants, independent of evolving Supabase defaults.
grant all on public.patients, public.daily_queue, public.visits, public.visit_measurements to service_role;

-- Enforced even for direct Data API writes, not only the preferred RPC interface.
create function public.clinical_queue_guard() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare complete boolean;
begin
  if old.status = 'with_doctor' or old.queue_date <> (now() at time zone 'Asia/Damascus')::date then
    raise exception 'Queue entry is no longer editable' using errcode = '22023';
  end if;
  if new.revision <> old.revision + 1 then
    raise exception 'Revision conflict' using errcode = '40001';
  end if;
  select (m.weight_kg is not null and (old.visit_type = 'follow_up' or
    (m.body_fat_percent is not null and m.muscle_mass_kg is not null
     and m.visceral_fat_level is not null and m.basal_metabolic_rate_kcal is not null
     and m.waist_cm is not null and m.arm_cm is not null and m.thigh_cm is not null and m.hip_cm is not null)))
  into complete from public.visits v join public.visit_measurements m on m.visit_id = v.id
  where v.queue_id = old.id and v.clinic_id = old.clinic_id;
  if new.status in ('ready', 'with_doctor') and not coalesce(complete, false) then
    raise exception 'Complete measurements are required' using errcode = '23514';
  end if;
  if new.status = 'with_doctor' then
    if old.status <> 'ready' then raise exception 'Patient is not ready' using errcode = '22023'; end if;
    new.handed_off_at := now();
    new.handed_off_by := auth.uid();
  else
    new.handed_off_at := null;
    new.handed_off_by := null;
  end if;
  return new;
end $$;
create trigger clinical_queue_guard before update on public.daily_queue
for each row execute function public.clinical_queue_guard();

create function public.clinical_measurement_guard() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare q public.daily_queue;
begin
  select d.* into q from public.daily_queue d join public.visits v on v.queue_id = d.id
    where v.id = new.visit_id and v.clinic_id = new.clinic_id for update of d;
  if not found or q.status = 'with_doctor' or q.queue_date <> (now() at time zone 'Asia/Damascus')::date then
    raise exception 'Measurements are not editable' using errcode = '22023';
  end if;
  if new.expected_revision is null or new.expected_revision <> q.revision then
    raise exception 'Revision conflict' using errcode = '40001';
  end if;
  if tg_op = 'UPDATE' and new.request_id = old.request_id then
    raise exception 'Use a fresh request identifier for an edit' using errcode = '40001';
  end if;
  new.recorded_at := now();
  return new;
end $$;
create trigger clinical_measurement_guard before insert or update on public.visit_measurements
for each row execute function public.clinical_measurement_guard();

create function public.clinical_measurement_saved() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  update public.daily_queue q set revision = revision + 1,
    status = case when new.weight_kg is not null and (q.visit_type = 'follow_up' or
      (new.body_fat_percent is not null and new.muscle_mass_kg is not null
       and new.visceral_fat_level is not null and new.basal_metabolic_rate_kcal is not null
       and new.waist_cm is not null and new.arm_cm is not null and new.thigh_cm is not null and new.hip_cm is not null))
      then 'ready' else 'waiting' end
    from public.visits v where v.id = new.visit_id and q.id = v.queue_id;
  return new;
end $$;
create trigger clinical_measurement_saved after insert or update on public.visit_measurements
for each row execute function public.clinical_measurement_saved();

create function public.clinical_create_patient(p_id uuid, p_name text, p_phone text,
  p_height text, p_gender text, p_birth_year text, p_goal text) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare c uuid; existing public.patients;
begin
  select clinic_id into c from public.clinic_staff where user_id = (select auth.uid())
    and role = 'secretary' and active and not must_change_password;
  if c is null then raise exception 'Not authorized' using errcode = '42501'; end if;
  if p_id is null or p_name is null or char_length(btrim(p_name)) not between 2 and 160
    or p_phone is null or p_phone !~ '^\+?[0-9]{6,15}$'
    or p_height is null or p_height !~ '^[0-9]+([.][0-9]{1,2})?$'
    or p_gender is null or p_gender not in ('female','male')
    or p_goal is null or p_goal not in ('نقص وزن','زيادة وزن')
    or p_birth_year is null or (p_birth_year <> '' and (p_birth_year !~ '^[0-9]{4}$'
      or p_birth_year::integer not between 1900 and extract(year from now())::integer)) then
    raise exception 'Invalid patient' using errcode = '22023';
  end if;
  insert into public.patients (id, clinic_id, full_name, phone, height_cm, gender, birth_year, goal)
    values (p_id, c, btrim(p_name), p_phone, p_height::numeric, p_gender, nullif(p_birth_year,'')::smallint, p_goal)
    on conflict (id) do nothing;
  select * into existing from public.patients where id = p_id;
  if existing.id is null or existing.clinic_id <> c or existing.full_name <> btrim(p_name)
    or existing.phone is distinct from p_phone or existing.height_cm is distinct from p_height::numeric
    or existing.gender is distinct from p_gender or existing.birth_year is distinct from nullif(p_birth_year,'')::smallint
    or existing.goal is distinct from p_goal then
    raise exception 'Patient retry does not match' using errcode = '40001';
  end if;
  return p_id;
end $$;

create function public.clinical_enqueue(p_patient uuid, p_kind text) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare c uuid; q public.daily_queue;
begin
  select clinic_id into c from public.clinic_staff where user_id = (select auth.uid())
    and role = 'secretary' and active and not must_change_password;
  if c is null then raise exception 'Not authorized' using errcode = '42501'; end if;
  if p_kind is null or p_kind not in ('full_exam','follow_up') then
    raise exception 'Invalid visit type' using errcode = '22023';
  end if;
  if p_kind = 'follow_up' and not exists (select 1 from public.visits where patient_id = p_patient and clinic_id = c) then
    raise exception 'First visit must be a full exam' using errcode = '23514';
  end if;
  insert into public.daily_queue (clinic_id, patient_id, visit_type)
    values (c, p_patient, p_kind) on conflict (clinic_id, patient_id, queue_date) do nothing;
  select * into q from public.daily_queue where clinic_id = c and patient_id = p_patient
    and queue_date = (now() at time zone 'Asia/Damascus')::date for update;
  if q.id is null then raise exception 'Patient unavailable' using errcode = '42501'; end if;
  if q.visit_type <> p_kind then raise exception 'Check-in type conflict' using errcode = '40001'; end if;
  insert into public.visits (clinic_id, queue_id, patient_id, created_by)
    values (c, q.id, p_patient, auth.uid()) on conflict (queue_id) do nothing;
  return q.id;
end $$;

create function public.clinical_save_measurements(p_entry uuid, p_revision integer,
  p_request uuid, p_values jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare q public.daily_queue; v uuid; m public.visit_measurements; item record;
begin
  select * into q from public.daily_queue where id = p_entry for update;
  if q.id is null or public.clinical_role(q.clinic_id) is distinct from 'secretary' then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  select id into v from public.visits where queue_id = q.id and clinic_id = q.clinic_id;
  if v is null then raise exception 'Enqueue patient first' using errcode = '22023'; end if;
  select * into m from public.visit_measurements where visit_id = v;
  if p_request is null or p_values is null or jsonb_typeof(p_values) <> 'object' then
    raise exception 'Invalid measurements' using errcode = '22023';
  end if;
  if m.request_id = p_request then
    if m.request_payload is distinct from p_values then raise exception 'Retry payload changed' using errcode = '40001'; end if;
    return q.id;
  end if;
  if p_revision is null or q.revision <> p_revision then raise exception 'Revision conflict' using errcode = '40001'; end if;
  if q.status = 'with_doctor' then raise exception 'Already handed off' using errcode = '22023'; end if;
  for item in select * from jsonb_each_text(p_values) loop
    if item.key not in ('weight','fat','muscle','visceral','bmr','waist','arm','thigh','hip')
      or item.value is null or item.value !~ '^[0-9]+([.][0-9]{1,2})?$' then
      raise exception 'Invalid measurement value' using errcode = '22023';
    end if;
  end loop;
  if not (p_values ? 'weight') or (q.visit_type = 'full_exam' and not
    (p_values ?& array['weight','fat','muscle','visceral','bmr','waist','arm','thigh','hip'])) then
    raise exception 'Incomplete measurements' using errcode = '23514';
  end if;
  insert into public.visit_measurements (clinic_id, visit_id, recorded_by, request_id, request_payload, expected_revision,
    weight_kg, body_fat_percent, muscle_mass_kg, visceral_fat_level, basal_metabolic_rate_kcal, waist_cm, arm_cm, thigh_cm, hip_cm)
    values (q.clinic_id, v, auth.uid(), p_request, p_values, p_revision,
      (p_values->>'weight')::numeric, (p_values->>'fat')::numeric, (p_values->>'muscle')::numeric,
      (p_values->>'visceral')::numeric, (p_values->>'bmr')::numeric, (p_values->>'waist')::numeric,
      (p_values->>'arm')::numeric, (p_values->>'thigh')::numeric, (p_values->>'hip')::numeric)
    on conflict (visit_id) do update set recorded_by = excluded.recorded_by,
      request_id = excluded.request_id, request_payload = excluded.request_payload, expected_revision = excluded.expected_revision,
      weight_kg = excluded.weight_kg, body_fat_percent = excluded.body_fat_percent,
      muscle_mass_kg = excluded.muscle_mass_kg, visceral_fat_level = excluded.visceral_fat_level,
      basal_metabolic_rate_kcal = excluded.basal_metabolic_rate_kcal, waist_cm = excluded.waist_cm,
      arm_cm = excluded.arm_cm, thigh_cm = excluded.thigh_cm, hip_cm = excluded.hip_cm;
  return q.id;
end $$;

create function public.clinical_handoff(p_entry uuid, p_revision integer) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare q public.daily_queue;
begin
  select * into q from public.daily_queue where id = p_entry for update;
  if q.id is null or public.clinical_role(q.clinic_id) is distinct from 'secretary' then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if q.status = 'with_doctor' then return q.id; end if;
  if p_revision is null or q.revision <> p_revision then raise exception 'Revision conflict' using errcode = '40001'; end if;
  if q.status <> 'ready' then raise exception 'Patient is not ready' using errcode = '22023'; end if;
  update public.daily_queue set status = 'with_doctor', revision = revision + 1 where id = q.id;
  return q.id;
end $$;

create function public.clinical_snapshot() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'patients', coalesce((select jsonb_agg(p order by p.full_name, p.id) from
      (select id, full_name, phone, height_cm, gender, birth_year, goal from public.patients) p), '[]'::jsonb),
    'entries', coalesce((select jsonb_agg(e order by e.arrived_at, e.id) from
      (select q.id, q.patient_id, v.id as visit_id, q.visit_type, q.status, q.queue_date, q.revision, q.arrived_at,
        case when m.id is null then null else jsonb_build_object('weight_kg',m.weight_kg,
          'body_fat_percent',m.body_fat_percent,'muscle_mass_kg',m.muscle_mass_kg,
          'visceral_fat_level',m.visceral_fat_level,'basal_metabolic_rate_kcal',m.basal_metabolic_rate_kcal,
          'waist_cm',m.waist_cm,'arm_cm',m.arm_cm,'thigh_cm',m.thigh_cm,'hip_cm',m.hip_cm) end as measurements
       from public.daily_queue q left join public.visits v on v.queue_id = q.id and v.clinic_id = q.clinic_id
       left join public.visit_measurements m on m.visit_id = v.id and m.clinic_id = q.clinic_id
       where q.queue_date = (now() at time zone 'Asia/Damascus')::date) e), '[]'::jsonb))
$$;

-- No implicit PUBLIC/anon function execution. Trigger helpers are not RPCs.
revoke all on function public.clinical_role(uuid), public.clinical_queue_guard(),
  public.clinical_measurement_guard(), public.clinical_measurement_saved(),
  public.clinical_create_patient(uuid,text,text,text,text,text,text), public.clinical_enqueue(uuid,text),
  public.clinical_save_measurements(uuid,integer,uuid,jsonb), public.clinical_handoff(uuid,integer),
  public.clinical_snapshot() from public, anon, authenticated;
grant execute on function public.clinical_role(uuid),
  public.clinical_create_patient(uuid,text,text,text,text,text,text), public.clinical_enqueue(uuid,text),
  public.clinical_save_measurements(uuid,integer,uuid,jsonb), public.clinical_handoff(uuid,integer),
  public.clinical_snapshot() to authenticated;
notify pgrst, 'reload schema';
