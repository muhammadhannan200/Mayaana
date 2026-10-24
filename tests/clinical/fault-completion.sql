-- Fails AFTER completion has written notes/diet, proving transaction rollback.
create function clinical_private.test_reject_completion() returns trigger language plpgsql set search_path='' as $$
begin
  raise exception using errcode='22023',message='Synthetic appointment write failure';
end $$;
revoke all on function clinical_private.test_reject_completion() from public,anon,authenticated;
create trigger test_reject_completion before insert or update on public.appointments for each row execute function clinical_private.test_reject_completion();
