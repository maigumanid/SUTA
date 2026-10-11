# Phase 11: census onboarding and field planning

## Operational model

This phase connects four workflows around the existing `places`, `inspections`,
and `reinspections` records:

1. A BSI can import up to 500 comma-separated place records after mapping and
   reviewing the source columns.
2. Coverage compares registered places with each place's authoritative current
   status and the pending reinspection register.
3. The work queue ranks overdue and near-due follow-ups, High Risk and
   Non-Compliant places, incomplete census records, and never-inspected places.
4. The map uses only the latest valid GPS point captured during an inspection.
   Addresses are never geocoded or assigned invented coordinates.

BSI scope remains fixed by existing RLS to the assigned barangay. Admins can
view municipality-wide planning or select one canonical barangay. Admins do not
receive place-write access in this phase.

## CSV import

Name and address are required. Representative name, purok, contact number,
place type, and notes are optional. Missing place type defaults to Household /
Residence because the workflow is intended for census household lists. A
supplied but unsupported place type is invalid and is not saved.

Common header aliases are mapped automatically, but the BSI confirms every
mapping. Quoted commas, escaped quotes, and quoted line breaks are supported.
The review separates invalid rows, potential duplicates, complete rows, and
starter rows. Duplicate comparison normalizes name and address inside the
already RLS-scoped barangay; repeated rows within the selected CSV are also
detected. A potential duplicate is excluded unless the BSI explicitly chooses
**Import anyway**.

One reviewed batch is inserted as a single database statement, so a database
or RLS error does not leave a partially saved batch. Import requires a network
connection. File selection, parsing, mapping, and review are local and do not
upload the source document.

CSV is the only source format in this phase. XLSX was not added because it
would require a larger spreadsheet parser and format-specific behavior without
improving the reliability of the small, structured census schema.

## Starter place records

Migration `20261010000000_census_onboarding_field_planning.sql` relaxes only
the existing representative and purok non-empty checks. It adds:

- `contact_number` and `notes`;
- `profile_status` (`starter` or `complete`);
- `source_kind` (`manual` or `bulk_import`); and
- `import_batch_id` for imported-record provenance.

Existing records default to `complete` and `manual`. Existing grants and RLS
policies are unchanged. Manual Add Place remains unchanged and creates complete
manual records. Imported records that lack representative or purok stay usable,
remain Not Inspected, and are visibly routed into a completion workflow.

## Coverage and queue rules

Coverage is based on current place fields:

- inspected: current status is not `Not Inspected`;
- uninspected: current status is `Not Inspected`;
- pending reinspection: pending rows in `reinspections`; and
- urgent: distinct places currently High Risk or Non-Compliant.

Each place appears at most once in the queue using its strongest applicable
reason. Priority order is overdue reinspection, due today/within seven days,
High Risk, Non-Compliant, incomplete starter record, then never inspected.
The reason and recommended next action are shown on every queue item.

BSIs can fall back to scoped cached places and local reinspection schedules
offline. Admin planning is server-backed and requires connectivity. All server
datasets are paged in 500-row requests rather than relying on the default query
limit.

## Map behavior and deployment limitation

`react-native-maps` is available in Expo Go for SDK 54. Android/iOS markers are
colored from the current place status/risk and open the BSI place record. Web
gets an explicit map-unavailable panel plus the same mapped/unmapped counts and
list fallback.

The Android app-store binary still needs a restricted Google Maps API key and
Maps SDK configuration before production map tiles will work. No credential
was invented or added to this repository. The iOS default uses Apple Maps
unless a Google provider is configured separately.

## Deployment

No deployment was performed as part of implementation. Before testing writes:

1. Review the pending migration with `npx supabase db push --dry-run`.
2. Apply it only when deployment is separately authorized.
3. Reload the application so the new place columns are available.

## Manual test plan

1. Sign in as a BSI and confirm Home and Places both open **Field Plan**.
2. Open Bulk Import, cancel the picker, then select a CSV with aliased headers,
   quoted commas, one invalid row, one repeated row, and one incomplete row.
3. Verify automatic mapping; intentionally map name and address to one column
   and confirm progression is blocked. Correct the mapping.
4. Verify validation counts, attention/ready/all filters, invalid-row reasons,
   starter labeling, and duplicate exclusion. Toggle **Import anyway** once.
5. Go offline on the review step and confirm save is disabled with an explicit
   message. Reconnect and import.
6. Confirm the result totals and that all imported records appear in Places as
   Not Inspected. Confirm incomplete rows show **Needs completion**.
7. Open an incomplete place from the queue, add representative and purok, save,
   and confirm the completion marker disappears without changing its inspection
   status or source provenance.
8. Confirm manual Add Place still creates a normal complete record.
9. In Field Plan, verify totals against the place list, tap each coverage row,
   and confirm the queue filter changes. Check overdue, due-soon, High Risk,
   Non-Compliant, incomplete, and never-inspected ordering/reasons.
10. Go offline as BSI and reopen Field Plan. Confirm cached coverage/queue is
    usable and the server/map limitation is explained.
11. Open Field Map. Confirm only places with real captured inspection GPS show
    pins; all other places appear in the unmapped list. Confirm no address-only
    import receives a pin.
12. On Android and iOS, tap a callout and open the BSI place record. On web,
    confirm the native-map fallback and mapped/unmapped lists render.
13. Sign in as Admin, open Field Plan, switch between municipality-wide and a
    barangay scope, and verify coverage/queue/map counts change consistently.
14. Recheck inspection capture, reinspection, Sync, Reports, Alerts, and manual
    place creation for regressions.

