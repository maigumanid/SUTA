# SUTA Supabase backend

This directory contains the version-controlled Supabase backend foundation.
The Expo application remains Firebase-backed until a later migration phase.

## Local validation

The Supabase CLI and a Docker-compatible container runtime are required to run
the full local database validation. Neither is an application runtime
dependency.

```bash
npx supabase start
npx supabase db reset
npx supabase test db
```

Stop the local stack when finished:

```bash
npx supabase stop
```

## Apply to a hosted project

Create an empty Supabase project, then authenticate and link the repository:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

The project reference and database password are entered locally. Do not commit
them. Do not use `db reset --linked` against a project containing data.

The migration creates the private `inspection-evidence` bucket. No Dashboard
bucket creation is required after a successful migration.

## Provision BSI accounts

Create temporary users through Authentication > Users in the Supabase
Dashboard. Then use the SQL Editor to insert their profiles with the UUIDs
shown by Auth:

```sql
insert into public.bsi_profiles (
  id,
  name,
  email,
  contact_number,
  assigned_barangay_id,
  assigned_barangay_name
) values
  ('FIRST_AUTH_USER_UUID', 'Test BSI A', 'test-a@example.invalid', 'test-only', 'barangay-a', 'Barangay A'),
  ('SECOND_AUTH_USER_UUID', 'Test BSI B', 'test-b@example.invalid', 'test-only', 'barangay-b', 'Barangay B');
```

Use temporary passwords only in the Dashboard. Never add passwords, service
role keys, database passwords, or real BSI data to repository files.
