-- Isolated runner only. Bypass lifecycle triggers, NOT table constraints. One
-- statement, because the runner rejects multiple commands; the Z9999 exception
-- rolls back every synthetic write so other scenarios retain their fixtures.
do $$
declare measurement_id uuid; violated_constraint text;
begin
  perform set_config('session_replication_role', 'replica', true);
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
    raise exception using errcode = 'Z9999', message = 'Discard synthetic writes';
  exception when sqlstate 'Z9999' then
    null;
  end;
  perform set_config('session_replication_role', 'origin', true);
end $$;
