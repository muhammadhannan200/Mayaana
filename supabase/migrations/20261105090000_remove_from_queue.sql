-- Staff may remove a patient who has not gone to the doctor from today's queue.
-- The queue row must go so the patient can be added again the same day. Only
-- the reason survives; anything measured before removal is deleted with it.
begin;
set local lock_timeout = '5s';

create table public.queue_removals (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete restrict,
  patient_id uuid not null,
  queue_date date not null,
  reason text not null check (reason in ('left_clinic','added_by_mistake','other')),
  removed_by uuid references auth.users(id),
  removed_at timestamptz not null default now(),
  foreign key (clinic_id, patient_id) references public.patients(clinic_id, id) on delete restrict
);
create index queue_removals_clinic_date_idx on public.queue_removals(clinic_id, queue_date);
alter table public.queue_removals enable row level security;
revoke all on public.queue_removals from anon, authenticated;
grant select on public.queue_removals to authenticated;
grant select, insert on public.queue_removals to mayaana_clinical_api;
create policy clinical_read on public.queue_removals for select to authenticated, mayaana_clinical_api
  using ((select clinical_private.staff_role(clinic_id)) in ('doctor','secretary'));
create policy clinical_insert on public.queue_removals for insert to mayaana_clinical_api
  with check ((select clinical_private.staff_role(clinic_id)) in ('doctor','secretary'));

grant delete on public.daily_queue, public.visits, public.visit_measurements to mayaana_clinical_api;
create policy clinical_remove_waiting on public.daily_queue for delete to mayaana_clinical_api
  using ((select clinical_private.staff_role(clinic_id)) in ('doctor','secretary') and status in ('waiting','ready'));
create policy clinical_remove_waiting on public.visits for delete to mayaana_clinical_api
  using ((select clinical_private.staff_role(clinic_id)) in ('doctor','secretary') and completed_at is null);
create policy clinical_remove_waiting on public.visit_measurements for delete to mayaana_clinical_api
  using ((select clinical_private.staff_role(clinic_id)) in ('doctor','secretary'));

create function public.clinical_remove_from_queue(p_queue uuid, p_revision integer, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare q public.daily_queue; v public.visits;
begin
  if p_reason is null or p_reason not in ('left_clinic','added_by_mistake','other') then
    raise exception using errcode='22023',message='Invalid clinical input';
  end if;
  q := clinical_private.lock_queue(p_queue,p_revision,false,array['waiting','ready']);
  if q.queue_date <> (now() at time zone 'Asia/Damascus')::date then
    raise exception using errcode='PT409',message='Invalid clinical transition';
  end if;
  select * into v from public.visits where queue_entry_id=q.id for update;
  if v.id is not null then
    if exists (select 1 from public.visit_private_notes n where n.visit_id=v.id)
      or exists (select 1 from public.diet_plans d where d.visit_id=v.id) then
      raise exception using errcode='PT409',message='Invalid clinical transition';
    end if;
    delete from public.visit_measurements where visit_id=v.id;
    delete from public.visits where id=v.id;
  end if;
  delete from public.daily_queue where id=q.id;
  insert into public.queue_removals(clinic_id,patient_id,queue_date,reason,removed_by)
    values (q.clinic_id,q.patient_id,q.queue_date,p_reason,auth.uid());
end $$;

-- Same temporary, one-way ownership grant as the clinical foundation.
grant mayaana_clinical_api to postgres;
grant create on schema public to mayaana_clinical_api;
revoke all on function public.clinical_remove_from_queue(uuid,integer,text) from public, anon, authenticated;
alter function public.clinical_remove_from_queue(uuid,integer,text) owner to mayaana_clinical_api;
grant execute on function public.clinical_remove_from_queue(uuid,integer,text) to authenticated;
revoke create on schema public from mayaana_clinical_api;
revoke mayaana_clinical_api from postgres;
commit;
