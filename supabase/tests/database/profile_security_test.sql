begin;

create extension if not exists pgtap with schema extensions;
create temp table pgtap_results (tap_output text not null) on commit drop;
grant insert, select on table pg_temp.pgtap_results to authenticated, anon;
select plan(12);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
('00000000-0000-0000-0000-000000000000','a1414141-1414-4414-8414-141414141414','authenticated','authenticated','profile-a@example.invalid','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','b1515151-1515-4515-8515-151515151515','authenticated','authenticated','profile-b@example.invalid','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','c1616161-1616-4616-8616-161616161616','authenticated','authenticated','profile-admin@example.invalid','',now(),'{}','{}',now(),now());

insert into public.barangays (id, display_name) values
('profile-a', 'Profile A'), ('profile-b', 'Profile B');

insert into public.bsi_profiles (
  id, name, email, contact_number, assigned_barangay_id,
  assigned_barangay_name, role, active, jurisdiction_name, avatar_path
) values
('a1414141-1414-4414-8414-141414141414','Profile A','profile-a@example.invalid','111','profile-a','Profile A','bsi',true,null,'users/a1414141-1414-4414-8414-141414141414/avatar'),
('b1515151-1515-4515-8515-151515151515','Profile B','profile-b@example.invalid','222','profile-b','Profile B','bsi',true,null,'users/b1515151-1515-4515-8515-151515151515/avatar'),
('c1616161-1616-4616-8616-161616161616','Profile Admin','profile-admin@example.invalid','333',null,null,'admin',true,'Test Municipality',null);

insert into storage.objects (bucket_id, name, owner_id, metadata) values
('profile-avatars','users/b1515151-1515-4515-8515-151515151515/avatar','b1515151-1515-4515-8515-151515151515','{"mimetype":"image/jpeg"}'::jsonb);

select set_config('request.jwt.claim.sub','a1414141-1414-4414-8414-141414141414',true);
set local role authenticated;
insert into pg_temp.pgtap_results select lives_ok(
  $test$
  do $fixture$
  begin
    insert into storage.objects (bucket_id, name, owner_id, metadata)
    values (
      'profile-avatars',
      'users/a1414141-1414-4414-8414-141414141414/avatar',
      'a1414141-1414-4414-8414-141414141414',
      '{"mimetype":"image/jpeg"}'::jsonb
    );

    update storage.objects
    set updated_at = now()
    where bucket_id = 'profile-avatars'
      and name = 'users/a1414141-1414-4414-8414-141414141414/avatar';

    if not found then
      raise exception 'The deterministic avatar fixture was not updated.';
    end if;
  end
  $fixture$
  $test$,
  'BSI can create and update their deterministic avatar path');
insert into pg_temp.pgtap_results select is(
  (select count(*) from storage.objects where bucket_id='profile-avatars' and name in (
    'users/a1414141-1414-4414-8414-141414141414/avatar',
    'users/b1515151-1515-4515-8515-151515151515/avatar'
  )), 1::bigint, 'BSI reads only their own fixture avatar');
insert into pg_temp.pgtap_results select is(
  (select count(*) from storage.objects where name='users/b1515151-1515-4515-8515-151515151515/avatar'),
  0::bigint, 'BSI cannot read another user avatar');
insert into pg_temp.pgtap_results select throws_ok(
  $$insert into storage.objects (bucket_id,name,owner_id,metadata) values ('profile-avatars','users/b1515151-1515-4515-8515-151515151515/other','a1414141-1414-4414-8414-141414141414','{"mimetype":"image/jpeg"}'::jsonb)$$,
  '42501', 'new row violates row-level security policy for table "objects"',
  'BSI cannot upload into another user avatar folder');
select public.update_own_profile('Updated Profile A','999','users/a1414141-1414-4414-8414-141414141414/avatar');
insert into pg_temp.pgtap_results select is((select name from public.bsi_profiles where id='a1414141-1414-4414-8414-141414141414'),'Updated Profile A','self profile RPC updates the allowed name field');
insert into pg_temp.pgtap_results select is((select contact_number from public.bsi_profiles where id='a1414141-1414-4414-8414-141414141414'),'999','self profile RPC updates the allowed contact field');
insert into pg_temp.pgtap_results select is((select role from public.bsi_profiles where id='a1414141-1414-4414-8414-141414141414'),'bsi','self profile RPC preserves role');
insert into pg_temp.pgtap_results select is((select assigned_barangay_id from public.bsi_profiles where id='a1414141-1414-4414-8414-141414141414'),'profile-a','self profile RPC preserves barangay assignment');
insert into pg_temp.pgtap_results select throws_ok(
  $$update public.bsi_profiles set role='admin' where id='a1414141-1414-4414-8414-141414141414'$$,
  '42501', 'permission denied for table bsi_profiles',
  'BSI cannot directly mutate protected profile fields');

reset role;
select set_config('request.jwt.claim.sub','c1616161-1616-4616-8616-161616161616',true);
set local role authenticated;
insert into pg_temp.pgtap_results select is(
  (select count(*) from storage.objects where bucket_id='profile-avatars' and name in (
    'users/a1414141-1414-4414-8414-141414141414/avatar',
    'users/b1515151-1515-4515-8515-151515151515/avatar'
  )), 2::bigint, 'active Admin can read fixture BSI avatars');

reset role;
set local role anon;
insert into pg_temp.pgtap_results select is((select count(*) from storage.objects where bucket_id='profile-avatars'),0::bigint,'anonymous users cannot read profile avatars');
insert into pg_temp.pgtap_results select throws_ok(
  $$select public.update_own_profile('Anon','000',null)$$,
  '42501', 'permission denied for function update_own_profile',
  'anonymous users cannot update a profile');

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
