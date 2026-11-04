-- Catalog-only assertions against the isolated runner database.
do $$
declare t text; relation oid; api oid; f record;
begin
  if not exists (
    select 1 from pg_index i
    where i.indexrelid = 'public.daily_queue_one_with_doctor_per_clinic'::regclass
      and i.indisunique and i.indisvalid
      and i.indnkeyatts = 1
      and pg_get_indexdef(i.indexrelid, 1, true) = 'clinic_id'
      and pg_get_expr(i.indpred, i.indrelid) = '(status = ''with_doctor''::text)'
  ) then raise exception 'Missing clinic-scoped active consultation invariant'; end if;
  select oid into strict api from pg_roles where rolname='mayaana_clinical_api'
    and not rolcanlogin and not rolsuper and not rolcreatedb and not rolcreaterole and not rolbypassrls;
  if pg_has_role('authenticated',api,'MEMBER') or pg_has_role('anon',api,'MEMBER') then raise exception 'Application role can assume clinical writer'; end if;
  if has_schema_privilege(api,'public','CREATE') or has_schema_privilege(api,'clinical_private','CREATE') then raise exception 'Clinical API can create schema objects'; end if;
  if exists(select 1 from pg_auth_members where member=api and roleid<>(select oid from pg_roles where rolname='authenticated')) then raise exception 'Clinical API inherits unexpected role privileges'; end if;
  -- The cycle-breaking directory helper is private, caller-scoped and pinned.
  select p.* into strict f from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='clinical_private' and p.proname='directory_doctor_clinic' and p.pronargs=0;
  if not f.prosecdef or f.proowner<>(select oid from pg_roles where rolname='postgres')
    or f.provolatile<>'s' or not coalesce(f.proconfig @> array['search_path=""'],false)
    or has_function_privilege('anon',f.oid,'EXECUTE')
    or not has_function_privilege('authenticated',f.oid,'EXECUTE') then
    raise exception 'Unsafe directory helper owner/config/grants';
  end if;
  -- Both intake overloads retain the non-bypass owner, pinned search path and
  -- authenticated-only execution after replacing the current RPC body.
  for f in select p.* from pg_proc p where p.oid in (
    'public.clinical_save_measurements(uuid,integer,jsonb)'::regprocedure,
    'public.clinical_save_measurements(uuid,integer,uuid,jsonb)'::regprocedure
  ) loop
    if not f.prosecdef or f.proowner<>api
      or not coalesce(f.proconfig @> array['search_path=""'],false)
      or not has_function_privilege('authenticated',f.oid,'EXECUTE')
      or has_function_privilege('anon',f.oid,'EXECUTE')
      or exists(select 1 from aclexplode(coalesce(f.proacl,acldefault('f',f.proowner))) where grantee=0 and privilege_type='EXECUTE') then
      raise exception 'Unsafe intake owner/config/grants';
    end if;
  end loop;
  foreach t in array array['clinics','clinic_staff'] loop
    relation := ('public.'||t)::regclass;
    if not exists(select 1 from pg_class where oid=relation and relrowsecurity) then raise exception 'Directory RLS disabled: %',t; end if;
    if has_table_privilege('anon',relation,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') or has_any_column_privilege('anon',relation,'SELECT,INSERT,UPDATE') then raise exception 'Anonymous directory access: %',t; end if;
    if has_table_privilege('authenticated',relation,'INSERT,UPDATE,DELETE,TRUNCATE') or has_any_column_privilege('authenticated',relation,'INSERT,UPDATE') then raise exception 'Direct directory write bypass: %',t; end if;
  end loop;
  foreach t in array array['patients','daily_queue','visits','visit_measurements','visit_private_notes','diet_plans','appointments'] loop
    relation := ('public.'||t)::regclass;
    if not exists(select 1 from pg_class where oid=relation and relrowsecurity and relowner<>api) then raise exception 'Missing RLS or unsafe table owner: %',t; end if;
    if has_table_privilege('anon',relation,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') or has_any_column_privilege('anon',relation,'SELECT,INSERT,UPDATE') then raise exception 'Anonymous clinical access: %',t; end if;
    if has_table_privilege('authenticated',relation,'INSERT,UPDATE,DELETE,TRUNCATE') or has_any_column_privilege('authenticated',relation,'INSERT,UPDATE') then raise exception 'Direct clinical write bypass: %',t; end if;
    if exists(select 1 from pg_policy where polrelid=relation and polcmd='w' and (polqual is null or polwithcheck is null)) then raise exception 'UPDATE policy lacks USING/WITH CHECK: %',t; end if;
  end loop;
  for f in select p.* from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'clinical_%' loop
    -- Historical read/trigger helpers remain SECURITY INVOKER; never elevate
    -- the caller's snapshot or RLS membership lookup to the writer role.
    if f.proname in ('clinical_role','clinical_snapshot','clinical_queue_guard','clinical_measurement_guard','clinical_measurement_saved') then
      if f.prosecdef or f.proowner=api or f.proconfig is null or has_function_privilege('anon',f.oid,'EXECUTE') then
        raise exception 'Unsafe historical helper: %',f.proname;
      end if;
      continue;
    end if;
    if not f.prosecdef or f.proowner<>api or f.proconfig is null then raise exception 'Unsafe RPC owner/config: %',f.proname; end if;
    if has_function_privilege('anon',f.oid,'EXECUTE') then raise exception 'Anonymous RPC access: %',f.proname; end if;
  end loop;
end $$;
