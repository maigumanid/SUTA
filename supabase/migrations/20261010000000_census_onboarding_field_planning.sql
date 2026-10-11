-- Census onboarding foundation for starter place records.
-- Existing manual records remain complete; RLS and role grants are unchanged.

alter table public.places
  drop constraint if exists places_representative_name_check,
  drop constraint if exists places_purok_check;

alter table public.places
  add column contact_number text not null default '',
  add column notes text not null default '',
  add column profile_status text not null default 'complete'
    check (profile_status in ('starter', 'complete')),
  add column source_kind text not null default 'manual'
    check (source_kind in ('manual', 'bulk_import')),
  add column import_batch_id text;

alter table public.places
  add constraint places_import_batch_consistent check (
    (source_kind = 'manual' and import_batch_id is null)
    or
    (source_kind = 'bulk_import' and btrim(coalesce(import_batch_id, '')) <> '')
  );

create index places_profile_status_idx
  on public.places (barangay_id, profile_status, name);

create index places_import_batch_idx
  on public.places (import_batch_id)
  where import_batch_id is not null;

