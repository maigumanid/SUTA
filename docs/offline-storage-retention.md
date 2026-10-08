# Offline storage retention

SUTA separates offline inspection data into three safety tiers. The existing
user-and-barangay-scoped inspection queue remains authoritative for local
Pending and Failed work. A lightweight history index keeps synchronized record
summaries for offline Place Details browsing. A separate full-detail cache keeps
recent or recently opened server records.

## Default policy

- Full synchronized records are retained for 90 days and the newest 30 records
  are retained even when they are older than that window.
- A recently opened full record is promoted by updating `lastAccessedAt`.
- The default removable-cache target is approximately 100 MB. Options are
  50 MB, 100 MB, and 250 MB.
- Retention options are 30, 60, 90, and 180 days.
- AsyncStorage does not expose a portable exact on-disk size. JSON payloads use
  a conservative two-bytes-per-character estimate; known durable evidence files
  use their reported file size.

The size target applies only to safely removable synchronized history. Pending,
Failed, incompletely confirmed, and active reinspection source records override
all limits.

## Cleanup order

Cleanup first stores synchronized local records in the lightweight index. It
then removes records outside the age/newest policy only when server submission
and every evidence upload are confirmed. If the configured target is still
exceeded, cleanup removes:

1. uploaded local evidence files, oldest first;
2. least-recently-used server full-detail payloads;
3. confirmed synchronized local payloads, oldest first.

Lightweight summaries are not removed to meet the full-detail target. Supabase
rows and Storage objects are never deleted.

Cleanup runs after successful synchronization, after a complete history refresh,
after preference changes, and when requested from Profile. Historical-cache
writes are lower priority than working inspection writes. If a new working
inspection cannot be written, SUTA clears only safe downloaded history and
retries the queue write once.

## Evidence and offline display

Evidence for Pending or Failed records is never removed. Uploaded evidence may
remain while its record is recent, but it is the first tier removed under
storage pressure. Server history does not automatically download photos. When
a local photo is absent but its private Storage reference exists, the UI asks
the user to reconnect instead of showing a technical file error.

An old record whose full payload has been evicted remains in the lightweight
history list. Opening it offline shows its available result, date, risk,
inspection type, and finding count plus a message that the complete record
requires connectivity. Opening it online reloads and promotes the full record.

## Scope and logout

Index, detail, preferences, cleanup metadata, queue records, and reinspection
records all use the authenticated Supabase UID and barangay ID in their storage
keys. Logout does not delete offline field records, but another account cannot
read them through its different scoped keys.
