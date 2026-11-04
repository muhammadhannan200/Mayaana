-- Isolated runner only. Bypass lifecycle triggers, NOT table constraints, and
-- roll back every synthetic write so other scenarios retain their fixtures.
begin;
set local session_replication_role = replica;
do $$
declare measurement_id uuid; violated_constraint text;
begin
  if not clinical_private.valid_measurements('{"weight":200}'::jsonb, false)
    or clinical_private.valid_measurements('{"weight":200.01}'::jsonb, false) then
    raise exception 'Private validator must accept 200 kg and reject 200.01 kg';
  end if;
  select id into strict measurement_id from public.visit_measurements
    order by id limit 1;
  update public.visit_measurements set weight_kg = 200 where id = measurement_id;
  begin
    update public.visit_measurements set weight_kg = 200.01 where id = measurement_id;
    raise exception 'Table constraint accepted 200.01 kg';
  exception when check_violation then
    get stacked diagnostics violated_constraint = constraint_name;
    if violated_constraint <> 'visit_measurements_weight_kg_check' then
      raise exception 'Unexpected rejecting constraint: %', violated_constraint;
    end if;
  end;
end $$;
rollback;
