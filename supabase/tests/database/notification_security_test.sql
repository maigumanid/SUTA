begin;

create extension if not exists pgtap with schema extensions;
create temp table pgtap_results (tap_output text not null) on commit drop;
grant insert, select on table pg_temp.pgtap_results to authenticated, anon;
select plan(9);

insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','a1010101-1010-4010-8010-101010101010','authenticated','authenticated','phase10-a@example.invalid','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','b2020202-2020-4020-8020-202020202020','authenticated','authenticated','phase10-b@example.invalid','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','c3030303-3030-4030-8030-303030303030','authenticated','authenticated','phase10-admin@example.invalid','',now(),'{}','{}',now(),now());
insert into public.barangays(id,display_name) values ('phase10-a','Phase 10 A'),('phase10-b','Phase 10 B');
insert into public.bsi_profiles(id,name,email,contact_number,assigned_barangay_id,assigned_barangay_name,role,active,jurisdiction_name) values
('a1010101-1010-4010-8010-101010101010','Phase 10 A','phase10-a@example.invalid','test','phase10-a','Phase 10 A','bsi',true,null),
('b2020202-2020-4020-8020-202020202020','Phase 10 B','phase10-b@example.invalid','test','phase10-b','Phase 10 B','bsi',true,null),
('c3030303-3030-4030-8030-303030303030','Phase 10 Admin','phase10-admin@example.invalid','test',null,null,'admin',true,'Test Municipality');
insert into public.push_tokens(user_id,expo_push_token,platform) values
('a1010101-1010-4010-8010-101010101010','ExponentPushToken[phase10a]','android'),
('b2020202-2020-4020-8020-202020202020','ExponentPushToken[phase10b]','android');
insert into public.notifications(id,recipient_user_id,notification_type,title,body,entity_type,entity_id,route_kind,route_entity_id,dedupe_key) values
('10101010-1010-4010-8010-101010101010','a1010101-1010-4010-8010-101010101010','reinspection_due_soon','A','A','reinspection','a','bsi_reinspection','a','phase10-a'),
('20202020-2020-4020-8020-202020202020','b2020202-2020-4020-8020-202020202020','reinspection_overdue','B','B','reinspection','b','bsi_reinspection','b','phase10-b'),
('30303030-3030-4030-8030-303030303030','c3030303-3030-4030-8030-303030303030','high_risk_unresolved','Admin','Admin','place','c','admin_inspection','c','phase10-admin');

select set_config('request.jwt.claims','{"sub":"a1010101-1010-4010-8010-101010101010","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','a1010101-1010-4010-8010-101010101010',true);
set local role authenticated;
insert into pg_temp.pgtap_results select is((select count(*) from public.notifications where id in ('10101010-1010-4010-8010-101010101010','20202020-2020-4020-8020-202020202020')),1::bigint,'BSI reads only its own fixture notification');
insert into pg_temp.pgtap_results select is((select count(*) from public.notifications where id='20202020-2020-4020-8020-202020202020'),0::bigint,'BSI cannot read another BSI notification');
select public.mark_notification_read('10101010-1010-4010-8010-101010101010');
select public.mark_notification_read('20202020-2020-4020-8020-202020202020');
reset role;
insert into pg_temp.pgtap_results select ok((select read_at is not null from public.notifications where id='10101010-1010-4010-8010-101010101010'),'BSI can mark its own alert read');
insert into pg_temp.pgtap_results select ok((select read_at is null from public.notifications where id='20202020-2020-4020-8020-202020202020'),'BSI cannot mark another user notification read');

select set_config('request.jwt.claim.sub','c3030303-3030-4030-8030-303030303030',true);
set local role authenticated;
insert into pg_temp.pgtap_results select is((select count(*) from public.notifications where id in ('10101010-1010-4010-8010-101010101010','30303030-3030-4030-8030-303030303030')),1::bigint,'Admin inbox is recipient-scoped and does not expose BSI notifications');
insert into pg_temp.pgtap_results select is((select count(*) from public.push_tokens where expo_push_token in ('ExponentPushToken[phase10a]','ExponentPushToken[phase10b]')),0::bigint,'Admin cannot browse BSI push tokens');
insert into pg_temp.pgtap_results select throws_ok(
  $$select public.register_push_token('ExponentPushToken[phase10admin]','android')$$,
  '42501',
  'permission denied for function register_push_token',
  'remote push token registration is retired'
);

reset role;
set local role anon;
insert into pg_temp.pgtap_results select throws_ok('select * from public.notifications','42501','permission denied for table notifications','anonymous notification access is denied');
insert into pg_temp.pgtap_results select throws_ok('select * from public.push_tokens','42501','permission denied for table push_tokens','anonymous push-token access is denied');

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
