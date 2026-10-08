import type { StoredInspection } from '@/storage/inspectionStorage';

const STATUS_PRIORITY: Record<StoredInspection['syncStatus'], number> = {
  failed: 0,
  pending: 1,
  synced: 2,
};

function timestamp(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Display order only; the engine continues processing its queue oldest first. */
export function compareSyncRecords(left: StoredInspection, right: StoredInspection) {
  return (
    STATUS_PRIORITY[left.syncStatus] - STATUS_PRIORITY[right.syncStatus] ||
    (timestamp(right.inspectionDate) || timestamp(right.savedAt)) -
      (timestamp(left.inspectionDate) || timestamp(left.savedAt)) ||
    timestamp(right.savedAt) - timestamp(left.savedAt) ||
    left.id.localeCompare(right.id)
  );
}
