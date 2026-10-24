-- Test-only denial injection, installed ONLY in an unlinked ephemeral local DB.
-- No application switch, bypass or exposed endpoint exists.
create function clinical_private.test_reject_handoff() returns trigger language plpgsql set search_path='' as $$
begin
  if new.status='with_doctor' then raise exception using errcode='22023',message='Synthetic handoff write failure'; end if;
  return new;
end $$;
revoke all on function clinical_private.test_reject_handoff() from public,anon,authenticated;
create trigger test_reject_handoff before update on public.daily_queue for each row execute function clinical_private.test_reject_handoff();
