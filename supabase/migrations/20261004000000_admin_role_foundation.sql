-- Phase 8: municipal/city sanitation administrator foundation.

alter table public.bsi_profiles
  drop constraint if exists bsi_profiles_role_check;

alter table public.bsi_profiles
  alter column assigned_barangay_id drop not null,
  alter column assigned_barangay_name drop not null;

update public.bsi_profiles
set role = 'bsi'
where role = 'BSI';

alter table public.bsi_profiles
  alter column role set default 'bsi',
  add column active boolean not null default true,
  add column must_change_password boolean not null default false,
  add column jurisdiction_name text;

alter table public.bsi_profiles
  add constraint bsi_profiles_role_check check (role in ('bsi', 'admin')),
  add constraint bsi_profiles_role_scope_check check (
    (
      role = 'bsi'
      and assigned_barangay_id is not null
      and btrim(assigned_barangay_id) <> ''
      and assigned_barangay_name is not null
      and btrim(assigned_barangay_name) <> ''
    )
    or
    (
      role = 'admin'
      and assigned_barangay_id is null
      and assigned_barangay_name is null
    )
  );

create index bsi_profiles_role_active_idx
  on public.bsi_profiles (role, active);

create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  admin_user_id uuid not null references public.bsi_profiles (id) on delete restrict,
  action text not null check (
    action in (
      'bsi_created',
      'barangay_reassigned',
      'account_deactivated',
      'account_reactivated',
      'password_reset_initiated'
    )
  ),
  target_bsi_user_id uuid not null references public.bsi_profiles (id) on delete restrict,
  before_values jsonb not null default '{}'::jsonb check (
    jsonb_typeof(before_values) = 'object'
  ),
  after_values jsonb not null default '{}'::jsonb check (
    jsonb_typeof(after_values) = 'object'
  ),
  created_at timestamptz not null default now()
);

create index admin_audit_log_admin_date_idx
  on public.admin_audit_log (admin_user_id, created_at desc);

create index admin_audit_log_target_date_idx
  on public.admin_audit_log (target_bsi_user_id, created_at desc);

create or replace function private.current_barangay_id()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select profile.assigned_barangay_id
  from public.bsi_profiles as profile
  where profile.id = (select auth.uid())
    and profile.role = 'bsi'
    and profile.active
    and not profile.must_change_password
  limit 1
$$;

create or replace function private.is_active_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.bsi_profiles as profile
    where profile.id = (select auth.uid())
      and profile.role = 'admin'
      and profile.active
  )
$$;

revoke all on function private.current_barangay_id() from public, anon, authenticated;
grant execute on function private.current_barangay_id() to authenticated;
revoke all on function private.is_active_admin() from public, anon, authenticated;
grant execute on function private.is_active_admin() to authenticated;

alter table public.admin_audit_log enable row level security;

revoke all on table public.admin_audit_log from anon, authenticated;
grant select on table public.admin_audit_log to authenticated;

create policy "Active admins can read all profiles"
on public.bsi_profiles
for select
to authenticated
using ((select private.is_active_admin()));

create policy "Active admins can read all places"
on public.places
for select
to authenticated
using ((select private.is_active_admin()));

create policy "Active admins can read all inspections"
on public.inspections
for select
to authenticated
using ((select private.is_active_admin()));

create policy "Active admins can read all reinspections"
on public.reinspections
for select
to authenticated
using ((select private.is_active_admin()));

create policy "Active admins can read audit events"
on public.admin_audit_log
for select
to authenticated
using ((select private.is_active_admin()));

create policy "Active admins can read inspection evidence"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'inspection-evidence'
  and (select private.is_active_admin())
);

create or replace function public.admin_create_bsi_profile(
  p_admin_user_id uuid,
  p_target_user_id uuid,
  p_name text,
  p_email text,
  p_contact_number text,
  p_assigned_barangay_id text,
  p_assigned_barangay_name text
)
returns public.bsi_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_profile public.bsi_profiles;
begin
  if not exists (
    select 1
    from public.bsi_profiles
    where id = p_admin_user_id
      and role = 'admin'
      and active
  ) then
    raise exception 'An active administrator is required.' using errcode = '42501';
  end if;

  insert into public.bsi_profiles (
    id,
    name,
    email,
    contact_number,
    assigned_barangay_id,
    assigned_barangay_name,
    role,
    active,
    must_change_password
  ) values (
    p_target_user_id,
    btrim(p_name),
    lower(btrim(p_email)),
    btrim(p_contact_number),
    btrim(p_assigned_barangay_id),
    btrim(p_assigned_barangay_name),
    'bsi',
    true,
    true
  )
  returning * into created_profile;

  insert into public.admin_audit_log (
    admin_user_id,
    action,
    target_bsi_user_id,
    after_values
  ) values (
    p_admin_user_id,
    'bsi_created',
    p_target_user_id,
    jsonb_build_object(
      'name', created_profile.name,
      'email', created_profile.email,
      'assigned_barangay_id', created_profile.assigned_barangay_id,
      'assigned_barangay_name', created_profile.assigned_barangay_name,
      'active', created_profile.active
    )
  );

  return created_profile;
end;
$$;

create or replace function public.admin_update_bsi_profile(
  p_admin_user_id uuid,
  p_target_user_id uuid,
  p_action text,
  p_assigned_barangay_id text default null,
  p_assigned_barangay_name text default null
)
returns public.bsi_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  before_profile public.bsi_profiles;
  updated_profile public.bsi_profiles;
  audit_action text;
begin
  if not exists (
    select 1
    from public.bsi_profiles
    where id = p_admin_user_id
      and role = 'admin'
      and active
  ) then
    raise exception 'An active administrator is required.' using errcode = '42501';
  end if;

  select * into before_profile
  from public.bsi_profiles
  where id = p_target_user_id
    and role = 'bsi'
  for update;

  if before_profile.id is null then
    raise exception 'The target BSI profile was not found.' using errcode = 'P0002';
  end if;

  case p_action
    when 'reassign' then
      if btrim(coalesce(p_assigned_barangay_id, '')) = ''
        or btrim(coalesce(p_assigned_barangay_name, '')) = '' then
        raise exception 'Barangay ID and name are required.' using errcode = '23514';
      end if;
      update public.bsi_profiles
      set assigned_barangay_id = btrim(p_assigned_barangay_id),
          assigned_barangay_name = btrim(p_assigned_barangay_name)
      where id = p_target_user_id
      returning * into updated_profile;
      audit_action := 'barangay_reassigned';
    when 'deactivate' then
      update public.bsi_profiles
      set active = false
      where id = p_target_user_id
      returning * into updated_profile;
      audit_action := 'account_deactivated';
    when 'reactivate' then
      update public.bsi_profiles
      set active = true
      where id = p_target_user_id
      returning * into updated_profile;
      audit_action := 'account_reactivated';
    when 'password_reset' then
      update public.bsi_profiles
      set must_change_password = true
      where id = p_target_user_id
      returning * into updated_profile;
      audit_action := 'password_reset_initiated';
    else
      raise exception 'Unsupported administrator action.' using errcode = '22023';
  end case;

  insert into public.admin_audit_log (
    admin_user_id,
    action,
    target_bsi_user_id,
    before_values,
    after_values
  ) values (
    p_admin_user_id,
    audit_action,
    p_target_user_id,
    to_jsonb(before_profile) - 'updated_at',
    to_jsonb(updated_profile) - 'updated_at'
  );

  return updated_profile;
end;
$$;

create or replace function public.complete_password_change(p_user_id uuid)
returns public.bsi_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_profile public.bsi_profiles;
begin
  update public.bsi_profiles
  set must_change_password = false
  where id = p_user_id
    and active
  returning * into updated_profile;

  if updated_profile.id is null then
    raise exception 'An active authenticated profile is required.' using errcode = '42501';
  end if;

  return updated_profile;
end;
$$;

revoke all on function public.admin_create_bsi_profile(
  uuid, uuid, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.admin_create_bsi_profile(
  uuid, uuid, text, text, text, text, text
) to service_role;

revoke all on function public.admin_update_bsi_profile(
  uuid, uuid, text, text, text
) from public, anon, authenticated;
grant execute on function public.admin_update_bsi_profile(
  uuid, uuid, text, text, text
) to service_role;

revoke all on function public.complete_password_change(uuid)
  from public, anon, authenticated;
grant execute on function public.complete_password_change(uuid)
  to service_role;
