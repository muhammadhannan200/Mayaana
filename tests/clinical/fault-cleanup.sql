do $fault$
begin
drop trigger if exists test_reject_handoff on public.daily_queue;
drop trigger if exists test_reject_completion on public.appointments;
drop function if exists clinical_private.test_reject_handoff();
drop function if exists clinical_private.test_reject_completion();
end $fault$;
