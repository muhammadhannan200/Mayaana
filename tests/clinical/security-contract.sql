-- Catalog-only assertions against the isolated runner database.
do $$
declare t text; relation oid; api oid; f record;
begin
  select oid into strict api from pg_roles where rolname='mayaana_clinical_api'
    and not rolcanlogin and not rolsuper and not rolcreatedb and not rolcreaterole and not rolbypassrls;
  if pg_has_role('authenticated',api,'MEMBER') or pg_has_role('anon',api,'MEMBER') then raise exception 'Application role can assume clinical writer'; end if;
  if has_schema_privilege(api,'public','CREATE') or has_schema_privilege(api,'clinical_private','CREATE') then raise exception 'Clinical API can create schema objects'; end if;
  if exists(select 1 from pg_auth_members where member=api and roleid<>(select oid from pg_roles where rolname='authenticated')) then raise exception 'Clinical API inherits unexpected role privileges'; end if;
  foreach t in array array['patients','daily_queue','visits','visit_measurements','visit_private_notes','diet_plans','appointments'] loop
    relation := ('public.'||t)::regclass;
    if not exists(select 1 from pg_class where oid=relation and relrowsecurity and relowner<>api) then raise exception 'Missing RLS or unsafe table owner: %',t; end if;
    if has_table_privilege('anon',relation,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') or has_any_column_privilege('anon',relation,'SELECT,INSERT,UPDATE') then raise exception 'Anonymous clinical access: %',t; end if;
    if has_table_privilege('authenticated',relation,'INSERT,UPDATE,DELETE,TRUNCATE') or has_any_column_privilege('authenticated',relation,'INSERT,UPDATE') then raise exception 'Direct clinical write bypass: %',t; end if;
    if exists(select 1 from pg_policy where polrelid=relation and polcmd='w' and (polqual is null or polwithcheck is null)) then raise exception 'UPDATE policy lacks USING/WITH CHECK: %',t; end if;
  end loop;
  for f in select p.* from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'clinical_%' loop
    if not f.prosecdef or f.proowner<>api or f.proconfig is null then raise exception 'Unsafe RPC owner/config: %',f.proname; end if;
    if has_function_privilege('anon',f.oid,'EXECUTE') then raise exception 'Anonymous RPC access: %',f.proname; end if;
  end loop;
end $$;
