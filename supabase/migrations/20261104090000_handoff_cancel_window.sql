-- A secretary or doctor may reverse an accidental handoff for one minute, but
-- never after the doctor has opened the visit or saved anything for it.
begin;
set local lock_timeout = '5s';

alter table public.visits add column doctor_opened_at timestamptz;

create or replace function public.clinical_queue_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
declare complete boolean;
begin
  if old.status='completed' or (
    old.queue_date<>(now() at time zone 'Asia/Damascus')::date and not (
      old.status='with_doctor' and
      public.clinical_role(old.clinic_id) is not distinct from 'doctor' and
      new.status in ('with_doctor','completed')
    )
  ) then
    raise exception 'Queue entry is no longer editable' using errcode='22023';
  end if;
  if new.revision<>old.revision+1 then raise exception 'Revision conflict' using errcode='PT409'; end if;
  if old.status='with_doctor' then
    if new.status='ready' then
      -- Rechecked here so no future RPC can reopen the slot outside the window.
      if public.clinical_role(old.clinic_id) is null
        or old.handed_off_at is null
        or old.handed_off_at < now() - interval '60 seconds'
        or exists (
          select 1 from public.visits v
          where v.queue_id=old.id and v.clinic_id=old.clinic_id and v.doctor_opened_at is not null
        ) then
        raise exception 'Handoff can no longer be cancelled' using errcode='PT409', detail='cancel_unavailable';
      end if;
      new.handed_off_at:=null; new.handed_off_by:=null;
      new.updated_at:=now(); new.updated_by:=auth.uid();
      return new;
    end if;
    if public.clinical_role(old.clinic_id) is distinct from 'doctor' or new.status not in ('with_doctor','completed') then
      raise exception 'Invalid clinical transition' using errcode='PT409';
    end if;
    return new;
  end if;
  select (m.weight_kg is not null and (old.visit_type='follow_up' or
    (m.body_fat_percent is not null and m.muscle_mass_kg is not null and m.visceral_fat_level is not null
      and m.basal_metabolic_rate_kcal is not null and m.waist_cm is not null and m.arm_cm is not null
      and m.thigh_cm is not null and m.hip_cm is not null))) into complete
    from public.visits v join public.visit_measurements m on m.visit_id=v.id
    where v.queue_id=old.id and v.clinic_id=old.clinic_id;
  if new.status in ('ready','with_doctor') and not coalesce(complete,false) then
    raise exception 'Complete measurements are required' using errcode='23514';
  end if;
  if new.status='with_doctor' then
    if old.status<>'ready' then raise exception 'Patient is not ready' using errcode='22023'; end if;
    new.handed_off_at:=now(); new.handed_off_by:=auth.uid();
  else new.handed_off_at:=null; new.handed_off_by:=null;
  end if;
  new.updated_at:=now(); new.updated_by:=auth.uid();
  return new;
end $$;

-- Idempotent and revision-free: opening a visit must not invalidate the draft
-- revision the doctor is about to edit. The queue row lock orders this against
-- a concurrent cancellation.
create function public.clinical_open_visit(p_queue uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare q public.daily_queue;
begin
  select * into q from public.daily_queue where id=p_queue for update;
  if not found or clinical_private.staff_role(q.clinic_id) is distinct from 'doctor' then
    raise exception using errcode='42501',message='Clinical record unavailable';
  end if;
  if q.status<>'with_doctor' then
    raise exception using errcode='PT409',message='Invalid clinical transition';
  end if;
  update public.visits set doctor_opened_at=coalesce(doctor_opened_at,now()),updated_at=now(),updated_by=auth.uid()
    where queue_entry_id=q.id;
end $$;

create function public.clinical_cancel_handoff(p_queue uuid, p_revision integer)
returns public.daily_queue language plpgsql security definer set search_path = '' as $$
declare q public.daily_queue; v public.visits;
begin
  q := clinical_private.lock_queue(p_queue,p_revision,false,array['with_doctor']);
  select * into strict v from public.visits where queue_entry_id=q.id for update;
  if q.handed_off_at is null
    or q.handed_off_at < now() - interval '60 seconds'
    or v.doctor_opened_at is not null
    or exists (select 1 from public.visit_private_notes n where n.visit_id=v.id)
    or exists (select 1 from public.diet_plans d where d.visit_id=v.id) then
    raise exception using errcode='PT409',message='Handoff can no longer be cancelled',detail='cancel_unavailable';
  end if;
  update public.visits set started_at=null,revision=revision+1,updated_at=now(),updated_by=auth.uid() where id=v.id;
  update public.daily_queue set status='ready',handoff_request=null,revision=revision+1,updated_at=now(),updated_by=auth.uid() where id=q.id returning * into q;
  return q;
end $$;

-- Same temporary, one-way ownership grant as the clinical foundation.
grant mayaana_clinical_api to postgres;
grant create on schema public to mayaana_clinical_api;
do $$ declare f text; begin
  foreach f in array array['public.clinical_open_visit(uuid)','public.clinical_cancel_handoff(uuid,integer)'] loop
    execute format('revoke all on function %s from public, anon, authenticated',f);
    execute format('alter function %s owner to mayaana_clinical_api',f);
    execute format('grant execute on function %s to authenticated',f);
  end loop;
end $$;
revoke create on schema public from mayaana_clinical_api;
revoke mayaana_clinical_api from postgres;
commit;
