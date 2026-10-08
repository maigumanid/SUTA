# Phase 10A: onboarding, alerts, and calendar reminders

## App guide

The app guide is a local, role-specific walkthrough. Its SecureStore key contains the authenticated Supabase UUID and role, so completion or skip state cannot leak between accounts. A forced password change always precedes the guide. The guide does not enter an actual inspection or depend on live remote records, which keeps it safe offline. BSI and Admin Profile screens can replay the correct guide without clearing other user data.

## Navigation and offline UX

BSI navigation uses Home, Places, Sync, Reports, and Profile tabs. Sync is the single operational view over the existing scoped inspection queue. Alerts open from the dashboard bell; Profile remains focused on account, help, and logout actions. Admin Dashboard uses the same bell entry.

One `NetworkContext` owns connectivity state. The BSI sync engine consumes that shared state, shows passive offline feedback, and automatically performs one serialized retry pass after reconnect. Alerts are cached per authenticated UUID; when offline, the inbox shows the last locally cached alert set and explains that refresh requires connectivity.

Inspection evidence is copied into the app document directory and verified before a local inspection is considered durable. Pending and failed records retain those files. Successful or partial uploads retain the private deterministic Storage path locally for signed-URL fallback, without storing a signed or public URL.

## Final reminder architecture

SUTA uses two complementary reminder mechanisms:

- **In-app operational alerts:** the authenticated `notifications` table supplies a chronological Alerts inbox with unread count, read/unread state, mark-all-read, and guarded deep links. New reinspection workload and barangay reassignment alerts are queued by database triggers. A daily PostgreSQL job queues due-tomorrow, overdue, and unresolved High Risk alerts using `Asia/Manila` calendar dates and deterministic dedupe keys.
- **Device calendar reminders:** a pending reinspection can create one managed all-day event in a writable Android/iOS calendar with the registered address, privacy-safe notes, and a one-day-before alarm. SUTA tracks the event ID so a rescheduled date updates the existing event instead of creating a duplicate. SUTA remains authoritative; the calendar is a convenience only.

This design is device-native, works with the user's installed calendar provider, avoids provider-specific OAuth, and does not depend on remote push delivery. Calendar event content excludes findings, evidence, contact details, paths, identifiers, and private URLs.

## Calendar behavior

The **Add to Calendar** action is shown only for a scheduled, incomplete reinspection. Since the stored schedule is date-only, SUTA creates an all-day event and does not invent a time. `expo-calendar` writes to the device's default or primary writable calendar after permission is granted.

The requested alarm is one day before the event, subject to the calendar provider and device settings. A local, user-scoped record stores the calendar ID, event ID, and schedule date. The UI verifies that tracked event and reports Not added, Added, Updated, or Needs update. Reinspection correctness never depends on this local calendar state.

If the SUTA schedule changes, the screen marks the reminder as needing an update and updates the tracked event in place when the user confirms. If the tracked event was removed outside SUTA, the app creates one replacement. Completing a reinspection hides the action.

The action can use already-loaded reinspection/place data without Supabase connectivity. It is unavailable on web, where the Alerts inbox remains fully usable.

## Backend pivot

Migration `20261006020000_in_app_alerts.sql` is forward-only because the original Phase 10A notification migration is already hosted. It:

- preserves the `notifications` table, RLS, read functions, inbox dedupe constraint, and event-driven alert triggers;
- removes trigger calls to the remote notification worker;
- replaces the Edge Function cron with a direct daily PostgreSQL alert-generation job at `00:00 UTC` (08:00 Philippines time);
- keeps the existing `push_tokens` and `notification_log` tables and RPCs harmlessly present for migration compatibility, but no app/runtime code reads or writes them.

The former `send-notifications` Edge Function is not part of the final source architecture and must not be deployed. If it was deployed previously, it becomes unreachable from SUTA after the pivot migration removes all trigger and cron invocations. It may be deleted separately after deployment verification; deleting it is not required for correctness.

## Deployment

No Expo push, FCM, notification secret, Vault worker URL, or notification Edge Function deployment is required.

1. Review the pending migrations: `npx supabase db push --dry-run`
2. Apply them when authorized: `npx supabase db push`
3. Build normally when preparing an installed binary. `expo-calendar` is also included in Expo Go for SDK 54, so calendar behavior can be tested there on Android/iOS.

The general `eas.json` development profile remains useful for native integration testing; it is not required for remote push.

## Test notes and limitations

- Alerts refresh when the authenticated app opens/returns active and when the user taps Refresh; there is no lock-screen delivery promise.
- Scheduled alert generation requires the pivot migration and daily cron to be applied.
- Failed local-only sync remains represented in the Sync tab because the server cannot generate an alert about data it has never received.
- Calendar creation and updates require calendar permission and at least one writable device calendar. Provider alarm behavior can still vary by device settings.
- Alarm delivery remains controlled by the selected calendar provider, OS permission/state, and device battery settings.
