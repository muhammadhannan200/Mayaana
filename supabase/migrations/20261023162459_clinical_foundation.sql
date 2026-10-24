-- Additive clinical foundation. Apply only through a reviewed deployment.
-- Existing historical migrations remain untouched.

-- A narrow NOLOGIN/NOBYPASSRLS function owner prevents direct table writes while
-- retaining RLS inside RPCs. Authenticated users are NEVER members of this role.
do $$ begin
  if not exists(select 1 from pg_roles where rolname='mayaana_clinical_api') then
    create role mayaana_clinical_api nologin nosuperuser nocreatedb nocreaterole inherit nobypassrls;
  elsif exists(select 1 from pg_roles where rolname='mayaana_clinical_api' and (rolcanlogin or rolsuper or rolcreatedb or rolcreaterole or not rolinherit or rolbypassrls)) then
    raise exception 'Unsafe existing clinical API role';
  end if;
end $$;
grant mayaana_clinical_api to postgres;
-- Supabase owns auth schema grants. Inherit its existing authenticated identity
-- helper privileges rather than attempting to re-grant protected auth objects.
-- Membership is ONE WAY: authenticated can never assume this API role.
grant authenticated to mayaana_clinical_api;
create schema clinical_private;
revoke all on schema clinical_private from public;
grant usage on schema clinical_private to authenticated, mayaana_clinical_api;
grant usage on schema public to mayaana_clinical_api;
grant select on public.clinic_staff to mayaana_clinical_api;

create function clinical_private.staff_role(p_clinic uuid) returns text
language sql stable security invoker set search_path = '' as $$
  select s.role from public.clinic_staff s
  where s.user_id = (select auth.uid()) and s.clinic_id = p_clinic
    and s.active and not s.must_change_password
$$;
revoke all on function clinical_private.staff_role(uuid) from public;
grant execute on function clinical_private.staff_role(uuid) to authenticated, mayaana_clinical_api;

-- Phone is a contact, not identity; shared family numbers are legitimate.
drop index public.patients_clinic_phone_idx;
create index patients_clinic_phone_search_idx on public.patients(clinic_id, phone);
alter table public.patients
  add column height_cm numeric check (height_cm between 50 and 250),
  add column gender text check (gender in ('female', 'male')),
  add column birth_year integer check (birth_year between 1900 and 2200),
  add column goal text check (goal in ('نقص وزن', 'زيادة وزن', 'تثبيت وزن')),
  add column revision integer not null default 0 check (revision >= 0),
  add column updated_at timestamptz not null default now(),
  add column created_by uuid references auth.users(id),
  add column updated_by uuid references auth.users(id);

alter table public.daily_queue drop constraint daily_queue_status_check;
alter table public.daily_queue
  add constraint daily_queue_status_check check (status in ('waiting', 'ready', 'with_doctor', 'completed')),
  add column revision integer not null default 0 check (revision >= 0),
  add column updated_at timestamptz not null default now(),
  add column created_by uuid references auth.users(id),
  add column updated_by uuid references auth.users(id),
  add column handoff_request uuid,
  add column finish_request uuid,
  add unique (clinic_id, patient_id, id);

create table public.visits (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  patient_id uuid not null,
  queue_entry_id uuid not null unique,
  started_at timestamptz,
  completed_at timestamptz,
  revision integer not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  unique (clinic_id, patient_id, id),
  unique (clinic_id, id),
  foreign key (clinic_id, patient_id, queue_entry_id) references public.daily_queue(clinic_id, patient_id, id),
  check (completed_at is null or (started_at is not null and completed_at >= started_at))
);
create index visits_patient_history_idx on public.visits(clinic_id, patient_id, created_at desc);

create function clinical_private.valid_measurements(p_values jsonb, p_full boolean) returns boolean
language plpgsql immutable security invoker set search_path = '' as $$
declare k text; v jsonb; n numeric; max_value numeric;
begin
  if p_values is null or jsonb_typeof(p_values) <> 'object' then return false; end if;
  for k, v in select * from jsonb_each(p_values) loop
    max_value := case k when 'weight' then 500 when 'fat' then 100 when 'muscle' then 300
      when 'visceral' then 100 when 'bmr' then 10000 when 'waist' then 300
      when 'arm' then 200 when 'thigh' then 200 when 'hip' then 300 else null end;
    if max_value is null or jsonb_typeof(v) <> 'number' then return false; end if;
    n := v::text::numeric;
    if n <= 0 or n > max_value then return false; end if;
  end loop;
  if not p_values ? 'weight' then return false; end if;
  if p_full and not p_values ?& array['fat','muscle','visceral','bmr','waist','arm','thigh','hip'] then return false; end if;
  return true;
end $$;

create table public.visit_measurements (
  visit_id uuid primary key,
  clinic_id uuid not null,
  measurements jsonb not null check (clinical_private.valid_measurements(measurements, false)),
  revision integer not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  recorded_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  foreign key (clinic_id, visit_id) references public.visits(clinic_id, id)
);

create table public.visit_private_notes (
  visit_id uuid primary key,
  clinic_id uuid not null,
  notes text not null default '' check (char_length(notes) <= 20000),
  revision integer not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  foreign key (clinic_id, visit_id) references public.visits(clinic_id, id)
);

-- A bounded JSON document matches the existing editor's stable day/meal UUIDs.
-- It is NOT a generic clinic-state replacement; it contains only a single diet.
create function clinical_private.valid_diet(p_days jsonb, p_complete boolean) returns boolean
language plpgsql immutable security invoker set search_path = '' as $$
declare d jsonb; m jsonb; ids uuid[] := array[]::uuid[]; item_id uuid;
begin
  if p_days is null or jsonb_typeof(p_days) <> 'array' then return false; end if;
  if jsonb_array_length(p_days) > 60 or (p_complete and jsonb_array_length(p_days) = 0) then return false; end if;
  for d in select * from jsonb_array_elements(p_days) loop
    if jsonb_typeof(d) <> 'object' or not d ?& array['id','meals'] or (d - 'id' - 'meals') <> '{}'::jsonb then return false; end if;
    item_id := (d->>'id')::uuid;
    if item_id is null or item_id = any(ids) then return false; end if;
    ids := array_append(ids,item_id);
    if jsonb_typeof(d->'meals') <> 'array' then return false; end if;
    if jsonb_array_length(d->'meals') > 12 or (p_complete and jsonb_array_length(d->'meals') = 0) then return false; end if;
    for m in select * from jsonb_array_elements(d->'meals') loop
      if jsonb_typeof(m) <> 'object' or not m ?& array['id','type','description'] or (m - 'id' - 'type' - 'description') <> '{}'::jsonb then return false; end if;
      item_id := (m->>'id')::uuid;
      if item_id is null or item_id = any(ids) then return false; end if;
      ids := array_append(ids,item_id);
      if jsonb_typeof(m->'type') <> 'string' or m->>'type' not in ('فطور','سناك','غداء','عشاء','أخرى')
        or jsonb_typeof(m->'description') <> 'string' or char_length(btrim(m->>'description')) not between 1 and 2000 then return false; end if;
    end loop;
  end loop;
  return true;
exception when invalid_text_representation then return false;
end $$;

create table public.diet_plans (
  visit_id uuid primary key,
  clinic_id uuid not null,
  days jsonb not null default '[]' check (clinical_private.valid_diet(days, false)),
  revision integer not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  foreign key (clinic_id, visit_id) references public.visits(clinic_id, id)
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null,
  patient_id uuid not null,
  originating_visit_id uuid not null unique,
  appointment_date date not null check (appointment_date between date '2020-01-01' and date '2200-12-31'),
  revision integer not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  foreign key (clinic_id, patient_id, originating_visit_id) references public.visits(clinic_id, patient_id, id)
);
create index appointments_clinic_date_idx on public.appointments(clinic_id, appointment_date);

-- Revoke all historical direct-write column grants as well as table grants.
revoke all on public.patients, public.daily_queue from anon, authenticated;
revoke insert (clinic_id,full_name,phone) on public.patients from authenticated;
revoke insert (clinic_id,patient_id,queue_date,visit_type) on public.daily_queue from authenticated;
revoke update (status) on public.daily_queue from authenticated;
drop policy "Active clinic staff read patients" on public.patients;
drop policy "Active clinic staff create patients" on public.patients;
drop policy "Active clinic staff read queue" on public.daily_queue;
drop policy "Active clinic staff add waiting patient" on public.daily_queue;
drop policy "Active clinic staff hand off patient" on public.daily_queue;

do $$
declare t text; predicate text;
begin
  foreach t in array array['patients','daily_queue','visits','visit_measurements','visit_private_notes','diet_plans','appointments'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format('grant select, insert, update on public.%I to mayaana_clinical_api',t);
    predicate := case when t in ('visit_private_notes','diet_plans')
      then '(select clinical_private.staff_role(clinic_id)) = ''doctor'''
      else '(select clinical_private.staff_role(clinic_id)) in (''doctor'',''secretary'')' end;
    execute format('create policy clinical_read on public.%I for select to authenticated, mayaana_clinical_api using (%s)',t,predicate);
    execute format('create policy clinical_insert on public.%I for insert to mayaana_clinical_api with check (%s)',t,predicate);
    execute format('create policy clinical_update on public.%I for update to mayaana_clinical_api using (%s) with check (%s)',t,predicate,predicate);
  end loop;
end $$;

-- Defense in depth: completed rows cannot be rewritten even by future APIs.
create function clinical_private.protect_completed() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare finished boolean; v_id uuid;
begin
  if tg_table_name = 'daily_queue' then finished := old.status = 'completed';
  elsif tg_table_name = 'visits' then finished := old.completed_at is not null;
  else
    if tg_table_name = 'appointments' then v_id := old.originating_visit_id; else v_id := old.visit_id; end if;
    select completed_at is not null into finished from public.visits where id = v_id;
  end if;
  if finished then raise exception using errcode = 'PT409', message = 'Completed clinical record is immutable'; end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['daily_queue','visits','visit_measurements','visit_private_notes','diet_plans','appointments'] loop
    execute format('create trigger protect_completed before update or delete on public.%I for each row execute function clinical_private.protect_completed()',t);
  end loop;
end $$;

create function clinical_private.protect_completed_insert() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare v_id uuid; finished boolean;
begin
  if tg_table_name='appointments' then v_id:=new.originating_visit_id; else v_id:=new.visit_id; end if;
  select completed_at is not null into finished from public.visits where id=v_id for share;
  if finished then raise exception using errcode='PT409',message='Completed clinical record is immutable'; end if;
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['visit_measurements','visit_private_notes','diet_plans','appointments'] loop
    execute format('create trigger protect_completed_insert before insert on public.%I for each row execute function clinical_private.protect_completed_insert()',t);
  end loop;
end $$;

create function clinical_private.lock_queue(p_queue uuid, p_revision integer, p_doctor boolean, p_states text[])
returns public.daily_queue language plpgsql security invoker set search_path = '' as $$
declare q public.daily_queue; r text;
begin
  select * into q from public.daily_queue where id = p_queue for update;
  if not found then raise exception using errcode = '42501', message = 'Clinical record unavailable'; end if;
  r := clinical_private.staff_role(q.clinic_id);
  if r is null or (p_doctor and r <> 'doctor') then raise exception using errcode = '42501', message = 'Clinical access denied'; end if;
  if p_revision is null or q.revision <> p_revision then raise exception using errcode = 'PT409', message = 'Clinical revision conflict'; end if;
  if not q.status = any(p_states) then raise exception using errcode = 'PT409', message = 'Invalid clinical transition'; end if;
  return q;
end $$;

create function public.clinical_create_patient(p_id uuid, p_clinic uuid, p_name text, p_phone text, p_height numeric, p_gender text, p_birth_year integer, p_goal text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare existing public.patients;
begin
  if clinical_private.staff_role(p_clinic) is null then raise exception using errcode = '42501', message = 'Clinical access denied'; end if;
  if p_id is null or p_height is null or p_gender is null or p_goal is null or p_phone is null
    or p_phone !~ '^[+]?[0-9]{6,15}$' or (p_birth_year is not null and p_birth_year > extract(year from now())) then
    raise exception using errcode = '22023', message = 'Invalid patient details';
  end if;
  insert into public.patients(id,clinic_id,full_name,phone,height_cm,gender,birth_year,goal,created_by,updated_by)
    values(p_id,p_clinic,btrim(p_name),p_phone,p_height,p_gender,p_birth_year,p_goal,auth.uid(),auth.uid()) on conflict(id) do nothing;
  select * into existing from public.patients where id = p_id;
  if not found or existing.clinic_id <> p_clinic or existing.full_name is distinct from btrim(p_name) or existing.phone is distinct from p_phone
    or existing.height_cm is distinct from p_height or existing.gender is distinct from p_gender or existing.birth_year is distinct from p_birth_year or existing.goal is distinct from p_goal then
    raise exception using errcode = 'PT409', message = 'Patient request conflict';
  end if;
  return existing.id;
end $$;

create function public.clinical_enqueue(p_clinic uuid, p_patient uuid, p_kind text)
returns public.daily_queue language plpgsql security definer set search_path = '' as $$
declare q public.daily_queue;
begin
  if clinical_private.staff_role(p_clinic) is null then raise exception using errcode = '42501', message = 'Clinical access denied'; end if;
  insert into public.daily_queue(clinic_id,patient_id,visit_type,created_by,updated_by)
    values(p_clinic,p_patient,p_kind,auth.uid(),auth.uid()) on conflict(clinic_id,patient_id,queue_date) do nothing;
  select * into q from public.daily_queue where clinic_id=p_clinic and patient_id=p_patient and queue_date=(now() at time zone 'Asia/Damascus')::date for update;
  if not found or q.visit_type is distinct from p_kind then raise exception using errcode='PT409',message='Queue request conflict'; end if;
  insert into public.visits(clinic_id,patient_id,queue_entry_id,created_by,updated_by)
    values(q.clinic_id,q.patient_id,q.id,auth.uid(),auth.uid()) on conflict(queue_entry_id) do nothing;
  return q;
end $$;

create function public.clinical_update_patient(p_id uuid, p_revision integer, p_name text, p_phone text, p_height numeric, p_gender text, p_birth_year integer, p_goal text)
returns integer language plpgsql security definer set search_path = '' as $$
declare p public.patients;
begin
  select * into p from public.patients where id=p_id for update;
  if not found or clinical_private.staff_role(p.clinic_id) is null then raise exception using errcode='42501',message='Clinical record unavailable'; end if;
  if p_revision is null or p.revision<>p_revision then raise exception using errcode='PT409',message='Patient revision conflict'; end if;
  if p_height is null or p_gender is null or p_goal is null or p_phone is null or p_phone !~ '^[+]?[0-9]{6,15}$'
    or (p_birth_year is not null and p_birth_year>extract(year from now())) then raise exception using errcode='22023',message='Invalid patient details'; end if;
  update public.patients set full_name=btrim(p_name),phone=p_phone,height_cm=p_height,gender=p_gender,birth_year=p_birth_year,goal=p_goal,
    revision=revision+1,updated_at=now(),updated_by=auth.uid() where id=p_id returning revision into p_revision;
  return p_revision;
end $$;

create function public.clinical_save_measurements(p_queue uuid, p_revision integer, p_values jsonb)
returns public.daily_queue language plpgsql security definer set search_path = '' as $$
declare q public.daily_queue; v public.visits;
begin
  q := clinical_private.lock_queue(p_queue,p_revision,false,array['waiting','ready']);
  if not clinical_private.valid_measurements(p_values,q.visit_type='full_exam') then raise exception using errcode='22023',message='Invalid or incomplete measurements'; end if;
  -- Historical waiting entries predate visits; create their exact visit on first intake save.
  insert into public.visits(clinic_id,patient_id,queue_entry_id,created_by,updated_by)
    values(q.clinic_id,q.patient_id,q.id,auth.uid(),auth.uid()) on conflict(queue_entry_id) do nothing;
  select * into strict v from public.visits where queue_entry_id=q.id;
  insert into public.visit_measurements(visit_id,clinic_id,measurements,recorded_by,updated_by)
    values(v.id,q.clinic_id,p_values,auth.uid(),auth.uid()) on conflict(visit_id) do update
    set measurements=excluded.measurements,revision=public.visit_measurements.revision+1,updated_at=now(),updated_by=auth.uid();
  update public.visits set revision=revision+1,updated_at=now(),updated_by=auth.uid() where id=v.id;
  update public.daily_queue set status='ready',revision=revision+1,updated_at=now(),updated_by=auth.uid() where id=q.id returning * into q;
  return q;
end $$;

create function public.clinical_handoff(p_queue uuid, p_revision integer, p_request uuid)
returns public.daily_queue language plpgsql security definer set search_path = '' as $$
declare q public.daily_queue; v public.visits; m jsonb;
begin
  select * into q from public.daily_queue where id=p_queue for update;
  if not found or clinical_private.staff_role(q.clinic_id) is null then raise exception using errcode='42501',message='Clinical record unavailable'; end if;
  if p_request is null then raise exception using errcode='22023',message='Request identity required'; end if;
  if q.handoff_request=p_request and q.status in ('with_doctor','completed') then return q; end if;
  q := clinical_private.lock_queue(p_queue,p_revision,false,array['ready']);
  select * into strict v from public.visits where queue_entry_id=q.id;
  select measurements into m from public.visit_measurements where visit_id=v.id;
  if not clinical_private.valid_measurements(m,q.visit_type='full_exam') then raise exception using errcode='22023',message='Measurements required'; end if;
  update public.visits set started_at=now(),revision=revision+1,updated_at=now(),updated_by=auth.uid() where id=v.id;
  update public.daily_queue set status='with_doctor',handoff_request=p_request,revision=revision+1,updated_at=now(),updated_by=auth.uid() where id=q.id returning * into q;
  return q;
end $$;

-- A single visit draft transaction; no secretary-readable response contains notes.
create function clinical_private.save_draft(p_q public.daily_queue, p_notes text, p_days jsonb, p_appointment date, p_complete boolean)
returns void language plpgsql security invoker set search_path = '' as $$
declare v public.visits;
begin
  if p_notes is null or char_length(p_notes)>20000 or not clinical_private.valid_diet(p_days,p_complete)
    or (p_appointment is not null and (p_appointment <= (now() at time zone 'Asia/Damascus')::date or p_appointment > (now() at time zone 'Asia/Damascus')::date + 730)) then
    raise exception using errcode='22023',message='Invalid visit draft';
  end if;
  select * into strict v from public.visits where queue_entry_id=p_q.id;
  insert into public.visit_private_notes(visit_id,clinic_id,notes,created_by,updated_by)
    values(v.id,v.clinic_id,p_notes,auth.uid(),auth.uid()) on conflict(visit_id) do update
    set notes=excluded.notes,revision=public.visit_private_notes.revision+1,updated_at=now(),updated_by=auth.uid();
  insert into public.diet_plans(visit_id,clinic_id,days,created_by,updated_by)
    values(v.id,v.clinic_id,p_days,auth.uid(),auth.uid()) on conflict(visit_id) do update
    set days=excluded.days,revision=public.diet_plans.revision+1,updated_at=now(),updated_by=auth.uid();
  if p_appointment is not null then
    insert into public.appointments(clinic_id,patient_id,originating_visit_id,appointment_date,created_by,updated_by)
      values(v.clinic_id,v.patient_id,v.id,p_appointment,auth.uid(),auth.uid()) on conflict(originating_visit_id) do update
      set appointment_date=excluded.appointment_date,revision=public.appointments.revision+1,updated_at=now(),updated_by=auth.uid();
  else
    delete from public.appointments where originating_visit_id=v.id;
  end if;
end $$;
grant delete on public.appointments to mayaana_clinical_api;
create policy clinical_delete_optional_appointment on public.appointments for delete to mayaana_clinical_api
  using ((select clinical_private.staff_role(clinic_id))='doctor' and exists(select 1 from public.visits v where v.id=originating_visit_id and v.completed_at is null));

create function public.clinical_save_doctor_draft(p_queue uuid, p_revision integer, p_notes text, p_days jsonb, p_appointment date)
returns public.daily_queue language plpgsql security definer set search_path = '' as $$
declare q public.daily_queue;
begin
  q := clinical_private.lock_queue(p_queue,p_revision,true,array['with_doctor']);
  perform clinical_private.save_draft(q,p_notes,p_days,p_appointment,false);
  update public.visits set revision=revision+1,updated_at=now(),updated_by=auth.uid() where queue_entry_id=q.id;
  update public.daily_queue set revision=revision+1,updated_at=now(),updated_by=auth.uid() where id=q.id returning * into q;
  return q;
end $$;

create function public.clinical_finish(p_queue uuid, p_revision integer, p_request uuid, p_notes text, p_days jsonb, p_appointment date)
returns public.daily_queue language plpgsql security definer set search_path = '' as $$
declare q public.daily_queue; v public.visits; m jsonb;
begin
  select * into q from public.daily_queue where id=p_queue for update;
  if not found or clinical_private.staff_role(q.clinic_id) is distinct from 'doctor' then raise exception using errcode='42501',message='Clinical record unavailable'; end if;
  if p_request is null then raise exception using errcode='22023',message='Request identity required'; end if;
  if q.finish_request=p_request and q.status='completed' then return q; end if;
  q := clinical_private.lock_queue(p_queue,p_revision,true,array['with_doctor']);
  select * into strict v from public.visits where queue_entry_id=q.id;
  select measurements into m from public.visit_measurements where visit_id=v.id;
  if v.started_at is null or not clinical_private.valid_measurements(m,q.visit_type='full_exam') then raise exception using errcode='22023',message='Visit measurements required'; end if;
  perform clinical_private.save_draft(q,p_notes,p_days,p_appointment,true);
  update public.visits set completed_at=now(),revision=revision+1,updated_at=now(),updated_by=auth.uid() where id=v.id;
  update public.daily_queue set status='completed',finish_request=p_request,revision=revision+1,updated_at=now(),updated_by=auth.uid() where id=q.id returning * into q;
  return q;
end $$;

-- Lock down ALL new functions, then selectively expose only clinical mutations.
revoke all on all functions in schema clinical_private from public, anon, authenticated;
grant execute on function clinical_private.staff_role(uuid) to authenticated;
grant execute on all functions in schema clinical_private to mayaana_clinical_api;
grant create on schema public to mayaana_clinical_api;
do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'clinical_%' loop
    execute format('revoke all on function %s from public, anon, authenticated',f.signature);
    execute format('alter function %s owner to mayaana_clinical_api',f.signature);
    execute format('grant execute on function %s to authenticated',f.signature);
  end loop;
end $$;
revoke create on schema public from mayaana_clinical_api;
revoke mayaana_clinical_api from postgres;
