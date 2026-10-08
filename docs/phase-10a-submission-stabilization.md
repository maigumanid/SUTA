# Phase 10A submission stabilization

## Hosted diagnosis

The hosted `public.submit_inspection` signature matches the client mapper and
TypeScript arguments. No risk values, sync diagnostics, local evidence URI,
profile avatar fields, or notification fields are passed as RPC arguments.
Risk is calculated by the existing database triggers.

An authenticated RPC call using one existing server inspection, in a transaction
that rolled back, reproduced:

```text
42501: permission denied for function calculate_inspection_risk
```

`private.set_inspection_risk()` runs with invoker rights. The Phase 8 migration
revoked authenticated execution of the pure `private.calculate_inspection_risk`
helper that the trigger calls. Earlier risk tests ran as the database owner and
did not exercise this permission boundary.

A rollback-only test of the permission correction exposed a second issue:

```text
42501: new row violates row-level security policy for table "places"
```

The risk AFTER trigger updated `places.risk_level` without setting
`updated_by_uid`. Existing place-update RLS requires the current inspector's ID;
a null or different prior updater fails that check before the RPC's final place
update can run.

## Prepared correction — not deployed

`20261005010000_fix_inspection_risk_execution.sql`:

- Grants authenticated execution of the pure, private risk calculator.
- Sets `updated_by_uid = new.bsi_uid` in the invoker-rights risk update trigger.
- Preserves RLS, RPC arguments, risk scoring, and the existing date guard.

The correction is ordered after the risk migration and before the pending
notification/profile migrations. Applying it requires separate deployment
authorization. A general `supabase db push` would also apply the other pending
Phase 10A migrations; it was not run.

`inspection_submission_regression_test.sql` has 16 rollback-wrapped assertions.
All passed on the hosted database with the correction applied only inside a
transaction that deliberately raised an exception to roll back every change.
This verifies RPC submission/retry, row and JSON-array idempotency, current place
state preservation, and cross-barangay/inactive/password-change restrictions.
It does not test a device's local status write or an actual Storage upload.

## Client diagnostics and display

Failed records now retain sanitized error code/message/details/hint, failure
stage, and last attempt time. Sync's **View sync details** exposes those safe
diagnostics. Credentials, URLs, object/local paths, UUIDs, JSON payloads and
database failing-row contents are omitted/redacted. Successful synchronization
clears stale diagnostics. These fields are local only.

Sync display uses status priority Failed, Pending, Synced; then descending
inspection date (saved date fallback), descending saved date, and stable ID as
the final deterministic tie-break. Filters use the same comparator. Queue
processing order remains unchanged. The tab header uses the existing 28px/700
title, 14px subtitle, and shared spacing conventions.

Profile bucket/RPC failures remain expected while
`20261006010000_profile_refinement.sql` is unapplied. Client argument names
`p_name`, `p_contact_number`, `p_avatar_path` match that migration. Expo Go remote
push behavior is unchanged.

## Device retest

1. Preserve app data; do not reinstall or recreate the failed inspections.
2. Reload the updated app, inspect the Sync header and all four filters. Check
   newest inspection date first inside each status group.
3. Before deployment, at most one retry can capture the existing permission
   error under **View sync details**. Success is not expected yet.
4. After a separately authorized deployment of the correction, retry one
   existing Failed inspection. Confirm Synced, unchanged local photos, refreshed
   place history/status, one remote inspection ID, and unchanged deterministic
   evidence paths. Do not create replacement inspection IDs.
5. Retry the remaining Failed records. Check sequential completion and the
   newest-first Synced display. Confirm an older inspection cannot replace newer
   place status/risk/date.
6. Create/save offline as Pending, restart, verify evidence, then reconnect and
   verify automatic synchronization and reinspection linkage.

The handset's AsyncStorage records were not accessible from the workspace.
Their successful retries and actual Storage object counts require device testing
after deployment; rollback-only database tests do not establish those results.
