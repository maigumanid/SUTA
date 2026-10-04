-- Phase 8 refinement: canonical barangays and approved inspection risk rubric.

create table public.barangays (
  id text primary key check (btrim(id) <> ''),
  display_name text not null check (btrim(display_name) <> ''),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.barangays (id, display_name)
select barangay_id, max(barangay_name)
from (
  select assigned_barangay_id as barangay_id,
         assigned_barangay_name as barangay_name
  from public.bsi_profiles
  where assigned_barangay_id is not null
    and assigned_barangay_name is not null
  union all
  select barangay_id, barangay_name
  from public.places
  where barangay_name is not null
) as existing_barangays
where btrim(barangay_id) <> ''
  and btrim(barangay_name) <> ''
group by barangay_id
on conflict (id) do nothing;

alter table public.bsi_profiles
  add constraint bsi_profiles_barangay_directory_fk
  foreign key (assigned_barangay_id)
  references public.barangays (id)
  on update restrict
  on delete restrict;

alter table public.places
  add constraint places_barangay_directory_fk
  foreign key (barangay_id)
  references public.barangays (id)
  on update restrict
  on delete restrict;

create trigger barangays_set_updated_at
before update on public.barangays
for each row execute function private.set_updated_at();

create index barangays_active_display_name_idx
on public.barangays (active, display_name);

create or replace function private.validate_profile_barangay()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  canonical_name text;
begin
  if new.role <> 'bsi' then
    return new;
  end if;

  select display_name into canonical_name
  from public.barangays
  where id = new.assigned_barangay_id
    and active;

  if canonical_name is null then
    raise exception 'The assigned barangay is not active or does not exist.'
      using errcode = '23503';
  end if;

  new.assigned_barangay_name := canonical_name;
  return new;
end;
$$;

revoke all on function private.validate_profile_barangay()
from public, anon, authenticated;

create trigger bsi_profiles_validate_barangay
before insert or update of assigned_barangay_id, assigned_barangay_name, role
on public.bsi_profiles
for each row execute function private.validate_profile_barangay();

alter table public.barangays enable row level security;
revoke all on table public.barangays from anon, authenticated;
grant select on table public.barangays to authenticated;

create policy "Authorized users can read their barangay directory scope"
on public.barangays
for select
to authenticated
using (
  active
  and (
    (select private.is_active_admin())
    or id = (select private.current_barangay_id())
  )
);

alter table public.places
  drop constraint if exists places_risk_level_check;

update public.places
set risk_level = 'Moderate'
where risk_level = 'Medium';

alter table public.places
  alter column risk_level set default 'Unclassified';

alter table public.places
  add constraint places_risk_level_check
  check (risk_level in ('Low', 'Moderate', 'High', 'Unclassified'));

alter table public.inspections
  add column risk_level text not null default 'Unclassified'
    check (risk_level in ('Low', 'Moderate', 'High', 'Unclassified')),
  add column risk_percentage numeric(5, 2),
  add column risk_earned_points integer not null default 0
    check (risk_earned_points >= 0),
  add column risk_maximum_points integer not null default 0
    check (risk_maximum_points >= 0),
  add column risk_critical_failure boolean not null default false,
  add column risk_evaluated_items integer not null default 0
    check (risk_evaluated_items >= 0);

alter table public.inspections
  add constraint inspections_risk_values_consistent check (
    (
      risk_maximum_points = 0
      and risk_earned_points = 0
      and risk_percentage is null
      and risk_level = 'Unclassified'
      and risk_evaluated_items = 0
      and not risk_critical_failure
    )
    or
    (
      risk_maximum_points > 0
      and risk_earned_points <= risk_maximum_points
      and risk_percentage between 0 and 100
      and risk_level <> 'Unclassified'
      and risk_evaluated_items > 0
      and (not risk_critical_failure or risk_level = 'High')
    )
  );

create index inspections_risk_date_idx
on public.inspections (risk_level, inspection_date desc);

create index places_risk_level_idx
on public.places (risk_level);

create or replace function private.calculate_inspection_risk(
  water jsonb,
  sanitation jsonb
)
returns table (
  risk_level text,
  risk_percentage numeric,
  earned_points integer,
  maximum_points integer,
  critical_failure boolean,
  evaluated_items integer
)
language plpgsql
immutable
set search_path = ''
as $$
declare
  source_type text := water ->> 'waterSourceType';
  sanitary_type text := sanitation ->> 'sanitaryFacilityType';
  unsanitary_type text := sanitation ->> 'unsanitaryToiletType';
  earned integer := 0;
  maximum integer := 0;
  evaluated integer := 0;
  critical boolean := false;
  percentage numeric;
begin
  if source_type is not null then
    maximum := maximum + 2;
    evaluated := evaluated + 1;
    if source_type not in ('level_1', 'level_3') then earned := earned + 2; end if;
  end if;

  if water ? 'locatedWithinPremises' then
    maximum := maximum + 1;
    evaluated := evaluated + 1;
    if coalesce((water ->> 'locatedWithinPremises')::boolean, false) = false then
      earned := earned + 1;
    end if;
  end if;

  if water ? 'availableAtLeast12Hours' then
    maximum := maximum + 2;
    evaluated := evaluated + 1;
    if coalesce((water ->> 'availableAtLeast12Hours')::boolean, false) = false then
      earned := earned + 2;
    end if;
  end if;

  if coalesce((water #>> '{microbialTest,recorded}')::boolean, false)
    and water #>> '{microbialTest,eColiResult}' is not null then
    maximum := maximum + 3;
    evaluated := evaluated + 1;
    if (water #>> '{microbialTest,eColiResult}')::integer <> 0 then
      earned := earned + 3;
      critical := true;
    end if;
  end if;

  if coalesce((water #>> '{arsenicTest,conducted}')::boolean, false)
    and water #>> '{arsenicTest,result}' is not null then
    maximum := maximum + 3;
    evaluated := evaluated + 1;
    if (water #>> '{arsenicTest,result}')::integer <> 1 then
      earned := earned + 3;
      critical := true;
    end if;
  end if;

  if sanitary_type is not null or unsanitary_type is not null then
    maximum := maximum + 3;
    evaluated := evaluated + 1;
    if sanitary_type is null then
      earned := earned + 3;
      critical := true;
    end if;
  end if;

  if sanitary_type is not null and sanitation ? 'sharedWithOtherHouseholds' then
    maximum := maximum + 2;
    evaluated := evaluated + 1;
    if (sanitation ->> 'sharedWithOtherHouseholds')::integer <> 0 then
      earned := earned + 2;
    end if;
  end if;

  if maximum = 0 then
    return query select 'Unclassified'::text, null::numeric, 0, 0, false, 0;
    return;
  end if;

  percentage := round((earned::numeric / maximum::numeric) * 100, 2);
  return query select
    case
      when critical then 'High'
      when percentage < 25 then 'Low'
      when percentage < 50 then 'Moderate'
      else 'High'
    end,
    percentage,
    earned,
    maximum,
    critical,
    evaluated;
end;
$$;

revoke all on function private.calculate_inspection_risk(jsonb, jsonb)
from public, anon, authenticated;

create or replace function private.set_inspection_risk()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  calculated record;
begin
  select * into calculated
  from private.calculate_inspection_risk(
    new.safe_water_supply,
    new.sanitation_facility
  );

  new.risk_level := calculated.risk_level;
  new.risk_percentage := calculated.risk_percentage;
  new.risk_earned_points := calculated.earned_points;
  new.risk_maximum_points := calculated.maximum_points;
  new.risk_critical_failure := calculated.critical_failure;
  new.risk_evaluated_items := calculated.evaluated_items;
  return new;
end;
$$;

revoke all on function private.set_inspection_risk()
from public, anon, authenticated;

create trigger inspections_set_risk
before insert or update of safe_water_supply, sanitation_facility
on public.inspections
for each row execute function private.set_inspection_risk();

update public.inspections
set safe_water_supply = safe_water_supply,
    sanitation_facility = sanitation_facility;

with latest as (
  select distinct on (inspection.place_id, inspection.barangay_id)
    inspection.place_id,
    inspection.barangay_id,
    inspection.risk_level
  from public.inspections as inspection
  order by
    inspection.place_id,
    inspection.barangay_id,
    inspection.inspection_date desc,
    inspection.id desc
)
update public.places as place
set risk_level = latest.risk_level
from latest
where latest.place_id = place.id
  and latest.barangay_id = place.barangay_id;

update public.places as place
set risk_level = 'Unclassified'
where not exists (
  select 1
  from public.inspections as inspection
  where inspection.place_id = place.id
    and inspection.barangay_id = place.barangay_id
);

create or replace function private.update_place_risk_from_inspection()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.places
  set risk_level = new.risk_level
  where id = new.place_id
    and barangay_id = new.barangay_id
    and (
      last_inspection_date is null
      or new.inspection_date >= last_inspection_date
    );
  return new;
end;
$$;

revoke all on function private.update_place_risk_from_inspection()
from public, anon, authenticated;

create trigger inspections_update_current_place_risk
after insert or update of risk_level, risk_percentage
on public.inspections
for each row execute function private.update_place_risk_from_inspection();
