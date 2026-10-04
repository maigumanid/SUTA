# Phase 8 admin deployment

The mobile app uses only the public Supabase URL and publishable key. Never put
a secret/service-role key, database password, personal access token, or user
password in the Expo environment or this repository.

## Deploy

From a linked development project:

```powershell
npx supabase db push
npx supabase functions deploy admin-manage-bsi
npx supabase functions deploy complete-password-change
```

Migration `20261005000000_barangays_and_risk_classification.sql` builds the
canonical barangay directory from reliable barangay IDs and names already in
profiles and places. Review the directory after the push:

```sql
select id, display_name, active
from public.barangays
order by display_name;
```

If the deployment needs an additional real barangay that is not represented in
existing data, add its approved ID and display name in SQL Editor before an
administrator assigns it. Do not use placeholder names in a live project.

```sql
insert into public.barangays (id, display_name)
values ('<APPROVED-STABLE-ID>', '<APPROVED-DISPLAY-NAME>');
```

The migration also stores the approved weighted risk result on each inspection
and updates the current place risk only when that inspection is not older than
the place's latest inspection date.

The function reads the platform-provided `SUPABASE_URL` and
`SUPABASE_SECRET_KEY` (with the legacy platform-provided
`SUPABASE_SERVICE_ROLE_KEY` as a compatibility fallback). Do not create an
`EXPO_PUBLIC_*` secret for it.

In Supabase Dashboard, disable public email signup under Authentication settings.
Admin-created users still use the server-side Admin API.

## Bootstrap the first administrator

1. In Authentication > Users, create the authorized administrator manually.
2. Copy that user's UUID. Do not put their password in SQL or source control.
3. In SQL Editor, insert the matching profile, substituting the UUID, identity
   details, and deployment jurisdiction:

```sql
insert into public.bsi_profiles (
  id,
  name,
  email,
  contact_number,
  assigned_barangay_id,
  assigned_barangay_name,
  role,
  active,
  must_change_password,
  jurisdiction_name
) values (
  '<AUTH-USER-UUID>'::uuid,
  '<ADMIN-NAME>',
  '<ADMIN-EMAIL>',
  '<CONTACT-NUMBER>',
  null,
  null,
  'admin',
  true,
  false,
  '<MUNICIPALITY-OR-CITY>'
);
```

Admin users are intentionally not creatable from the mobile client. Additional
admins require the same controlled project-owner process.

## Operational notes

- A BSI is created with an administrator-supplied temporary password and must
  replace it at first login. Communicate it through an approved private channel.
- Deactivation marks the profile inactive and bans the Auth user. Historical
  inspection ownership remains unchanged.
- Barangay reassignment changes only the current profile scope. Historical rows
  retain their original BSI and barangay ownership.
- Admin account-management needs connectivity. Existing BSI inspection storage
  and synchronization remain offline-first.
