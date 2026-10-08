-- Run after 20261005010000_fix_inspection_risk_execution.sql.
-- Exercise the actual RPC as authenticated, not only the calculator as postgres.
begin;
create extension if not exists pgtap with schema extensions;
create temp table pgtap_results (tap_output text not null) on commit drop;
grant insert, select on pg_temp.pgtap_results to authenticated;
select plan(16);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '97777777-7777-4777-8777-777777777777', 'authenticated', 'authenticated',
  'submission-regression@example.invalid', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now()
);
insert into public.barangays (id, display_name) values
  ('submission-regression-a', 'Submission Regression A'),
  ('submission-regression-b', 'Submission Regression B');
insert into public.bsi_profiles (
  id, name, email, contact_number, assigned_barangay_id,
  assigned_barangay_name, role, active, must_change_password
) values (
  '97777777-7777-4777-8777-777777777777', 'Submission Regression',
  'submission-regression@example.invalid', 'test-only',
  'submission-regression-a', 'Submission Regression A', 'bsi', true, false
);
insert into public.places (
  id, barangay_id, created_by_uid, name, representative_name, address, purok, place_type
) values
  ('submission-regression-place-a', 'submission-regression-a',
   '97777777-7777-4777-8777-777777777777', 'Test A', 'Fixture', 'Fixture', 'Fixture', 'Household / Residence'),
  ('submission-regression-place-b', 'submission-regression-b',
   '97777777-7777-4777-8777-777777777777', 'Test B', 'Fixture', 'Fixture', 'Fixture', 'Household / Residence');

insert into pg_temp.pgtap_results select ok(
  has_function_privilege('authenticated', 'private.calculate_inspection_risk(jsonb,jsonb)', 'EXECUTE'),
  'authenticated can execute the pure risk calculator required by the trigger');
insert into pg_temp.pgtap_results select ok(
  not has_function_privilege('anon', 'private.calculate_inspection_risk(jsonb,jsonb)', 'EXECUTE'),
  'anonymous users still cannot execute the risk calculator');
insert into pg_temp.pgtap_results select ok(
  not (select prosecdef from pg_proc where oid =
    'public.submit_inspection(text,text,timestamptz,text,text,jsonb,jsonb,jsonb,text,jsonb,timestamptz,text,text)'::regprocedure),
  'submission remains invoker-rights with existing RLS');

-- Persist the exact same fixture payload for the duplicate-safe retry assertion.
create temp table submission_payload (query text) on commit drop;
insert into submission_payload values ($sql$
  select public.submit_inspection(
    p_id => 'submission-regression-new', p_place_id => 'submission-regression-place-a',
    p_inspection_date => '2026-10-05T10:00:00Z', p_location_capture_status => 'not_attempted',
    p_result => 'compliant',
    p_findings => '[{"id":"stable-finding","category":"other","details":"Fixture observation","evidence":[{"id":"stable-evidence","source":"camera","createdAt":"2026-10-05T10:00:00Z","storagePath":"barangays/submission-regression-a/inspectors/97777777-7777-4777-8777-777777777777/inspections/submission-regression-new/evidence/stable-evidence"}]}]',
    p_safe_water_supply => '{"waterSourceType":"level_1","locatedWithinPremises":true,"availableAtLeast12Hours":true,"microbialTest":{"recorded":false},"arsenicTest":{"conducted":false}}',
    p_sanitation_facility => '{"sanitaryFacilityType":"septic_tank","sharedWithOtherHouseholds":0}',
    p_remarks => 'Fixture remarks'
  )
$sql$);
grant select on submission_payload to authenticated;
set local role authenticated;
set local request.jwt.claim.sub = '97777777-7777-4777-8777-777777777777';
insert into pg_temp.pgtap_results select lives_ok(
  (select query from submission_payload), 'authenticated BSI submits an inspection including risk and evidence metadata');
insert into pg_temp.pgtap_results select lives_ok(
  (select query from submission_payload), 'retrying the identical stable ID succeeds');
insert into pg_temp.pgtap_results select is(
  (select count(*)::integer from public.inspections where id = 'submission-regression-new'),
  1, 'retry retains exactly one inspection row');
insert into pg_temp.pgtap_results select is(
  (select jsonb_array_length(findings) from public.inspections where id = 'submission-regression-new'),
  1, 'retry retains exactly one finding');
insert into pg_temp.pgtap_results select is(
  (select jsonb_array_length(findings->0->'evidence') from public.inspections where id = 'submission-regression-new'),
  1, 'retry retains exactly one evidence metadata entry');
insert into pg_temp.pgtap_results select is(
  (select risk_level from public.inspections where id = 'submission-regression-new'),
  'Low', 'the server still calculates the saved risk');
insert into pg_temp.pgtap_results select is(
  (select updated_by_uid::text from public.places where id = 'submission-regression-place-a'),
  '97777777-7777-4777-8777-777777777777', 'risk update supplies the authenticated BSI attribution required by RLS');
insert into pg_temp.pgtap_results select lives_ok($sql$
  select public.submit_inspection(
    'submission-regression-old', 'submission-regression-place-a', '2026-10-04T10:00:00Z',
    'not_attempted', 'non_compliant', '[]',
    '{"microbialTest":{"recorded":true,"eColiResult":1}}', '{}', ''
  )
$sql$, 'an older queued inspection can synchronize');
insert into pg_temp.pgtap_results select is(
  (select risk_level from public.inspections where id = 'submission-regression-old'),
  'High', 'critical override is preserved for historical risk');
insert into pg_temp.pgtap_results select ok(
  (select risk_level = 'Low' and status = 'Compliant' and last_inspection_date = '2026-10-05T10:00:00Z'::timestamptz
   from public.places where id = 'submission-regression-place-a'),
  'older sync does not replace current place risk, status or date');
insert into pg_temp.pgtap_results select throws_ok($sql$
  select public.submit_inspection(
    'submission-regression-denied', 'submission-regression-place-b', now(),
    'not_attempted', 'compliant', '[]', '{}', '{}', ''
  )
$sql$, '42501', 'The place is not available in the assigned barangay.', 'cross-barangay submission stays denied');
reset role;
update public.bsi_profiles set active = false where id = '97777777-7777-4777-8777-777777777777';
set local role authenticated;
insert into pg_temp.pgtap_results select throws_ok(
  (select query from submission_payload), '42501', 'An authenticated BSI profile is required.',
  'inactive BSI stays denied');
reset role;
update public.bsi_profiles set active = true, must_change_password = true
where id = '97777777-7777-4777-8777-777777777777';
set local role authenticated;
insert into pg_temp.pgtap_results select throws_ok(
  (select query from submission_payload), '42501', 'An authenticated BSI profile is required.',
  'first-login password restriction stays enforced');
reset role;
insert into pg_temp.pgtap_results select * from finish();
select tap_output from pg_temp.pgtap_results
order by coalesce(substring(tap_output from '^(?:not )?ok ([0-9]+)')::integer, 2147483647);
rollback;
