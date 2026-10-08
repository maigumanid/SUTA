-- Phase 10A: private notification inbox, device tokens, delivery audit, and daily worker hook.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.bsi_profiles (id) on delete cascade,
  expo_push_token text not null unique check (expo_push_token ~ '^(ExponentPushToken|ExpoPushToken)\[[^]]+\]$'),
  platform text not null check (platform in ('android', 'ios')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index push_tokens_user_active_idx on public.push_tokens (user_id, active);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.bsi_profiles (id) on delete cascade,
  notification_type text not null check (notification_type in (
    'reinspection_due_soon', 'reinspection_overdue', 'high_risk_unresolved',
    'new_reinspection_workload', 'barangay_reassignment'
  )),
  title text not null check (btrim(title) <> ''),
  body text not null check (btrim(body) <> ''),
  entity_type text check (entity_type in ('place', 'inspection', 'reinspection', 'profile')),
  entity_id text,
  route_kind text not null check (route_kind in (
    'bsi_place', 'bsi_reinspection', 'admin_inspection', 'admin_bsi', 'profile'
  )),
  route_entity_id text,
  dedupe_key text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (recipient_user_id, dedupe_key)
);

create index notifications_recipient_date_idx on public.notifications (recipient_user_id, created_at desc);
create index notifications_unread_idx on public.notifications (recipient_user_id, created_at desc) where read_at is null;

create table public.notification_log (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications (id) on delete cascade,
  recipient_user_id uuid not null references public.bsi_profiles (id) on delete cascade,
  notification_type text not null,
  dedupe_key text not null,
  delivery_status text not null default 'queued' check (delivery_status in (
    'queued', 'sent', 'delivered', 'partial', 'failed', 'no_token'
  )),
  provider_tickets jsonb not null default '[]'::jsonb check (jsonb_typeof(provider_tickets) = 'array'),
  error_summary text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (notification_id)
);

create index notification_log_status_date_idx on public.notification_log (delivery_status, created_at);

alter table public.push_tokens enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_log enable row level security;

revoke all on table public.push_tokens, public.notifications, public.notification_log from anon, authenticated;
grant select on table public.push_tokens, public.notifications to authenticated;

create policy "Users can read their own push tokens" on public.push_tokens
for select to authenticated using (
  user_id = (select auth.uid())
  and exists (select 1 from public.bsi_profiles p where p.id = (select auth.uid()) and p.active)
);

create policy "Users can read their own notifications" on public.notifications
for select to authenticated using (
  recipient_user_id = (select auth.uid())
  and exists (select 1 from public.bsi_profiles p where p.id = (select auth.uid()) and p.active)
);

create or replace function public.register_push_token(p_expo_push_token text, p_platform text)
returns public.push_tokens
language plpgsql security definer set search_path = ''
as $$
declare token public.push_tokens;
begin
  if (select auth.uid()) is null then raise exception using errcode = '42501', message = 'Authentication is required.'; end if;
  if p_expo_push_token !~ '^(ExponentPushToken|ExpoPushToken)\[[^]]+\]$' or p_platform not in ('android', 'ios') then
    raise exception using errcode = '22023', message = 'The push token or platform is invalid.';
  end if;
  if not exists (select 1 from public.bsi_profiles p where p.id = (select auth.uid()) and p.active and not p.must_change_password) then
    raise exception using errcode = '42501', message = 'The account is not permitted to register notifications.';
  end if;
  insert into public.push_tokens (user_id, expo_push_token, platform)
  values ((select auth.uid()), p_expo_push_token, p_platform)
  on conflict (expo_push_token) do update set
    user_id = excluded.user_id, platform = excluded.platform, active = true,
    last_seen_at = now(), updated_at = now()
  returning * into token;
  return token;
end $$;

create or replace function public.deactivate_push_token(p_expo_push_token text)
returns void language sql security definer set search_path = ''
as $$ update public.push_tokens set active = false, updated_at = now()
  where user_id = (select auth.uid()) and expo_push_token = p_expo_push_token $$;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns void language sql security definer set search_path = ''
as $$ update public.notifications set read_at = coalesce(read_at, now())
  where id = p_notification_id and recipient_user_id = (select auth.uid()) $$;

create or replace function public.mark_all_notifications_read()
returns void language sql security definer set search_path = ''
as $$ update public.notifications set read_at = now()
  where recipient_user_id = (select auth.uid()) and read_at is null $$;

revoke all on function public.register_push_token(text, text), public.deactivate_push_token(text),
  public.mark_notification_read(uuid), public.mark_all_notifications_read() from public, anon;
grant execute on function public.register_push_token(text, text), public.deactivate_push_token(text),
  public.mark_notification_read(uuid), public.mark_all_notifications_read() to authenticated;

create or replace function private.queue_notification(
  recipient uuid, kind text, heading text, message text, object_type text,
  object_id text, destination text, destination_id text, dedupe text
) returns void language plpgsql security definer set search_path = '' as $$
declare inbox_id uuid;
begin
  insert into public.notifications (
    recipient_user_id, notification_type, title, body, entity_type, entity_id,
    route_kind, route_entity_id, dedupe_key
  ) values (recipient, kind, heading, message, object_type, object_id, destination, destination_id, dedupe)
  on conflict (recipient_user_id, dedupe_key) do nothing returning id into inbox_id;
  if inbox_id is not null then
    insert into public.notification_log (notification_id, recipient_user_id, notification_type, dedupe_key)
    values (inbox_id, recipient, kind, dedupe);
  end if;
exception when others then
  raise warning 'Unable to queue notification: %', sqlerrm;
end $$;
revoke all on function private.queue_notification(uuid,text,text,text,text,text,text,text,text) from public, anon, authenticated;

create or replace function private.queue_new_reinspection_notification()
returns trigger language plpgsql security definer set search_path = '' as $$
declare place_name text;
begin
  select p.name into place_name from public.places p where p.id = new.place_id;
  perform private.queue_notification(new.bsi_uid, 'new_reinspection_workload',
    'New Reinspection Workload', coalesce(place_name, 'A place') || ' requires a reinspection.',
    'reinspection', new.id, 'bsi_reinspection', new.id, 'new-reinspection:' || new.id);
  begin perform private.invoke_notification_worker('dispatch');
  exception when others then raise warning 'Unable to dispatch queued notification: %', sqlerrm; end;
  return new;
end $$;

create trigger reinspections_queue_notification after insert on public.reinspections
for each row execute function private.queue_new_reinspection_notification();

create or replace function private.queue_barangay_reassignment_notification()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'bsi' and new.assigned_barangay_id is distinct from old.assigned_barangay_id then
    perform private.queue_notification(new.id, 'barangay_reassignment',
      'Barangay Assignment Updated', 'Your assigned barangay has been changed to ' || coalesce(new.assigned_barangay_name, 'a new barangay') || '.',
      'profile', new.id::text, 'profile', null,
      'barangay-reassignment:' || new.id::text || ':' || coalesce(new.assigned_barangay_id, 'none') || ':' || extract(epoch from new.updated_at)::text);
    begin perform private.invoke_notification_worker('dispatch');
    exception when others then raise warning 'Unable to dispatch queued notification: %', sqlerrm; end;
  end if;
  return new;
end $$;

create trigger bsi_profiles_queue_reassignment_notification after update of assigned_barangay_id on public.bsi_profiles
for each row execute function private.queue_barangay_reassignment_notification();

create or replace function private.invoke_notification_worker(worker_mode text default 'scheduled')
returns void language plpgsql security definer set search_path = '' as $$
declare worker_url text; worker_secret text;
begin
  select decrypted_secret into worker_url from vault.decrypted_secrets where name = 'suta_notification_worker_url' order by created_at desc limit 1;
  select decrypted_secret into worker_secret from vault.decrypted_secrets where name = 'suta_notification_internal_secret' order by created_at desc limit 1;
  if worker_url is null or worker_secret is null then return; end if;
  perform net.http_post(url := worker_url, headers := jsonb_build_object('Content-Type','application/json','x-suta-notification-secret',worker_secret), body := jsonb_build_object('mode', worker_mode));
end $$;
revoke all on function private.invoke_notification_worker(text) from public, anon, authenticated;

select cron.schedule('suta-daily-operational-notifications', '0 0 * * *', $$select private.invoke_notification_worker('scheduled');$$);
