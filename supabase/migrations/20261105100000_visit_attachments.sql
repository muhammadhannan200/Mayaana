-- Doctor-only files on a visit, such as lab results. Files live in a private
-- bucket and open through short signed links. A visit's files freeze when it
-- finishes. Rows stay hidden until the browser confirms the upload finished.
begin;
set local lock_timeout = '5s';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('visit-attachments', 'visit-attachments', false, 10485760,
  array['image/jpeg','image/png','image/webp','image/heic','application/pdf'])
on conflict (id) do nothing;

create table public.visit_attachments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null,
  visit_id uuid not null,
  file_name text not null check (char_length(file_name) between 1 and 200),
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','image/heic','application/pdf')),
  size_bytes integer not null check (size_bytes between 1 and 10485760),
  storage_path text not null unique,
  uploaded_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (clinic_id, visit_id) references public.visits(clinic_id, id) on delete restrict
);
create index visit_attachments_visit_idx on public.visit_attachments(visit_id);
alter table public.visit_attachments enable row level security;
revoke all on public.visit_attachments from anon, authenticated;
grant select on public.visit_attachments to authenticated;
grant select, insert, update, delete on public.visit_attachments to mayaana_clinical_api;
create policy clinical_read on public.visit_attachments for select to authenticated, mayaana_clinical_api
  using ((select clinical_private.staff_role(clinic_id)) = 'doctor');
create policy clinical_insert on public.visit_attachments for insert to mayaana_clinical_api
  with check ((select clinical_private.staff_role(clinic_id)) = 'doctor');
create policy clinical_update on public.visit_attachments for update to mayaana_clinical_api
  using ((select clinical_private.staff_role(clinic_id)) = 'doctor')
  with check ((select clinical_private.staff_role(clinic_id)) = 'doctor');
create policy clinical_delete on public.visit_attachments for delete to mayaana_clinical_api
  using ((select clinical_private.staff_role(clinic_id)) = 'doctor');

create function clinical_private.open_visit_for_files(p_queue uuid)
returns public.visits language plpgsql security invoker set search_path = '' as $$
declare q public.daily_queue; v public.visits;
begin
  select * into q from public.daily_queue where id=p_queue for update;
  if not found or clinical_private.staff_role(q.clinic_id) is distinct from 'doctor' then
    raise exception using errcode='42501',message='Clinical record unavailable';
  end if;
  select * into v from public.visits where queue_entry_id=q.id;
  if q.status<>'with_doctor' or not found or v.completed_at is not null then
    raise exception using errcode='PT409',message='Invalid clinical transition';
  end if;
  return v;
end $$;
grant execute on function clinical_private.open_visit_for_files(uuid) to mayaana_clinical_api;

create function public.clinical_add_attachment(p_queue uuid, p_name text, p_mime text, p_size integer)
returns public.visit_attachments language plpgsql security definer set search_path = '' as $$
declare v public.visits; a public.visit_attachments; new_id uuid := gen_random_uuid();
begin
  v := clinical_private.open_visit_for_files(p_queue);
  if (select count(*) from public.visit_attachments x where x.visit_id=v.id) >= 10 then
    raise exception using errcode='PT409',message='Too many attachments',detail='attachment_limit';
  end if;
  insert into public.visit_attachments(id,clinic_id,visit_id,file_name,mime_type,size_bytes,storage_path,created_by)
    values (new_id,v.clinic_id,v.id,p_name,p_mime,p_size,v.clinic_id::text||'/'||v.id::text||'/'||new_id::text,auth.uid())
    returning * into a;
  return a;
end $$;

create function public.clinical_confirm_attachment(p_queue uuid, p_attachment uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.visits;
begin
  v := clinical_private.open_visit_for_files(p_queue);
  update public.visit_attachments set uploaded_at=now() where id=p_attachment and visit_id=v.id;
  if not found then raise exception using errcode='42501',message='Clinical record unavailable'; end if;
end $$;

create function public.clinical_delete_attachment(p_queue uuid, p_attachment uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v public.visits; path text;
begin
  v := clinical_private.open_visit_for_files(p_queue);
  delete from public.visit_attachments where id=p_attachment and visit_id=v.id returning storage_path into path;
  if path is null then raise exception using errcode='42501',message='Clinical record unavailable'; end if;
  return path;
end $$;

create policy visit_attachments_read on storage.objects for select to authenticated
  using (bucket_id='visit-attachments' and (select clinical_private.staff_role(((storage.foldername(name))[1])::uuid))='doctor');
create policy visit_attachments_insert on storage.objects for insert to authenticated
  with check (bucket_id='visit-attachments' and (select clinical_private.staff_role(((storage.foldername(name))[1])::uuid))='doctor'
    and exists (select 1 from public.visit_attachments a where a.storage_path=name and a.uploaded_at is null));
create policy visit_attachments_delete on storage.objects for delete to authenticated
  using (bucket_id='visit-attachments' and (select clinical_private.staff_role(((storage.foldername(name))[1])::uuid))='doctor');

-- Same temporary, one-way ownership grant as the clinical foundation.
grant mayaana_clinical_api to postgres;
grant create on schema public to mayaana_clinical_api;
do $$ declare f text; begin
  foreach f in array array['public.clinical_add_attachment(uuid,text,text,integer)','public.clinical_confirm_attachment(uuid,uuid)','public.clinical_delete_attachment(uuid,uuid)'] loop
    execute format('revoke all on function %s from public, anon, authenticated',f);
    execute format('alter function %s owner to mayaana_clinical_api',f);
    execute format('grant execute on function %s to authenticated',f);
  end loop;
end $$;
revoke create on schema public from mayaana_clinical_api;
revoke mayaana_clinical_api from postgres;
commit;
