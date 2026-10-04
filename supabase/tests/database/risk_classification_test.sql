begin;

create extension if not exists pgtap with schema extensions;
create temp table pgtap_results (tap_output text not null) on commit drop;

select plan(7);

insert into pg_temp.pgtap_results select is(
  (select risk_level from private.calculate_inspection_risk(
    '{"waterSourceType":"level_1","locatedWithinPremises":true,"availableAtLeast12Hours":true,"microbialTest":{"recorded":false},"arsenicTest":{"conducted":false}}',
    '{"sanitaryFacilityType":"septic_tank","sharedWithOtherHouseholds":0}'
  )), 'Low'::text, 'all safe applicable answers classify as Low Risk'
);

insert into pg_temp.pgtap_results select is(
  (select risk_level from private.calculate_inspection_risk(
    '{"waterSourceType":"level_2","locatedWithinPremises":false,"availableAtLeast12Hours":true,"microbialTest":{"recorded":false},"arsenicTest":{"conducted":false}}',
    '{"sanitaryFacilityType":"septic_tank","sharedWithOtherHouseholds":0}'
  )), 'Moderate'::text, 'a weighted score from 25 through 49 percent classifies as Moderate Risk'
);

insert into pg_temp.pgtap_results select is(
  (select risk_level from private.calculate_inspection_risk(
    '{"waterSourceType":"level_2","locatedWithinPremises":false,"availableAtLeast12Hours":false,"microbialTest":{"recorded":false},"arsenicTest":{"conducted":false}}',
    '{"sanitaryFacilityType":"septic_tank","sharedWithOtherHouseholds":0}'
  )), 'High'::text, 'a weighted score of at least 50 percent classifies as High Risk'
);

insert into pg_temp.pgtap_results select is(
  (select risk_level from private.calculate_inspection_risk(
    '{"waterSourceType":"level_1","locatedWithinPremises":true,"availableAtLeast12Hours":true,"microbialTest":{"recorded":true,"eColiResult":1},"arsenicTest":{"conducted":false}}',
    '{"sanitaryFacilityType":"septic_tank","sharedWithOtherHouseholds":0}'
  )), 'High'::text, 'a designated critical failure forces High Risk'
);

insert into pg_temp.pgtap_results select results_eq(
  $$ select maximum_points, evaluated_items from private.calculate_inspection_risk(
    '{"waterSourceType":"level_1","locatedWithinPremises":true,"availableAtLeast12Hours":true,"microbialTest":{"recorded":false},"arsenicTest":{"conducted":false}}',
    '{"sanitaryFacilityType":"septic_tank","sharedWithOtherHouseholds":0}'
  ) $$,
  $$ values (10, 5) $$,
  'not-applicable laboratory items are excluded from the denominator'
);

insert into pg_temp.pgtap_results select results_eq(
  $$ select risk_level, risk_percentage, maximum_points from private.calculate_inspection_risk('{}', '{}') $$,
  $$ values ('Unclassified'::text, null::numeric, 0) $$,
  'zero applicable items return Unclassified without division by zero'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '86666666-6666-4666-8666-666666666666',
  'authenticated', 'authenticated', 'risk-fixture@example.invalid', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now()
);
insert into public.barangays (id, display_name) values ('risk-fixture', 'Risk Fixture');
insert into public.bsi_profiles (
  id, name, email, contact_number, assigned_barangay_id,
  assigned_barangay_name, role, active
) values (
  '86666666-6666-4666-8666-666666666666', 'Risk Fixture BSI',
  'risk-fixture@example.invalid', 'test-only', 'risk-fixture',
  'Risk Fixture', 'bsi', true
);
insert into public.places (
  id, barangay_id, barangay_name, created_by_uid, name,
  representative_name, address, purok, place_type, last_inspection_date
) values (
  'risk-fixture-place', 'risk-fixture', 'Risk Fixture',
  '86666666-6666-4666-8666-666666666666', 'Risk Fixture Place',
  'Fixture', 'Fixture', 'Fixture', 'Household / Residence',
  '2026-10-02T00:00:00Z'
);
insert into public.inspections (
  id, bsi_uid, barangay_id, place_id, inspection_date,
  location_capture_status, result, findings, safe_water_supply,
  sanitation_facility, remarks
) values
  (
    'risk-newer', '86666666-6666-4666-8666-666666666666', 'risk-fixture',
    'risk-fixture-place', '2026-10-02T00:00:00Z', 'not_attempted',
    'non_compliant', '[]',
    '{"waterSourceType":"level_1","locatedWithinPremises":true,"availableAtLeast12Hours":true,"microbialTest":{"recorded":true,"eColiResult":1},"arsenicTest":{"conducted":false}}',
    '{"sanitaryFacilityType":"septic_tank","sharedWithOtherHouseholds":0}', ''
  ),
  (
    'risk-older', '86666666-6666-4666-8666-666666666666', 'risk-fixture',
    'risk-fixture-place', '2026-10-01T00:00:00Z', 'not_attempted',
    'compliant', '[]',
    '{"waterSourceType":"level_1","locatedWithinPremises":true,"availableAtLeast12Hours":true,"microbialTest":{"recorded":false},"arsenicTest":{"conducted":false}}',
    '{"sanitaryFacilityType":"septic_tank","sharedWithOtherHouseholds":0}', ''
  );

insert into pg_temp.pgtap_results select is(
  (select risk_level from public.places where id = 'risk-fixture-place'),
  'High'::text,
  'an older retried inspection cannot overwrite a newer place risk'
);

insert into pg_temp.pgtap_results select * from finish();

select tap_output
from pg_temp.pgtap_results
order by coalesce(
  substring(tap_output from '^(?:not )?ok ([0-9]+)')::integer,
  2147483647
);

rollback;
