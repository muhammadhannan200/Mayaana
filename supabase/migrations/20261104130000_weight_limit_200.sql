-- Refuse unsafe upgrades; never rewrite historical clinical measurements.
begin;
set local lock_timeout = '5s';
-- Keep concurrent writes out between the preflight check and constraint change.
lock table public.visit_measurements in access exclusive mode;

do $$ begin
  if exists (select 1 from public.visit_measurements where weight_kg > 200) then
    raise exception using errcode = '23514',
      message = 'Cannot enforce 200 kg weight limit: existing visit_measurements rows exceed 200 kg',
      hint = 'Review these measurements through an approved clinical workflow before retrying. No records were changed.';
  end if;
end $$;

alter table public.visit_measurements
  drop constraint visit_measurements_weight_kg_check,
  add constraint visit_measurements_weight_kg_check
    check (weight_kg > 0 and weight_kg <= 200);

-- CREATE OR REPLACE preserves the existing function owner and execution grants.
create or replace function clinical_private.valid_measurements(p_values jsonb, p_full boolean) returns boolean
language plpgsql immutable security invoker set search_path = '' as $$
declare k text; v jsonb; n numeric; max_value numeric;
begin
  if p_values is null or jsonb_typeof(p_values) <> 'object' then return false; end if;
  for k, v in select * from jsonb_each(p_values) loop
    max_value := case k when 'weight' then 200 when 'fat' then 100 when 'muscle' then 300
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

commit;
