-- Run only on an isolated test database AFTER the migrations are approved/applied there.
-- Fixture writes are rolled back; never run this against the remote project.
begin;
select plan(20);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'doctor-a@example.invalid'),
  ('22222222-2222-2222-2222-222222222222', 'secretary-a@example.invalid'),
  ('33333333-3333-3333-3333-333333333333', 'doctor-b@example.invalid');
insert into public.clinics (id, name, doctor_user_id) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Test clinic A', '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Test clinic B', '33333333-3333-3333-3333-333333333333');
insert into public.clinic_staff (user_id, clinic_id, role, login_email, display_name, active, must_change_password) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'doctor', 'doctor-a@example.invalid', 'Doctor A', true, false),
  ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'secretary', 'secretary-a@example.invalid', 'Secretary A', true, false),
  ('33333333-3333-3333-3333-333333333333', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'doctor', 'doctor-b@example.invalid', 'Doctor B', true, false);
insert into public.patients (id, clinic_id, full_name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Same Name'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Same Name'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Same Name');
insert into public.daily_queue (id, clinic_id, patient_id, visit_type) values
  ('aaaaaaaa-1000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-0000-0000-0000-000000000001', 'full_exam'),
  ('aaaaaaaa-1000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-0000-0000-0000-000000000002', 'follow_up'),
  ('bbbbbbbb-1000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bbbbbbbb-0000-0000-0000-000000000001', 'follow_up');
insert into public.visits (id, clinic_id, queue_id, patient_id, created_by) values
  ('aaaaaaaa-2000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-1000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-2000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bbbbbbbb-1000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333');
insert into public.visit_measurements (id, clinic_id, visit_id, recorded_by, weight_kg) values
  ('aaaaaaaa-3000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-2000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 65),
  ('bbbbbbbb-3000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bbbbbbbb-2000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 80);
insert into public.visit_private_notes (id, clinic_id, visit_id, author_id, body) values
  ('aaaaaaaa-4000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-2000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Private A'),
  ('bbbbbbbb-4000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bbbbbbbb-2000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'Private B');

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select results_eq($$select count(*)::int from public.visits$$, array[1], 'doctor A sees only clinic A visits');
select results_eq($$select body from public.visit_private_notes$$, array['Private A'], 'doctor A reads only clinic A private note');
select results_eq($$update public.visit_private_notes set body = 'Edited A' where id = 'aaaaaaaa-4000-0000-0000-000000000001' returning body$$, array['Edited A'], 'doctor A edits private note');
select throws_ok($$insert into public.visit_private_notes (clinic_id, visit_id, author_id, body) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-2000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'duplicate')$$, '23505', null, 'repeat private note submission cannot create duplicate');
select is_empty($$update public.visit_private_notes set body = 'stolen' where id = 'bbbbbbbb-4000-0000-0000-000000000001' returning body$$, 'doctor A cannot edit clinic B note');
select throws_ok($$insert into public.visit_private_notes (clinic_id, visit_id, author_id, body) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bbbbbbbb-2000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'stolen')$$, '42501', null, 'doctor A cannot write clinic B note');

set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select results_eq($$select count(*)::int from public.visits$$, array[1], 'secretary A sees only clinic A visits');
select is_empty($$select id from public.visit_private_notes$$, 'secretary reads no private notes');
select throws_ok($$insert into public.visit_private_notes (clinic_id, visit_id, author_id, body) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-2000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'stolen')$$, '42501', null, 'secretary cannot write private note');
select is_empty($$update public.visit_private_notes set body = 'stolen' returning body$$, 'secretary cannot edit private notes');
select results_eq($$update public.visit_measurements set weight_kg = 66 where id = 'aaaaaaaa-3000-0000-0000-000000000001' returning weight_kg$$, array[66::numeric], 'secretary corrects clinic A measurements');
select is_empty($$update public.visit_measurements set weight_kg = 1 where id = 'bbbbbbbb-3000-0000-0000-000000000001' returning weight_kg$$, 'secretary cannot edit clinic B measurements');
select results_eq($$insert into public.visits (clinic_id, queue_id, patient_id, created_by) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-1000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222') returning patient_id$$, array['aaaaaaaa-0000-0000-0000-000000000002'::uuid], 'secretary opens distinct same-name patient visit by UUID');
select results_eq($$insert into public.visit_measurements (clinic_id, visit_id, recorded_by, weight_kg) select clinic_id, id, '22222222-2222-2222-2222-222222222222', 70 from public.visits where queue_id = 'aaaaaaaa-1000-0000-0000-000000000002' returning weight_kg$$, array[70::numeric], 'secretary records measurements');
select throws_ok($$insert into public.visits (clinic_id, queue_id, patient_id, created_by) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bbbbbbbb-1000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222')$$, '42501', null, 'secretary A cannot open clinic B visit');
select throws_ok($$insert into public.visits (clinic_id, queue_id, patient_id, created_by) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-1000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222')$$, '23505', null, 'repeat visit submission cannot create duplicate');
select throws_ok($$insert into public.visit_measurements (clinic_id, visit_id, recorded_by, weight_kg) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-2000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 65)$$, '23505', null, 'repeat measurement submission cannot create duplicate');

set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select results_eq($$select count(*)::int from public.visits$$, array[1], 'doctor B sees only clinic B visits');
select results_eq($$select body from public.visit_private_notes$$, array['Private B'], 'doctor B sees only clinic B note');
select results_eq($$select weight_kg from public.visit_measurements$$, array[80::numeric], 'doctor B sees only clinic B measurements');

select * from finish();
rollback;
