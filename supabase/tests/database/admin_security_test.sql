begin;

create extension if not exists pgtap with schema extensions;

create temp table pgtap_results (tap_output text not null) on commit drop;
grant insert, select on table pg_temp.pgtap_results to authenticated, anon;

select plan(19);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '81111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'phase8-admin@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '82222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'phase8-bsi-a@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '83333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'phase8-bsi-b@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '84444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', 'phase8-inactive@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '85555555-5555-4555-8555-555555555555', 'authenticated', 'authenticated', 'phase8-temporary@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.barangays (id, display_name) values
  ('phase8-a', 'Phase 8 A'),
  ('phase8-b', 'Phase 8 B');

insert into public.bsi_profiles (
  id, name, email, contact_number, assigned_barangay_id,
  assigned_barangay_name, role, active, jurisdiction_name
) values
  ('81111111-1111-4111-8111-111111111111', 'Phase 8 Admin', 'phase8-admin@example.invalid', 'test-only', null, null, 'admin', true, 'Test Municipality'),
  ('82222222-2222-4222-8222-222222222222', 'Phase 8 BSI A', 'phase8-bsi-a@example.invalid', 'test-only', 'phase8-a', 'Phase 8 A', 'bsi', true, null),
  ('83333333-3333-4333-8333-333333333333', 'Phase 8 BSI B', 'phase8-bsi-b@example.invalid', 'test-only', 'phase8-b', 'Phase 8 B', 'bsi', true, null),
  ('84444444-4444-4444-8444-444444444444', 'Phase 8 Inactive', 'phase8-inactive@example.invalid', 'test-only', 'phase8-a', 'Phase 8 A', 'bsi', false, null),
  ('85555555-5555-4555-8555-555555555555', 'Phase 8 Temporary', 'phase8-temporary@example.invalid', 'test-only', 'phase8-a', 'Phase 8 A', 'bsi', true, null);

update public.bsi_profiles
set must_change_password = true
where id = '85555555-5555-4555-8555-555555555555';

insert into public.places (
  id, barangay_id, barangay_name, created_by_uid, name,
  representative_name, address, purok, place_type
) values
  ('phase8-place-a', 'phase8-a', 'Phase 8 A', '82222222-2222-4222-8222-222222222222', 'Phase 8 Place A', 'A', 'A', 'A', 'Household / Residence'),
  ('phase8-place-b', 'phase8-b', 'Phase 8 B', '83333333-3333-4333-8333-333333333333', 'Phase 8 Place B', 'B', 'B', 'B', 'Household / Residence');

insert into public.inspections (
  id, bsi_uid, barangay_id, place_id, inspection_date,
  location_capture_status, result, findings, safe_water_supply,
  sanitation_facility, remarks
) values
  ('phase8-inspection-a', '82222222-2222-4222-8222-222222222222', 'phase8-a', 'phase8-place-a', '2026-10-01T00:00:00Z', 'not_attempted', 'for_reinspection', '[]', '{}', '{}', ''),
  ('phase8-inspection-b', '83333333-3333-4333-8333-333333333333', 'phase8-b', 'phase8-place-b', '2026-10-01T00:00:00Z', 'not_attempted', 'compliant', '[]', '{}', '{}', '');

insert into public.reinspections (
  id, bsi_uid, barangay_id, original_inspection_id, place_id,
  scheduled_date, status
) values (
  'phase8-reinspection-a', '82222222-2222-4222-8222-222222222222',
  'phase8-a', 'phase8-inspection-a', 'phase8-place-a',
  '2026-10-10T00:00:00Z', 'pending'
);

insert into public.admin_audit_log (
  admin_user_id, action, target_bsi_user_id, after_values
) values (
  '81111111-1111-4111-8111-111111111111', 'account_reactivated',
  '82222222-2222-4222-8222-222222222222', '{"active":true}'
);

insert into storage.objects (bucket_id, name, owner_id) values (
  'inspection-evidence',
  'barangays/phase8-a/inspectors/82222222-2222-4222-8222-222222222222/inspections/phase8-inspection-a/evidence/phase8-evidence',
  '82222222-2222-4222-8222-222222222222'
);

select set_config('request.jwt.claims', '{"sub":"81111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', '81111111-1111-4111-8111-111111111111', true);
set local role authenticated;

insert into pg_temp.pgtap_results select is(
  (
    select count(*)
    from public.bsi_profiles
    where id in (
      '81111111-1111-4111-8111-111111111111',
      '82222222-2222-4222-8222-222222222222',
      '83333333-3333-4333-8333-333333333333',
      '84444444-4444-4444-8444-444444444444',
      '85555555-5555-4555-8555-555555555555'
    )
  ),
  5::bigint,
  'active admin can read all Phase 8 fixture profiles'
);
insert into pg_temp.pgtap_results select is(
  (
    select count(*)
    from public.places
    where id in ('phase8-place-a', 'phase8-place-b')
  ),
  2::bigint,
  'active admin can read Phase 8 fixture places across barangays'
);
insert into pg_temp.pgtap_results select is(
  (
    select count(*)
    from public.inspections
    where id in ('phase8-inspection-a', 'phase8-inspection-b')
  ),
  2::bigint,
  'active admin can read Phase 8 fixture inspections across barangays'
);
insert into pg_temp.pgtap_results select is(
  (
    select count(*)
    from public.reinspections
    where id = 'phase8-reinspection-a'
  ),
  1::bigint,
  'active admin can read the Phase 8 fixture reinspection'
);
insert into pg_temp.pgtap_results select is((select count(*) from public.admin_audit_log), 1::bigint, 'active admin can read account audit events');
insert into pg_temp.pgtap_results select is(
  (
    select count(*)
    from storage.objects
    where bucket_id = 'inspection-evidence'
      and name = 'barangays/phase8-a/inspectors/82222222-2222-4222-8222-222222222222/inspections/phase8-inspection-a/evidence/phase8-evidence'
  ),
  1::bigint,
  'active admin can read the Phase 8 fixture private evidence metadata'
);

reset role;
select set_config('request.jwt.claims', '{"sub":"82222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', '82222222-2222-4222-8222-222222222222', true);
set local role authenticated;

insert into pg_temp.pgtap_results select is((select count(*) from public.bsi_profiles), 1::bigint, 'BSI can still read only their own profile');
insert into pg_temp.pgtap_results select is((select count(*) from public.places), 1::bigint, 'BSI remains scoped to the assigned barangay places');
insert into pg_temp.pgtap_results select is((select count(*) from public.inspections), 1::bigint, 'BSI remains scoped to the assigned barangay inspections');
insert into pg_temp.pgtap_results select is((select count(*) from public.admin_audit_log), 0::bigint, 'BSI cannot read administrator audit events');

reset role;
select set_config('request.jwt.claims', '{"sub":"84444444-4444-4444-8444-444444444444","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', '84444444-4444-4444-8444-444444444444', true);
set local role authenticated;

insert into pg_temp.pgtap_results select is((select count(*) from public.bsi_profiles), 1::bigint, 'inactive BSI can read only the profile needed for a clear rejection');
insert into pg_temp.pgtap_results select is((select count(*) from public.places), 0::bigint, 'inactive BSI cannot read places');
insert into pg_temp.pgtap_results select is((select count(*) from public.inspections), 0::bigint, 'inactive BSI cannot read inspections');
insert into pg_temp.pgtap_results select is((select count(*) from storage.objects where bucket_id = 'inspection-evidence'), 0::bigint, 'inactive BSI cannot read private evidence');

reset role;
select set_config('request.jwt.claims', '{"sub":"85555555-5555-4555-8555-555555555555","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', '85555555-5555-4555-8555-555555555555', true);
set local role authenticated;
insert into pg_temp.pgtap_results select is((select count(*) from public.places), 0::bigint, 'BSI awaiting a required password change has no operational data access');

reset role;
insert into pg_temp.pgtap_results select ok(not has_function_privilege('authenticated', 'public.admin_create_bsi_profile(uuid,uuid,text,text,text,text,text)', 'EXECUTE'), 'mobile authenticated role cannot execute the service-only create-profile RPC');
insert into pg_temp.pgtap_results select ok(not has_function_privilege('authenticated', 'public.complete_password_change(uuid)', 'EXECUTE'), 'mobile authenticated role cannot bypass the server-controlled password-change flow');

select set_config('request.jwt.claims', '{"role":"anon"}', true);
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
insert into pg_temp.pgtap_results select throws_ok('select * from public.bsi_profiles', '42501', 'permission denied for table bsi_profiles', 'anonymous users cannot read profiles');
insert into pg_temp.pgtap_results select throws_ok('select * from public.places', '42501', 'permission denied for table places', 'anonymous users cannot read places');

reset role;
select * from finish();

select
  (regexp_match(tap_output, '^(not )?ok ([0-9]+)'))[2]::integer as test_number,
  case when tap_output like 'ok %' then 'ok' else 'not ok' end as status,
  regexp_replace(split_part(tap_output, E'\n', 1), '^(not )?ok [0-9]+ - ', '') as description,
  tap_output
from pg_temp.pgtap_results
order by test_number;

rollback;
