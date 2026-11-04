-- Hosted-role safe: checks the validator and the stored constraint definition
-- without writing rows or bypassing lifecycle triggers.
do $$
declare definition text;
begin
  if not clinical_private.valid_measurements('{"weight":200}'::jsonb, false)
    or clinical_private.valid_measurements('{"weight":200.01}'::jsonb, false) then
    raise exception 'Private validator must accept 200 kg and reject 200.01 kg';
  end if;
  select pg_get_constraintdef(oid) into strict definition from pg_constraint
    where conname = 'visit_measurements_weight_kg_check'
      and conrelid = 'public.visit_measurements'::regclass;
  if definition !~ 'weight_kg <= \(?200\)?' then
    raise exception 'Unexpected weight constraint: %', definition;
  end if;
end $$;
