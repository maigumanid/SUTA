# SUTA development-data recreation

This directory documents the development-data handoff from Firebase to
Supabase. It does not contain credentials or an export of either backend.

## Verified repository inventory

The repository contains the Firebase collection contracts for:

- `bsiProfiles/{firebaseUid}`
- `places/{placeId}`
- `inspections/{inspectionId}`
- `reinspections/{reinspectionId}`
- Storage objects under
  `barangays/{barangayId}/inspectors/{firebaseUid}/inspections/{inspectionId}/evidence/{evidenceId}`

It does not contain a Firebase Auth export, Firestore export, Storage export,
seed dataset, fixture dataset, or hardcoded development credentials. Local
inspection and reinspection records live in device AsyncStorage and local
evidence images live in the Expo document directory; neither is available in
the repository.

The temporary Supabase verification users are test identities only. Do not
map Firebase records to them unless they are deliberately retained as the
replacement development accounts.

## Recommended strategy

Recreate the small development dataset in Supabase instead of building a
production-grade Firebase migration. Create only the BSI accounts and sample
records that are still useful. Preserve existing text IDs only when a real
Firebase record is deliberately copied.

If Firebase records later prove valuable, first export them outside the
repository and complete `auth-uid-map.example.csv`. Do not commit exports,
passwords, tokens, service-role keys, database passwords, or the completed UID
map if it contains real account information.

## Authentication and UID mapping

Firebase passwords cannot be extracted. For every BSI account that should
survive conceptually:

1. Create a Supabase Auth user in the hosted Dashboard with a temporary
   password.
2. Require the user to change that password through the eventual supported
   account flow.
3. Record the old Firebase UID and new Supabase UUID in a private copy of
   `auth-uid-map.example.csv`.
4. Use the Supabase UUID for `bsi_profiles.id`, `places.created_by_uid`,
   `places.updated_by_uid`, `inspections.bsi_uid`, and
   `reinspections.bsi_uid`.

Never substitute a Firebase UID into a UUID column.

## Safe recreation order

Use the Supabase Dashboard for Auth users. Use the SQL Editor for profile and
historical data recreation because mobile clients are intentionally forbidden
from creating BSI profiles. Review all values before executing them.

### 1. Create BSI profiles

Run only after the matching Auth users exist:

```sql
begin;

insert into public.bsi_profiles (
  id,
  name,
  email,
  contact_number,
  assigned_barangay_id,
  assigned_barangay_name,
  role
) values (
  '<SUPABASE_AUTH_UUID>'::uuid,
  '<BSI_NAME>',
  '<BSI_EMAIL>',
  '<CONTACT_NUMBER>',
  '<BARANGAY_ID>',
  '<BARANGAY_NAME>',
  'BSI'
);

commit;
```

Replace every placeholder before running. Do not put passwords in SQL.

### 2. Recreate places

Preserve a real Firebase place document ID as `id`. Remap creator and updater
UIDs through the private mapping file.

```sql
insert into public.places (
  id,
  barangay_id,
  barangay_name,
  created_by_uid,
  updated_by_uid,
  name,
  representative_name,
  address,
  purok,
  place_type,
  status,
  risk_level,
  last_inspection_date,
  created_at,
  updated_at
) values (
  '<FIREBASE_PLACE_ID>',
  '<BARANGAY_ID>',
  '<BARANGAY_NAME>',
  '<CREATOR_SUPABASE_UUID>'::uuid,
  '<UPDATER_SUPABASE_UUID>'::uuid,
  '<PLACE_NAME>',
  '<REPRESENTATIVE_NAME>',
  '<ADDRESS>',
  '<PUROK>',
  '<VALID_PLACE_TYPE>',
  '<VALID_PLACE_STATUS>',
  '<VALID_RISK_LEVEL>',
  '<LAST_INSPECTION_TIMESTAMP>'::timestamptz,
  '<CREATED_TIMESTAMP>'::timestamptz,
  '<UPDATED_TIMESTAMP>'::timestamptz
);
```

Use `null` for a genuinely absent updater or last inspection date. Do not use
placeholder text as real data.

### 3. Import historical initial inspections directly

Do not use `submit_inspection` for historical bulk recreation. The RPC is for
live idempotent submission and updates current place state. Direct historical
inserts avoid an older record overwriting or temporarily changing the current
place status.

Insert initial inspections before reinspection schedules. Preserve the
Firebase inspection ID, place ID, timestamp, result, checklist JSON, location,
and remarks. Remap `bsi_uid` to the Supabase Auth UUID.

The `findings` JSON must not contain `uri` keys. Keep evidence entries only
when the corresponding object is available in Supabase Storage, and represent
it with backend-safe metadata such as `id`, `source`, `createdAt`, `fileName`,
`mimeType`, and `storagePath`.

```sql
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
  '<FIREBASE_INSPECTION_ID>',
  '<BSI_SUPABASE_UUID>'::uuid,
  '<BARANGAY_ID>',
  '<FIREBASE_PLACE_ID>',
  '<INSPECTION_TIMESTAMP>'::timestamptz,
  '<LOCATION_JSON>'::jsonb,
  '<LOCATION_CAPTURE_STATUS>',
  '<LOCATION_ATTEMPT_TIMESTAMP>'::timestamptz,
  '<INSPECTION_RESULT>',
  '<BACKEND_SAFE_FINDINGS_JSON>'::jsonb,
  '<SAFE_WATER_JSON>'::jsonb,
  '<SANITATION_JSON>'::jsonb,
  '<REMARKS>',
  null,
  null,
  '<SYNCED_TIMESTAMP>'::timestamptz
);
```

Use SQL `null`, not quoted placeholder text, for genuinely absent location or
attempt timestamps.

### 4. Recreate reinspection schedules

After their original inspections exist, insert schedules while preserving the
reinspection text ID, original inspection ID, place ID, barangay, schedule,
status, and remapped BSI UUID. Insert completed schedules initially as pending
with `completed_at` and `completed_inspection_id` null.

### 5. Insert follow-up inspections

Insert each follow-up inspection after its reinspection schedule exists. Set
both `reinspection_id` and `reinspection_of_inspection_id`; the database
requires the pair and verifies that it matches the schedule, place, and
barangay.

### 6. Complete reinspection schedules

After follow-up inspections exist, update completed schedules with:

```sql
update public.reinspections
set status = 'completed',
    completed_at = '<COMPLETION_TIMESTAMP>'::timestamptz,
    completed_inspection_id = '<FOLLOW_UP_INSPECTION_ID>',
    synced_at = '<SYNCED_TIMESTAMP>'::timestamptz
where id = '<REINSPECTION_ID>';
```

This ordering satisfies the circular inspection/reinspection relationships.

### 7. Verify current place state

Because historical inspections were inserted directly, explicitly verify that
every place has the intended final `status` and `last_inspection_date`. Set
those fields from the newest authoritative inspection only; never derive them
from unordered import execution.

## Evidence

Only migrate an image when its bytes are actually available from Firebase
Storage or from the originating device. Upload it to the private bucket using:

```text
barangays/{barangayId}/inspectors/{supabaseUserId}/inspections/{inspectionId}/evidence/{evidenceId}
```

The inspector path segment must use the remapped Supabase UUID. A `file://` or
`content://` URI in Firestore is device-local and cannot be recovered remotely.
Do not copy such a URI into PostgreSQL. If the device file is unavailable,
omit that evidence entry or recreate the development inspection.

## Local AsyncStorage at runtime cutover

Inspection keys use:

```text
suta_household_inspections:{bsiUid}:{barangayId}
```

Reinspection keys use:

```text
suta_reinspections:{bsiUid}:{barangayId}
```

Firebase UIDs and Supabase UUIDs therefore address different local records.
For this development project, the recommended cutover is to confirm that no
valuable pending local records remain, then clear the app data or reinstall
the app. If local records must be preserved, Phase 5 must include an explicit,
one-time UID-key migration using the private Firebase-to-Supabase mapping. Do
not silently copy or delete these keys.

## Hosted-project safety

- Do not run `supabase db reset --linked`.
- Do not delete the two verification users automatically.
- Wrap each reviewed recreation batch in `begin`/`commit` and inspect the row
  counts before committing.
- Use `rollback` instead of `commit` whenever a relationship or count is not
  exactly as expected.
- Keep completed UID maps and backend exports outside version control.
