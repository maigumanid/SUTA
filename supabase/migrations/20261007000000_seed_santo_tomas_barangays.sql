-- Canonical Santo Tomas, Davao del Norte barangay directory.
-- This migration is intentionally idempotent and additive: existing records
-- are preserved, and a normalized name match prevents duplicate directories
-- when an existing deployment uses a different stable ID.

with official_barangays(id, display_name) as (
  values
    ('santo-tomas-tibal-og', 'Tibal-og'),
    ('santo-tomas-balagunan', 'Balagunan'),
    ('santo-tomas-bobongon', 'Bobongon'),
    ('santo-tomas-casig-ang', 'Casig-ang'),
    ('santo-tomas-esperanza', 'Esperanza'),
    ('santo-tomas-kimamon', 'Kimamon'),
    ('santo-tomas-kinamayan', 'Kinamayan'),
    ('santo-tomas-la-libertad', 'La Libertad'),
    ('santo-tomas-lunga-og', 'Lunga-og'),
    ('santo-tomas-magwawa', 'Magwawa'),
    ('santo-tomas-new-katipunan', 'New Katipunan'),
    ('santo-tomas-new-visayas', 'New Visayas'),
    ('santo-tomas-pantaron', 'Pantaron'),
    ('santo-tomas-salvacion', 'Salvacion'),
    ('santo-tomas-san-jose', 'San Jose'),
    ('santo-tomas-san-miguel', 'San Miguel'),
    ('santo-tomas-san-vicente', 'San Vicente'),
    ('santo-tomas-talomo', 'Talomo'),
    ('santo-tomas-tulalian', 'Tulalian')
)
insert into public.barangays (id, display_name)
select official.id, official.display_name
from official_barangays as official
where not exists (
  select 1
  from public.barangays as existing
  where lower(btrim(existing.display_name)) =
        lower(btrim(official.display_name))
)
on conflict (id) do nothing;

-- These two deployment-bootstrap placeholders are currently referenced, so
-- keep the rows and their foreign-key relationships intact. They are retired
-- only from future assignment choices; existing profiles must be reassigned
-- deliberately by an administrator after this migration is reviewed.
update public.barangays
set active = false
where (id, display_name) in (
  ('barangay-a', 'Barangay A'),
  ('barangay-b', 'Barangay B')
);
