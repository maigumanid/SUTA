-- SUTA Supabase backend foundation.
-- The React Native application remains Firebase-backed until a later phase.

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table public.bsi_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  email text not null check (btrim(email) <> ''),
  contact_number text not null check (btrim(contact_number) <> ''),
  assigned_barangay_id text not null check (btrim(assigned_barangay_id) <> ''),
  assigned_barangay_name text not null check (btrim(assigned_barangay_name) <> ''),
  role text not null default 'BSI' check (role = 'BSI'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.places (
  id text primary key check (btrim(id) <> ''),
  barangay_id text not null check (btrim(barangay_id) <> ''),
  barangay_name text,
  created_by_uid uuid not null references public.bsi_profiles (id) on delete restrict,
  updated_by_uid uuid references public.bsi_profiles (id) on delete restrict,
  name text not null check (btrim(name) <> ''),
  representative_name text not null check (btrim(representative_name) <> ''),
  address text not null check (btrim(address) <> ''),
  purok text not null check (btrim(purok) <> ''),
  place_type text not null check (
    place_type in (
      'Household / Residence',
      'Food Establishment',
      'Retail Establishment',
      'School',
      'Public Facility',
      'Church',
      'Other Facility'
    )
  ),
  status text not null default 'Not Inspected' check (
    status in (
      'Compliant',
      'Non-Compliant',
      'For Reinspection',
      'Not Inspected'
    )
  ),
  risk_level text not null default 'Low' check (
    risk_level in ('Low', 'Medium', 'High')
  ),
  last_inspection_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint places_id_barangay_unique unique (id, barangay_id)
);

create table public.inspections (
  id text primary key check (btrim(id) <> ''),
  bsi_uid uuid not null references public.bsi_profiles (id) on delete restrict,
  barangay_id text not null check (btrim(barangay_id) <> ''),
  place_id text not null check (btrim(place_id) <> ''),
  inspection_date timestamptz not null,
  inspection_location jsonb,
  location_capture_status text not null check (
    location_capture_status in (
      'not_attempted',
      'captured',
      'permission_denied',
      'services_disabled',
      'unavailable'
    )
  ),
  location_capture_attempted_at timestamptz,
  result text not null check (
    result in ('compliant', 'non_compliant', 'for_reinspection')
  ),
  findings jsonb not null default '[]'::jsonb check (
    jsonb_typeof(findings) = 'array'
  ),
  safe_water_supply jsonb not null check (
    jsonb_typeof(safe_water_supply) = 'object'
  ),
  sanitation_facility jsonb not null check (
    jsonb_typeof(sanitation_facility) = 'object'
  ),
  remarks text not null default '',
  reinspection_id text,
  reinspection_of_inspection_id text,
  synced_at timestamptz not null default now(),
  constraint inspections_location_object check (
    inspection_location is null
    or jsonb_typeof(inspection_location) = 'object'
  ),
  constraint inspections_findings_exclude_local_uris check (
    not (findings @? '$[*].evidence[*].uri')
  ),
  constraint inspections_reinspection_pair check (
    (reinspection_id is null and reinspection_of_inspection_id is null)
    or
    (reinspection_id is not null and reinspection_of_inspection_id is not null)
  ),
  constraint inspections_not_self_reinspection check (
    reinspection_of_inspection_id is null
    or reinspection_of_inspection_id <> id
  ),
  constraint inspections_id_barangay_unique unique (id, barangay_id),
  constraint inspections_place_barangay_fk foreign key (place_id, barangay_id)
    references public.places (id, barangay_id)
    on update restrict
    on delete restrict,
  constraint inspections_original_barangay_fk foreign key (
    reinspection_of_inspection_id,
    barangay_id
  ) references public.inspections (id, barangay_id)
    on update restrict
    on delete restrict
    deferrable initially deferred
);

create table public.reinspections (
  id text primary key check (btrim(id) <> ''),
  bsi_uid uuid not null references public.bsi_profiles (id) on delete restrict,
  barangay_id text not null check (btrim(barangay_id) <> ''),
  original_inspection_id text not null check (btrim(original_inspection_id) <> ''),
  place_id text not null check (btrim(place_id) <> ''),
  scheduled_date timestamptz not null,
  status text not null check (status in ('pending', 'completed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  completed_inspection_id text,
  synced_at timestamptz,
  constraint reinspections_completion_state check (
    (
      status = 'pending'
      and completed_at is null
      and completed_inspection_id is null
    )
    or
    (
      status = 'completed'
      and completed_at is not null
      and completed_inspection_id is not null
    )
  ),
  constraint reinspections_id_barangay_unique unique (id, barangay_id),
  constraint reinspections_original_unique unique (original_inspection_id),
  constraint reinspections_completed_unique unique (completed_inspection_id),
  constraint reinspections_place_barangay_fk foreign key (place_id, barangay_id)
    references public.places (id, barangay_id)
    on update restrict
    on delete restrict,
  constraint reinspections_original_barangay_fk foreign key (
    original_inspection_id,
    barangay_id
  ) references public.inspections (id, barangay_id)
    on update restrict
    on delete restrict
    deferrable initially deferred,
  constraint reinspections_completed_barangay_fk foreign key (
    completed_inspection_id,
    barangay_id
  ) references public.inspections (id, barangay_id)
    on update restrict
    on delete restrict
    deferrable initially deferred
);

alter table public.inspections
  add constraint inspections_reinspection_barangay_fk foreign key (
    reinspection_id,
    barangay_id
  ) references public.reinspections (id, barangay_id)
    on update restrict
    on delete restrict
    deferrable initially deferred;

create index bsi_profiles_assigned_barangay_idx
  on public.bsi_profiles (assigned_barangay_id);

create index places_barangay_idx
  on public.places (barangay_id);

create index places_barangay_name_idx
  on public.places (barangay_id, name);

create index inspections_barangay_date_idx
  on public.inspections (barangay_id, inspection_date desc);

create index inspections_place_date_idx
  on public.inspections (place_id, inspection_date desc);

create index inspections_bsi_date_idx
  on public.inspections (bsi_uid, inspection_date desc);

create index inspections_original_idx
  on public.inspections (reinspection_of_inspection_id)
  where reinspection_of_inspection_id is not null;

create index reinspections_barangay_status_date_idx
  on public.reinspections (barangay_id, status, scheduled_date);

create index reinspections_place_date_idx
  on public.reinspections (place_id, scheduled_date);

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
    and profile.role = 'BSI'
  limit 1
$$;

revoke all on function private.current_barangay_id() from public, anon, authenticated;
grant execute on function private.current_barangay_id() to authenticated;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = statement_timestamp();
  return new;
end;
$$;

create or replace function private.protect_place_scope()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.barangay_id is distinct from old.barangay_id
    or new.created_by_uid is distinct from old.created_by_uid
    or new.created_at is distinct from old.created_at then
    raise exception 'Place identity and ownership scope are immutable.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function private.protect_inspection_scope()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.bsi_uid is distinct from old.bsi_uid
    or new.barangay_id is distinct from old.barangay_id
    or new.place_id is distinct from old.place_id
    or new.inspection_date is distinct from old.inspection_date
    or new.reinspection_id is distinct from old.reinspection_id
    or new.reinspection_of_inspection_id is distinct from old.reinspection_of_inspection_id then
    raise exception 'Inspection identity, ownership, place, date, and relationship fields are immutable.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function private.protect_reinspection_scope()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.bsi_uid is distinct from old.bsi_uid
    or new.barangay_id is distinct from old.barangay_id
    or new.original_inspection_id is distinct from old.original_inspection_id
    or new.place_id is distinct from old.place_id
    or new.created_at is distinct from old.created_at then
    raise exception 'Reinspection identity, ownership, and source relationships are immutable.'
      using errcode = '42501';
  end if;

  if old.status = 'completed' and new.status <> 'completed' then
    raise exception 'A completed reinspection cannot return to pending.'
      using errcode = '23514';
  end if;

  if old.completed_inspection_id is not null
    and new.completed_inspection_id is distinct from old.completed_inspection_id then
    raise exception 'The completed inspection relationship is immutable once set.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function private.validate_inspection_reinspection_link()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.reinspection_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.reinspections as reinspection
    where reinspection.id = new.reinspection_id
      and reinspection.barangay_id = new.barangay_id
      and reinspection.place_id = new.place_id
      and reinspection.original_inspection_id = new.reinspection_of_inspection_id
  ) then
    raise exception 'The follow-up inspection does not match its reinspection schedule.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function private.validate_reinspection_links()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.inspections as original_inspection
    where original_inspection.id = new.original_inspection_id
      and original_inspection.barangay_id = new.barangay_id
      and original_inspection.place_id = new.place_id
  ) then
    raise exception 'The reinspection source does not match its place and barangay.'
      using errcode = '23514';
  end if;

  if new.completed_inspection_id is not null and not exists (
    select 1
    from public.inspections as completed_inspection
    where completed_inspection.id = new.completed_inspection_id
      and completed_inspection.barangay_id = new.barangay_id
      and completed_inspection.place_id = new.place_id
      and completed_inspection.reinspection_id = new.id
      and completed_inspection.reinspection_of_inspection_id = new.original_inspection_id
  ) then
    raise exception 'The completed inspection does not match its reinspection schedule.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;
revoke all on function private.protect_place_scope() from public, anon, authenticated;
revoke all on function private.protect_inspection_scope() from public, anon, authenticated;
revoke all on function private.protect_reinspection_scope() from public, anon, authenticated;
revoke all on function private.validate_inspection_reinspection_link() from public, anon, authenticated;
revoke all on function private.validate_reinspection_links() from public, anon, authenticated;

create trigger bsi_profiles_set_updated_at
before update on public.bsi_profiles
for each row execute function private.set_updated_at();

create trigger places_protect_scope
before update on public.places
for each row execute function private.protect_place_scope();

create trigger places_set_updated_at
before update on public.places
for each row execute function private.set_updated_at();

create trigger inspections_protect_scope
before update on public.inspections
for each row execute function private.protect_inspection_scope();

create trigger inspections_validate_reinspection_link
before insert or update on public.inspections
for each row execute function private.validate_inspection_reinspection_link();

create trigger reinspections_protect_scope
before update on public.reinspections
for each row execute function private.protect_reinspection_scope();

create trigger reinspections_validate_links
before insert or update on public.reinspections
for each row execute function private.validate_reinspection_links();

alter table public.bsi_profiles enable row level security;
alter table public.places enable row level security;
alter table public.inspections enable row level security;
alter table public.reinspections enable row level security;

revoke all on table public.bsi_profiles from anon, authenticated;
revoke all on table public.places from anon, authenticated;
revoke all on table public.inspections from anon, authenticated;
revoke all on table public.reinspections from anon, authenticated;

grant select on table public.bsi_profiles to authenticated;
grant select, insert, update on table public.places to authenticated;
grant select, insert, update on table public.inspections to authenticated;
grant select, insert, update on table public.reinspections to authenticated;

create policy "BSIs can read their own profile"
on public.bsi_profiles
for select
to authenticated
using (
  (select auth.uid()) is not null
  and id = (select auth.uid())
);

create policy "BSIs can read assigned barangay places"
on public.places
for select
to authenticated
using (
  (select private.current_barangay_id()) is not null
  and barangay_id = (select private.current_barangay_id())
);

create policy "BSIs can create assigned barangay places"
on public.places
for insert
to authenticated
with check (
  (select auth.uid()) is not null
  and (select private.current_barangay_id()) is not null
  and barangay_id = (select private.current_barangay_id())
  and created_by_uid = (select auth.uid())
  and (
    updated_by_uid is null
    or updated_by_uid = (select auth.uid())
  )
);

create policy "BSIs can update assigned barangay places"
on public.places
for update
to authenticated
using (
  (select private.current_barangay_id()) is not null
  and barangay_id = (select private.current_barangay_id())
)
with check (
  (select auth.uid()) is not null
  and (select private.current_barangay_id()) is not null
  and barangay_id = (select private.current_barangay_id())
  and updated_by_uid = (select auth.uid())
);

create policy "BSIs can read assigned barangay inspections"
on public.inspections
for select
to authenticated
using (
  (select private.current_barangay_id()) is not null
  and barangay_id = (select private.current_barangay_id())
);

create policy "BSIs can create their assigned barangay inspections"
on public.inspections
for insert
to authenticated
with check (
  (select auth.uid()) is not null
  and (select private.current_barangay_id()) is not null
  and barangay_id = (select private.current_barangay_id())
  and bsi_uid = (select auth.uid())
);

create policy "BSIs can update their assigned barangay inspections"
on public.inspections
for update
to authenticated
using (
  (select auth.uid()) is not null
  and (select private.current_barangay_id()) is not null
  and barangay_id = (select private.current_barangay_id())
  and bsi_uid = (select auth.uid())
)
with check (
  (select auth.uid()) is not null
  and (select private.current_barangay_id()) is not null
  and barangay_id = (select private.current_barangay_id())
  and bsi_uid = (select auth.uid())
);

create policy "BSIs can read assigned barangay reinspections"
on public.reinspections
for select
to authenticated
using (
  (select private.current_barangay_id()) is not null
  and barangay_id = (select private.current_barangay_id())
);

create policy "BSIs can create their assigned barangay reinspections"
on public.reinspections
for insert
to authenticated
with check (
  (select auth.uid()) is not null
  and (select private.current_barangay_id()) is not null
  and barangay_id = (select private.current_barangay_id())
  and bsi_uid = (select auth.uid())
);

create policy "BSIs can update their assigned barangay reinspections"
on public.reinspections
for update
to authenticated
using (
  (select auth.uid()) is not null
  and (select private.current_barangay_id()) is not null
  and barangay_id = (select private.current_barangay_id())
  and bsi_uid = (select auth.uid())
)
with check (
  (select auth.uid()) is not null
  and (select private.current_barangay_id()) is not null
  and barangay_id = (select private.current_barangay_id())
  and bsi_uid = (select auth.uid())
);

create or replace function public.submit_inspection(
  p_id text,
  p_place_id text,
  p_inspection_date timestamptz,
  p_location_capture_status text,
  p_result text,
  p_findings jsonb,
  p_safe_water_supply jsonb,
  p_sanitation_facility jsonb,
  p_remarks text,
  p_inspection_location jsonb default null,
  p_location_capture_attempted_at timestamptz default null,
  p_reinspection_id text default null,
  p_reinspection_of_inspection_id text default null
)
returns public.inspections
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller_uid uuid := auth.uid();
  caller_barangay_id text := private.current_barangay_id();
  place_status text;
  saved_inspection public.inspections;
begin
  if caller_uid is null or caller_barangay_id is null then
    raise exception 'An authenticated BSI profile is required.'
      using errcode = '42501';
  end if;

  place_status := case p_result
    when 'compliant' then 'Compliant'
    when 'non_compliant' then 'Non-Compliant'
    when 'for_reinspection' then 'For Reinspection'
    else null
  end;

  if place_status is null then
    raise exception 'Unsupported inspection result.'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.places as place
    where place.id = p_place_id
      and place.barangay_id = caller_barangay_id
  ) then
    raise exception 'The place is not available in the assigned barangay.'
      using errcode = '42501';
  end if;

  insert into public.inspections (
    id,
    bsi_uid,
    barangay_id,
    place_id,
    inspection_date,
    inspection_location,
    location_capture_status,
    location_capture_attempted_at,
    result,
    findings,
    safe_water_supply,
    sanitation_facility,
    remarks,
    reinspection_id,
    reinspection_of_inspection_id,
    synced_at
  ) values (
    p_id,
    caller_uid,
    caller_barangay_id,
    p_place_id,
    p_inspection_date,
    p_inspection_location,
    p_location_capture_status,
    p_location_capture_attempted_at,
    p_result,
    p_findings,
    p_safe_water_supply,
    p_sanitation_facility,
    p_remarks,
    p_reinspection_id,
    p_reinspection_of_inspection_id,
    statement_timestamp()
  )
  on conflict (id) do update set
    inspection_location = excluded.inspection_location,
    location_capture_status = excluded.location_capture_status,
    location_capture_attempted_at = excluded.location_capture_attempted_at,
    result = excluded.result,
    findings = excluded.findings,
    safe_water_supply = excluded.safe_water_supply,
    sanitation_facility = excluded.sanitation_facility,
    remarks = excluded.remarks,
    synced_at = statement_timestamp()
  where inspections.bsi_uid = excluded.bsi_uid
    and inspections.barangay_id = excluded.barangay_id
    and inspections.place_id = excluded.place_id
    and inspections.inspection_date = excluded.inspection_date
    and inspections.reinspection_id is not distinct from excluded.reinspection_id
    and inspections.reinspection_of_inspection_id is not distinct from excluded.reinspection_of_inspection_id
  returning * into saved_inspection;

  if saved_inspection.id is null then
    raise exception 'The inspection ID is already associated with different immutable fields.'
      using errcode = '23505';
  end if;

  update public.places
  set status = place_status,
      last_inspection_date = p_inspection_date,
      updated_by_uid = caller_uid
  where id = p_place_id
    and barangay_id = caller_barangay_id
    and (
      last_inspection_date is null
      or p_inspection_date >= last_inspection_date
    );

  return saved_inspection;
end;
$$;

revoke all on function public.submit_inspection(
  text,
  text,
  timestamptz,
  text,
  text,
  jsonb,
  jsonb,
  jsonb,
  text,
  jsonb,
  timestamptz,
  text,
  text
) from public, anon;

grant execute on function public.submit_inspection(
  text,
  text,
  timestamptz,
  text,
  text,
  jsonb,
  jsonb,
  jsonb,
  text,
  jsonb,
  timestamptz,
  text,
  text
) to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'inspection-evidence',
  'inspection-evidence',
  false,
  10 * 1024 * 1024,
  array['image/*']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Assigned barangay BSIs can read inspection evidence"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'inspection-evidence'
  and (select private.current_barangay_id()) is not null
  and array_length(storage.foldername(name), 1) = 7
  and (storage.foldername(name))[1] = 'barangays'
  and (storage.foldername(name))[2] = (select private.current_barangay_id())
  and (storage.foldername(name))[3] = 'inspectors'
  and (storage.foldername(name))[5] = 'inspections'
  and (storage.foldername(name))[7] = 'evidence'
);

create policy "BSIs can upload owned inspection evidence"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'inspection-evidence'
  and (select auth.uid()) is not null
  and (select private.current_barangay_id()) is not null
  and array_length(storage.foldername(name), 1) = 7
  and (storage.foldername(name))[1] = 'barangays'
  and (storage.foldername(name))[2] = (select private.current_barangay_id())
  and (storage.foldername(name))[3] = 'inspectors'
  and (storage.foldername(name))[4] = (select auth.uid())::text
  and (storage.foldername(name))[5] = 'inspections'
  and btrim((storage.foldername(name))[6]) <> ''
  and (storage.foldername(name))[7] = 'evidence'
  and btrim(storage.filename(name)) <> ''
);

create policy "BSIs can update owned inspection evidence"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'inspection-evidence'
  and (select auth.uid()) is not null
  and owner_id = (select auth.uid())::text
  and (select private.current_barangay_id()) is not null
  and array_length(storage.foldername(name), 1) = 7
  and (storage.foldername(name))[1] = 'barangays'
  and (storage.foldername(name))[2] = (select private.current_barangay_id())
  and (storage.foldername(name))[3] = 'inspectors'
  and (storage.foldername(name))[4] = (select auth.uid())::text
  and (storage.foldername(name))[5] = 'inspections'
  and (storage.foldername(name))[7] = 'evidence'
)
with check (
  bucket_id = 'inspection-evidence'
  and (select auth.uid()) is not null
  and owner_id = (select auth.uid())::text
  and (select private.current_barangay_id()) is not null
  and array_length(storage.foldername(name), 1) = 7
  and (storage.foldername(name))[1] = 'barangays'
  and (storage.foldername(name))[2] = (select private.current_barangay_id())
  and (storage.foldername(name))[3] = 'inspectors'
  and (storage.foldername(name))[4] = (select auth.uid())::text
  and (storage.foldername(name))[5] = 'inspections'
  and btrim((storage.foldername(name))[6]) <> ''
  and (storage.foldername(name))[7] = 'evidence'
  and btrim(storage.filename(name)) <> ''
);
