-- The current intake RPC accepts active same-clinic doctors and secretaries.
-- Do not delegate its write to the secretary-only Slice 1 overload, or widen
-- that legacy RPC. CREATE OR REPLACE preserves the existing restricted owner
-- (mayaana_clinical_api) and EXECUTE ACL; no table grants or policies change.
begin;
set local lock_timeout = '5s';
-- Match the foundation's temporary one-way migration ownership membership.
grant mayaana_clinical_api to postgres;

create or replace function public.clinical_save_measurements(p_queue uuid, p_revision integer, p_values jsonb)
returns public.daily_queue language plpgsql security definer set search_path = '' as $$
declare q public.daily_queue; values_text jsonb; item record; v uuid;
begin
  q := clinical_private.lock_queue(p_queue,p_revision,false,array['waiting','ready']);
  if not clinical_private.valid_measurements(p_values,q.visit_type='full_exam') then raise exception using errcode='22023',message='Invalid or incomplete measurements'; end if;
  -- Preserve Slice 1's text-format validation and typed authoritative storage.
  select jsonb_object_agg(key,value #>> '{}') into values_text from jsonb_each(p_values);
  for item in select * from jsonb_each_text(values_text) loop
    if item.key not in ('weight','fat','muscle','visceral','bmr','waist','arm','thigh','hip')
      or item.value is null or item.value !~ '^[0-9]+([.][0-9]{1,2})?$' then
      raise exception 'Invalid measurement value' using errcode = '22023';
    end if;
  end loop;
  -- Historical waiting entries predate visits; create their exact visit on first intake save.
  insert into public.visits(clinic_id,patient_id,queue_id,created_by,updated_by)
    values(q.clinic_id,q.patient_id,q.id,auth.uid(),auth.uid()) on conflict(queue_id) do nothing;
  select id into v from public.visits where queue_id=q.id and clinic_id=q.clinic_id;
  if v is null then raise exception 'Enqueue patient first' using errcode = '22023'; end if;
  -- Existing measurement/queue triggers retain revision, service-date, readiness
  -- and completion guards. RLS still executes under the non-bypass API owner.
  insert into public.visit_measurements (clinic_id, visit_id, recorded_by, request_id, request_payload, expected_revision,
    weight_kg, body_fat_percent, muscle_mass_kg, visceral_fat_level, basal_metabolic_rate_kcal, waist_cm, arm_cm, thigh_cm, hip_cm)
    values (q.clinic_id, v, auth.uid(), gen_random_uuid(), values_text, p_revision,
      (values_text->>'weight')::numeric, (values_text->>'fat')::numeric, (values_text->>'muscle')::numeric,
      (values_text->>'visceral')::numeric, (values_text->>'bmr')::numeric, (values_text->>'waist')::numeric,
      (values_text->>'arm')::numeric, (values_text->>'thigh')::numeric, (values_text->>'hip')::numeric)
    on conflict (visit_id) do update set recorded_by = excluded.recorded_by,
      request_id = excluded.request_id, request_payload = excluded.request_payload, expected_revision = excluded.expected_revision,
      weight_kg = excluded.weight_kg, body_fat_percent = excluded.body_fat_percent,
      muscle_mass_kg = excluded.muscle_mass_kg, visceral_fat_level = excluded.visceral_fat_level,
      basal_metabolic_rate_kcal = excluded.basal_metabolic_rate_kcal, waist_cm = excluded.waist_cm,
      arm_cm = excluded.arm_cm, thigh_cm = excluded.thigh_cm, hip_cm = excluded.hip_cm;
  update public.visits set revision=revision+1,updated_at=now(),updated_by=auth.uid() where queue_id=q.id;
  select * into strict q from public.daily_queue where id=p_queue;
  return q;
end $$;

revoke mayaana_clinical_api from postgres;
commit;
