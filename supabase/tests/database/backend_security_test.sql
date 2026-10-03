begin;

create extension if not exists pgtap with schema extensions;

create temp table pgtap_results (
  tap_output text not null
) on commit drop;

grant insert, select on table pg_temp.pgtap_results to authenticated, anon;

select plan(42);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-4111-8111-111111111111',
    'authenticated',
    'authenticated',
    'bsi-a@example.invalid',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-4222-8222-222222222222',
    'authenticated',
    'authenticated',
    'bsi-b@example.invalid',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.bsi_profiles (
  id,
  name,
  email,
  contact_number,
  assigned_barangay_id,
  assigned_barangay_name
) values
  (
    '11111111-1111-4111-8111-111111111111',
    'Test BSI A',
    'bsi-a@example.invalid',
    'test-only',
    'barangay-a',
    'Barangay A'
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'Test BSI B',
    'bsi-b@example.invalid',
    'test-only',
    'barangay-b',
    'Barangay B'
  );

insert into public.places (
  id,
  barangay_id,
  barangay_name,
  created_by_uid,
  updated_by_uid,
  name,
  representative_name,
  address,
  purok,
  place_type
) values
  (
    'place-a',
    'barangay-a',
    'Barangay A',
    '11111111-1111-4111-8111-111111111111',
    '11111111-1111-4111-8111-111111111111',
    'Place A',
    'Representative A',
    'Address A',
    'Purok 1',
    'Household / Residence'
  ),
  (
    'place-b',
    'barangay-b',
    'Barangay B',
    '22222222-2222-4222-8222-222222222222',
    '22222222-2222-4222-8222-222222222222',
    'Place B',
    'Representative B',
    'Address B',
    'Purok 2',
    'Household / Residence'
  );

insert into public.inspections (
  id,
  bsi_uid,
  barangay_id,
  place_id,
  inspection_date,
  location_capture_status,
  result,
  findings,
  safe_water_supply,
  sanitation_facility,
  remarks
) values
  (
    'inspection-a-original',
    '11111111-1111-4111-8111-111111111111',
    'barangay-a',
    'place-a',
    '2026-01-01T00:00:00Z',
    'not_attempted',
    'for_reinspection',
    '[]'::jsonb,
    '{}'::jsonb,
    '{}'::jsonb,
    ''
  ),
  (
    'inspection-b-original',
    '22222222-2222-4222-8222-222222222222',
    'barangay-b',
    'place-b',
    '2026-01-01T00:00:00Z',
    'not_attempted',
    'compliant',
    '[]'::jsonb,
    '{}'::jsonb,
    '{}'::jsonb,
    ''
  );

insert into public.reinspections (
  id,
  bsi_uid,
  barangay_id,
  original_inspection_id,
  place_id,
  scheduled_date,
  status,
  created_at
) values (
  'reinspection-a',
  '11111111-1111-4111-8111-111111111111',
  'barangay-a',
  'inspection-a-original',
  'place-a',
  '2026-01-10T00:00:00Z',
  'pending',
  '2026-01-01T00:00:00Z'
);

insert into storage.objects (bucket_id, name, owner_id)
values
  (
    'inspection-evidence',
    'barangays/barangay-a/inspectors/11111111-1111-4111-8111-111111111111/inspections/inspection-a-original/evidence/evidence-a',
    '11111111-1111-4111-8111-111111111111'
  ),
  (
    'inspection-evidence',
    'barangays/barangay-b/inspectors/22222222-2222-4222-8222-222222222222/inspections/inspection-b-original/evidence/evidence-b',
    '22222222-2222-4222-8222-222222222222'
  );

insert into pg_temp.pgtap_results (tap_output)
select has_table('public', 'bsi_profiles', 'bsi_profiles exists');
insert into pg_temp.pgtap_results (tap_output)
select has_table('public', 'places', 'places exists');
insert into pg_temp.pgtap_results (tap_output)
select has_table('public', 'inspections', 'inspections exists');
insert into pg_temp.pgtap_results (tap_output)
select has_table('public', 'reinspections', 'reinspections exists');

insert into pg_temp.pgtap_results (tap_output)
select ok(
  (
    select count(*) = 4 and bool_and(class.relrowsecurity)
    from pg_catalog.pg_class as class
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = class.relnamespace
    where namespace.nspname = 'public'
      and class.relname in (
        'bsi_profiles',
        'places',
        'inspections',
        'reinspections'
      )
  ),
  'RLS is enabled on every application table'
);

insert into pg_temp.pgtap_results (tap_output)
select ok(
  not has_function_privilege('anon', 'private.current_barangay_id()', 'EXECUTE')
  and has_function_privilege(
    'authenticated',
    'private.current_barangay_id()',
    'EXECUTE'
  ),
  'only authenticated clients can execute the barangay helper'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '11111111-1111-4111-8111-111111111111',
  true
);
set local role authenticated;

insert into pg_temp.pgtap_results (tap_output)
select is(
  (select private.current_barangay_id()),
  'barangay-a',
  'BSI A resolves to Barangay A'
);

insert into pg_temp.pgtap_results (tap_output)
select is(
  (select count(*) from public.bsi_profiles),
  1::bigint,
  'BSI A reads only their own profile'
);

insert into pg_temp.pgtap_results (tap_output)
select is(
  (select count(*) from public.places),
  1::bigint,
  'BSI A reads only Barangay A places'
);

insert into pg_temp.pgtap_results (tap_output)
select is(
  (select count(*) from public.inspections),
  1::bigint,
  'BSI A reads only Barangay A inspections'
);

insert into pg_temp.pgtap_results (tap_output)
select is(
  (select count(*) from public.reinspections),
  1::bigint,
  'BSI A reads only Barangay A reinspections'
);

insert into pg_temp.pgtap_results (tap_output)
select throws_ok(
  $$
    insert into public.places (
      id,
      barangay_id,
      created_by_uid,
      name,
      representative_name,
      address,
      purok,
      place_type
    ) values (
      'place-a-cross',
      'barangay-b',
      '11111111-1111-4111-8111-111111111111',
      'Cross Barangay Place',
      'Representative',
      'Address',
      'Purok 3',
      'Household / Residence'
    )
  $$,
  '42501',
  null,
  'BSI A cannot create a Barangay B place'
);

insert into pg_temp.pgtap_results (tap_output)
select lives_ok(
  $$
    insert into public.places (
      id,
      barangay_id,
      created_by_uid,
      updated_by_uid,
      name,
      representative_name,
      address,
      purok,
      place_type
    ) values (
      'place-a-second',
      'barangay-a',
      '11111111-1111-4111-8111-111111111111',
      '11111111-1111-4111-8111-111111111111',
      'Second Place A',
      'Representative',
      'Address',
      'Purok 4',
      'Household / Residence'
    )
  $$,
  'BSI A can create a Barangay A place'
);

insert into pg_temp.pgtap_results (tap_output)
select throws_ok(
  $$
    update public.places
    set barangay_id = 'barangay-b',
        updated_by_uid = '11111111-1111-4111-8111-111111111111'
    where id = 'place-a'
  $$,
  '42501',
  'Place identity and ownership scope are immutable.',
  'BSI A cannot reassign a place to another barangay'
);

insert into pg_temp.pgtap_results (tap_output)
select throws_ok(
  $$delete from public.places where id = 'place-a-second'$$,
  '42501',
  null,
  'BSI clients cannot delete places'
);

insert into pg_temp.pgtap_results (tap_output)
select throws_ok(
  $$
    insert into public.inspections (
      id,
      bsi_uid,
      barangay_id,
      place_id,
      inspection_date,
      location_capture_status,
      result,
      findings,
      safe_water_supply,
      sanitation_facility,
      remarks
    ) values (
      'inspection-a-cross',
      '11111111-1111-4111-8111-111111111111',
      'barangay-b',
      'place-b',
      '2026-01-02T00:00:00Z',
      'not_attempted',
      'compliant',
      '[]'::jsonb,
      '{}'::jsonb,
      '{}'::jsonb,
      ''
    )
  $$,
  '42501',
  null,
  'BSI A cannot create a Barangay B inspection'
);

insert into pg_temp.pgtap_results (tap_output)
select throws_ok(
  $$
    insert into public.inspections (
      id,
      bsi_uid,
      barangay_id,
      place_id,
      inspection_date,
      location_capture_status,
      result,
      findings,
      safe_water_supply,
      sanitation_facility,
      remarks
    ) values (
      'inspection-a-local-uri',
      '11111111-1111-4111-8111-111111111111',
      'barangay-a',
      'place-a',
      '2026-01-02T00:00:00Z',
      'not_attempted',
      'non_compliant',
      '[{"id":"finding-a","category":"other","details":"Test","evidence":[{"id":"evidence-local","uri":"file:///local-only.jpg","source":"camera","createdAt":"2026-01-02T00:00:00Z"}]}]'::jsonb,
      '{}'::jsonb,
      '{}'::jsonb,
      ''
    )
  $$,
  '23514',
  null,
  'inspection findings cannot persist device-local evidence URIs'
);

insert into pg_temp.pgtap_results (tap_output)
select throws_ok(
  $$
    update public.inspections
    set bsi_uid = '22222222-2222-4222-8222-222222222222'
    where id = 'inspection-a-original'
  $$,
  '42501',
  'Inspection identity, ownership, place, date, and relationship fields are immutable.',
  'inspection ownership cannot be changed'
);

insert into pg_temp.pgtap_results (tap_output)
select is(
  (
    select count(*)
    from storage.objects
    where bucket_id = 'inspection-evidence'
  ),
  1::bigint,
  'BSI A reads only Barangay A evidence'
);

insert into pg_temp.pgtap_results (tap_output)
select lives_ok(
  $$
    insert into storage.objects (bucket_id, name, owner_id)
    values (
      'inspection-evidence',
      'barangays/barangay-a/inspectors/11111111-1111-4111-8111-111111111111/inspections/inspection-a-original/evidence/evidence-a-2',
      '11111111-1111-4111-8111-111111111111'
    )
  $$,
  'BSI A can upload evidence to its deterministic path'
);

insert into pg_temp.pgtap_results (tap_output)
select throws_ok(
  $$
    insert into storage.objects (bucket_id, name, owner_id)
    values (
      'inspection-evidence',
      'barangays/barangay-b/inspectors/11111111-1111-4111-8111-111111111111/inspections/inspection-a-original/evidence/evidence-cross',
      '11111111-1111-4111-8111-111111111111'
    )
  $$,
  '42501',
  null,
  'BSI A cannot upload evidence into Barangay B'
);

insert into pg_temp.pgtap_results (tap_output)
select lives_ok(
  $$
    update storage.objects
    set metadata = '{"tested":true}'::jsonb
    where bucket_id = 'inspection-evidence'
      and name = 'barangays/barangay-a/inspectors/11111111-1111-4111-8111-111111111111/inspections/inspection-a-original/evidence/evidence-a-2'
  $$,
  'BSI A can update its own evidence object for an upsert retry'
);

insert into pg_temp.pgtap_results (tap_output)
select throws_ok(
  $$
    update storage.objects
    set name = 'barangays/barangay-b/inspectors/11111111-1111-4111-8111-111111111111/inspections/inspection-a-original/evidence/evidence-a-2'
    where bucket_id = 'inspection-evidence'
      and name = 'barangays/barangay-a/inspectors/11111111-1111-4111-8111-111111111111/inspections/inspection-a-original/evidence/evidence-a-2'
  $$,
  '42501',
  null,
  'BSI A cannot move an owned object into Barangay B'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '22222222-2222-4222-8222-222222222222',
  true
);
set local role authenticated;

insert into pg_temp.pgtap_results (tap_output)
select is(
  (select private.current_barangay_id()),
  'barangay-b',
  'BSI B resolves to Barangay B'
);

insert into pg_temp.pgtap_results (tap_output)
select is(
  (select count(*) from public.places),
  1::bigint,
  'BSI B reads only Barangay B places'
);

insert into pg_temp.pgtap_results (tap_output)
select is(
  (
    select count(*)
    from public.inspections
    where barangay_id = 'barangay-a'
  ),
  0::bigint,
  'BSI B cannot read Barangay A inspections'
);

insert into pg_temp.pgtap_results (tap_output)
select is(
  (
    select count(*)
    from storage.objects
    where bucket_id = 'inspection-evidence'
      and name like 'barangays/barangay-a/%'
  ),
  0::bigint,
  'BSI B cannot read Barangay A evidence'
);

insert into pg_temp.pgtap_results (tap_output)
select is_empty(
  $$
    update public.places
    set name = 'Unauthorized change',
        updated_by_uid = '22222222-2222-4222-8222-222222222222'
    where id = 'place-a'
    returning id
  $$,
  'BSI B cannot update a Barangay A place'
);

reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select set_config('request.jwt.claim.sub', '', true);
set local role anon;

insert into pg_temp.pgtap_results (tap_output)
select throws_ok(
  $$select * from public.places$$,
  '42501',
  null,
  'anonymous users cannot read places'
);

insert into pg_temp.pgtap_results (tap_output)
select throws_ok(
  $$select * from public.inspections$$,
  '42501',
  null,
  'anonymous users cannot read inspections'
);

insert into pg_temp.pgtap_results (tap_output)
select is(
  (
    select count(*)
    from storage.objects
    where bucket_id = 'inspection-evidence'
  ),
  0::bigint,
  'anonymous users cannot read inspection evidence'
);

insert into pg_temp.pgtap_results (tap_output)
select throws_ok(
  $$
    select public.submit_inspection(
      'anonymous-inspection',
      'place-a',
      '2026-01-03T00:00:00Z',
      'not_attempted',
      'compliant',
      '[]'::jsonb,
      '{}'::jsonb,
      '{}'::jsonb,
      ''
    )
  $$,
  '42501',
  null,
  'anonymous users cannot call submit_inspection'
);

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
select set_config(
  'request.jwt.claim.sub',
  '11111111-1111-4111-8111-111111111111',
  true
);
set local role authenticated;

insert into pg_temp.pgtap_results (tap_output)
select lives_ok(
  $$
    select public.submit_inspection(
      'inspection-rpc-newest',
      'place-a',
      '2026-02-02T00:00:00Z',
      'not_attempted',
      'non_compliant',
      '[]'::jsonb,
      '{}'::jsonb,
      '{}'::jsonb,
      'Newest inspection'
    )
  $$,
  'submit_inspection persists an inspection transactionally'
);

insert into pg_temp.pgtap_results (tap_output)
select is(
  (select status from public.places where id = 'place-a'),
  'Non-Compliant',
  'submit_inspection maps result to place status'
);

insert into pg_temp.pgtap_results (tap_output)
select lives_ok(
  $$
    select public.submit_inspection(
      'inspection-rpc-older',
      'place-a',
      '2026-02-01T00:00:00Z',
      'not_attempted',
      'compliant',
      '[]'::jsonb,
      '{}'::jsonb,
      '{}'::jsonb,
      'Older delayed inspection'
    )
  $$,
  'an older delayed inspection is still persisted'
);

insert into pg_temp.pgtap_results (tap_output)
select is(
  (select status from public.places where id = 'place-a'),
  'Non-Compliant',
  'an older retry does not overwrite newer place status'
);

insert into pg_temp.pgtap_results (tap_output)
select is(
  (select last_inspection_date from public.places where id = 'place-a'),
  '2026-02-02T00:00:00Z'::timestamptz,
  'an older retry does not overwrite the newer inspection date'
);

insert into pg_temp.pgtap_results (tap_output)
select lives_ok(
  $$
    select public.submit_inspection(
      'inspection-rpc-newest',
      'place-a',
      '2026-02-02T00:00:00Z',
      'not_attempted',
      'for_reinspection',
      '[]'::jsonb,
      '{}'::jsonb,
      '{}'::jsonb,
      'Idempotent retry'
    )
  $$,
  'retrying the same stable inspection ID succeeds'
);

insert into pg_temp.pgtap_results (tap_output)
select is(
  (
    select count(*)
    from public.inspections
    where id = 'inspection-rpc-newest'
  ),
  1::bigint,
  'retrying a stable inspection ID does not create a duplicate'
);

insert into pg_temp.pgtap_results (tap_output)
select is(
  (select status from public.places where id = 'place-a'),
  'For Reinspection',
  'an idempotent latest-inspection retry updates place state'
);

insert into pg_temp.pgtap_results (tap_output)
select throws_ok(
  $$
    select public.submit_inspection(
      'inspection-rpc-cross',
      'place-b',
      '2026-02-03T00:00:00Z',
      'not_attempted',
      'compliant',
      '[]'::jsonb,
      '{}'::jsonb,
      '{}'::jsonb,
      'Cross barangay'
    )
  $$,
  '42501',
  'The place is not available in the assigned barangay.',
  'submit_inspection cannot target another barangay place'
);

insert into pg_temp.pgtap_results (tap_output)
select throws_ok(
  $$
    select public.submit_inspection(
      'inspection-rpc-newest',
      'place-a-second',
      '2026-02-02T00:00:00Z',
      'not_attempted',
      'compliant',
      '[]'::jsonb,
      '{}'::jsonb,
      '{}'::jsonb,
      'Conflicting stable ID'
    )
  $$,
  '23505',
  'The inspection ID is already associated with different immutable fields.',
  'a stable inspection ID cannot be reassigned to another place'
);

select * from finish();

select
  (regexp_match(tap_output, '^(not )?ok ([0-9]+)'))[2]::integer as test_number,
  case
    when tap_output like 'ok %' then 'ok'
    else 'not ok'
  end as status,
  regexp_replace(
    split_part(tap_output, E'\n', 1),
    '^(not )?ok [0-9]+ - ',
    ''
  ) as description,
  tap_output
from pg_temp.pgtap_results
order by test_number;

rollback;

