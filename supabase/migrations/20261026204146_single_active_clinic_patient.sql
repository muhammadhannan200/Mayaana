-- Do not reconcile clinical records automatically. Review existing conflicts
-- before rollout; failure rolls back the entire migration, including RPC edits.
begin;
set local lock_timeout = '5s';
lock table public.daily_queue in share row exclusive mode;

do $$ begin
  if exists (
    select 1 from public.daily_queue where status = 'with_doctor'
    group by clinic_id having count(*) > 1
  ) then
    raise exception using errcode = '23505',
      message = 'Cannot enforce single active patient: conflicting consultations exist',
      hint = 'Review active consultations per clinic and resolve them through an approved clinical workflow. No records were changed.';
  end if;
end $$;

-- Not date-scoped: an unfinished consultation continues to occupy the clinic.
-- The index arbitrates concurrent RPCs AND privileged direct table writes.
create unique index daily_queue_one_with_doctor_per_clinic
  on public.daily_queue (clinic_id) where status = 'with_doctor';

create or replace function public.clinical_handoff(p_queue uuid, p_revision integer, p_request uuid)
returns public.daily_queue language plpgsql security definer set search_path = '' as $$
declare q public.daily_queue; v public.visits; m jsonb; violated_constraint text;
begin
  select * into q from public.daily_queue where id=p_queue for update;
  if not found or clinical_private.staff_role(q.clinic_id) is null then raise exception using errcode='42501',message='Clinical record unavailable'; end if;
  if p_request is null then raise exception using errcode='22023',message='Request identity required'; end if;
  -- Retry acknowledgement precedes slot validation, even after completion and
  -- after another consultation has started. Never reopen or revise the visit.
  if q.handoff_request=p_request and q.status in ('with_doctor','completed') then return q; end if;
  q := clinical_private.lock_queue(p_queue,p_revision,false,array['ready']);
  select * into strict v from public.visits where queue_entry_id=q.id;
  select measurements into m from public.visit_measurements where visit_id=v.id;
  if not clinical_private.valid_measurements(m,q.visit_type='full_exam') then raise exception using errcode='22023',message='Measurements required'; end if;
  update public.visits set started_at=now(),revision=revision+1,updated_at=now(),updated_by=auth.uid() where id=v.id;
  update public.daily_queue set status='with_doctor',handoff_request=p_request,revision=revision+1,updated_at=now(),updated_by=auth.uid() where id=q.id returning * into q;
  return q;
exception when unique_violation then
  get stacked diagnostics violated_constraint = constraint_name;
  if violated_constraint = 'daily_queue_one_with_doctor_per_clinic' then
    -- This block rolls back BOTH writes above, including started_at/revisions.
    raise exception using errcode='PT409',
      message='Another patient is already with the doctor', detail='clinic_occupied';
  end if;
  raise;
end $$;

-- Preserve readiness, revision and role guards. Only a Doctor can continue or
-- complete an already-active consultation after midnight; old intake stays shut.
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

-- CREATE OR REPLACE retains each function's owner and EXECUTE grants. The
-- two-argument compatibility handoff still delegates to the protected RPC.
commit;
