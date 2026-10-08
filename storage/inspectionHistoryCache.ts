import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  deleteUploadedLocalEvidence,
  getLocalEvidenceSize,
} from '@/storage/evidenceFileStorage';
import {
  getStoredInspections,
  replaceStoredInspections,
  type InspectionScope,
  type StoredInspection,
} from '@/storage/inspectionStorage';
import { getReinspections } from '@/storage/reinspectionStorage';
import type { InspectionResult } from '@/types/householdInspection';
import type { RiskLevel } from '@/types/place';
import { calculateInspectionRisk } from '@/utils/riskClassification';

export const OFFLINE_RETENTION_OPTIONS = [30, 60, 90, 180] as const;
export const OFFLINE_CACHE_TARGET_OPTIONS_MB = [50, 100, 250] as const;
export type OfflineRetentionDays = (typeof OFFLINE_RETENTION_OPTIONS)[number];
export type OfflineCacheTargetMb = (typeof OFFLINE_CACHE_TARGET_OPTIONS_MB)[number];

export type CachedInspectionSummary = {
  id: string;
  bsiUid: string;
  barangayId: string;
  placeId: string;
  inspectionDate: string;
  savedAt: string;
  syncStatus: 'synced';
  result?: InspectionResult;
  riskLevel: RiskLevel;
  riskPercentage: number | null;
  findingCount: number;
  inspectionType: 'Initial Inspection' | 'Inspection' | 'Reinspection';
  reinspectionId?: string;
  reinspectionOfInspectionId?: string;
};

type FullDetailEntry = {
  record: StoredInspection;
  cachedAt: string;
  lastAccessedAt: string;
};

export type OfflineStoragePreferences = {
  retentionDays: OfflineRetentionDays;
  cacheTargetMb: OfflineCacheTargetMb;
};

type CleanupMeta = {
  lastCleanupAt?: string;
  lastWriteWarningAt?: string;
};

export type OfflineStorageStats = OfflineStoragePreferences & {
  summaryCount: number;
  fullDetailCount: number;
  approximateBytes: number;
  lastCleanupAt?: string;
  hasRecentWriteWarning: boolean;
};

export type OfflineCleanupResult = {
  detailsRemoved: number;
  syncedRecordsRemoved: number;
  evidenceFilesRemoved: number;
  bytesFreed: number;
};

const DEFAULT_PREFERENCES: OfflineStoragePreferences = {
  retentionDays: 90,
  cacheTargetMb: 100,
};
const MINIMUM_RECENT_RECORDS = 30;

function scopeSuffix(scope: InspectionScope) {
  return `${scope.bsiUid}:${scope.barangayId}`;
}

function indexKey(scope: InspectionScope) {
  return `suta_inspection_history_index:v2:${scopeSuffix(scope)}`;
}

function detailsKey(scope: InspectionScope) {
  return `suta_inspection_history_details:v2:${scopeSuffix(scope)}`;
}

function preferencesKey(scope: InspectionScope) {
  return `suta_offline_storage_preferences:v1:${scopeSuffix(scope)}`;
}

function metaKey(scope: InspectionScope) {
  return `suta_offline_storage_meta:v1:${scopeSuffix(scope)}`;
}

function legacyKey(scope: InspectionScope) {
  return `suta_inspection_history_cache:${scopeSuffix(scope)}`;
}

const scopeQueues = new Map<string, Promise<unknown>>();

function serializeForScope<T>(scope: InspectionScope, work: () => Promise<T>) {
  const key = scopeSuffix(scope);
  const previous = scopeQueues.get(key) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(work);
  const tail = run.then(() => undefined, () => undefined);
  scopeQueues.set(key, tail);
  void tail.finally(() => {
    if (scopeQueues.get(key) === tail) scopeQueues.delete(key);
  });
  return run;
}

function approximateJsonBytes(value: unknown) {
  // AsyncStorage does not expose portable on-disk size. Two bytes per JSON
  // character is a conservative, deterministic estimate across platforms.
  return JSON.stringify(value).length * 2;
}

function recordTime(record: Pick<StoredInspection, 'inspectionDate'>) {
  const parsed = Date.parse(record.inspectionDate);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function isReinspection(record: {
  reinspectionId?: string;
  reinspectionOfInspectionId?: string;
}) {
  return Boolean(record.reinspectionId || record.reinspectionOfInspectionId);
}

function createSummary(record: StoredInspection): CachedInspectionSummary {
  const risk = calculateInspectionRisk(record);
  return {
    id: record.id,
    bsiUid: record.bsiUid,
    barangayId: record.barangayId,
    placeId: record.placeId,
    inspectionDate: record.inspectionDate,
    savedAt: record.savedAt,
    syncStatus: 'synced',
    result: record.result,
    riskLevel: risk.level,
    riskPercentage: risk.percentage,
    findingCount: record.findings.length,
    inspectionType: isReinspection(record) ? 'Reinspection' : 'Inspection',
    ...(record.reinspectionId ? { reinspectionId: record.reinspectionId } : {}),
    ...(record.reinspectionOfInspectionId
      ? { reinspectionOfInspectionId: record.reinspectionOfInspectionId }
      : {}),
  };
}

function normalizeInspectionTypes(records: CachedInspectionSummary[]) {
  const oldestOrdinaryByPlace = new Map<string, string>();
  [...records]
    .filter((record) => !isReinspection(record))
    .sort((left, right) => recordTime(left) - recordTime(right))
    .forEach((record) => {
      if (!oldestOrdinaryByPlace.has(record.placeId)) {
        oldestOrdinaryByPlace.set(record.placeId, record.id);
      }
    });

  return records.map((record) => ({
    ...record,
    inspectionType: isReinspection(record)
      ? ('Reinspection' as const)
      : oldestOrdinaryByPlace.get(record.placeId) === record.id
        ? ('Initial Inspection' as const)
        : ('Inspection' as const),
  }));
}

async function readArray<T>(key: string): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

async function readMeta(scope: InspectionScope): Promise<CleanupMeta> {
  try {
    const raw = await AsyncStorage.getItem(metaKey(scope));
    return raw ? (JSON.parse(raw) as CleanupMeta) : {};
  } catch {
    return {};
  }
}

async function noteWriteWarning(scope: InspectionScope) {
  try {
    const meta = await readMeta(scope);
    await AsyncStorage.setItem(
      metaKey(scope),
      JSON.stringify({ ...meta, lastWriteWarningAt: new Date().toISOString() })
    );
  } catch {
    // Historical cache warnings must never interrupt active inspection work.
  }
}

async function ensureLegacyMigrated(scope: InspectionScope) {
  const [existingIndex, existingDetails, legacy] = await Promise.all([
    readArray<CachedInspectionSummary>(indexKey(scope)),
    readArray<FullDetailEntry>(detailsKey(scope)),
    readArray<StoredInspection>(legacyKey(scope)),
  ]);
  if (!legacy.length) return { index: existingIndex, details: existingDetails };

  const now = new Date().toISOString();
  const summaries = normalizeInspectionTypes([
    ...new Map(
      [...existingIndex, ...legacy.map(createSummary)].map((item) => [item.id, item])
    ).values(),
  ]).sort((left, right) => recordTime(right) - recordTime(left));
  const detailsById = new Map(existingDetails.map((entry) => [entry.record.id, entry]));
  legacy.forEach((record) => {
    if (!detailsById.has(record.id)) {
      detailsById.set(record.id, {
        record,
        cachedAt: now,
        lastAccessedAt: record.inspectionDate,
      });
    }
  });
  const details = [...detailsById.values()];

  try {
    await AsyncStorage.setItem(indexKey(scope), JSON.stringify(summaries));
    await AsyncStorage.setItem(detailsKey(scope), JSON.stringify(details));
    await AsyncStorage.removeItem(legacyKey(scope));
  } catch (error) {
    console.warn('Offline history cache migration will retry later:', error);
  }
  return { index: summaries, details };
}

async function readPreferences(scope: InspectionScope) {
  try {
    const raw = await AsyncStorage.getItem(preferencesKey(scope));
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<OfflineStoragePreferences>;
    return {
      retentionDays: OFFLINE_RETENTION_OPTIONS.includes(
        parsed.retentionDays as OfflineRetentionDays
      )
        ? (parsed.retentionDays as OfflineRetentionDays)
        : DEFAULT_PREFERENCES.retentionDays,
      cacheTargetMb: OFFLINE_CACHE_TARGET_OPTIONS_MB.includes(
        parsed.cacheTargetMb as OfflineCacheTargetMb
      )
        ? (parsed.cacheTargetMb as OfflineCacheTargetMb)
        : DEFAULT_PREFERENCES.cacheTargetMb,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function allEvidence(record: StoredInspection) {
  return record.findings.flatMap((finding) => finding.evidence);
}

function isSafelyServerConfirmed(record: StoredInspection) {
  return (
    record.syncStatus === 'synced' &&
    allEvidence(record).every((evidence) => Boolean(evidence.storagePath))
  );
}

async function activeReinspectionSourceIds(scope: InspectionScope) {
  const records = await getReinspections(scope);
  return new Set(
    records
      .filter((record) => record.status === 'pending')
      .map((record) => record.originalInspectionId)
  );
}

function retainedByPolicyIds(
  index: CachedInspectionSummary[],
  retentionDays: number
) {
  const cutoff = Date.now() - retentionDays * 86_400_000;
  const newest = [...index]
    .sort((left, right) => recordTime(right) - recordTime(left))
    .slice(0, MINIMUM_RECENT_RECORDS)
    .map((record) => record.id);
  return new Set([
    ...newest,
    ...index
      .filter((record) => recordTime(record) >= cutoff)
      .map((record) => record.id),
  ]);
}

async function writeDetailsWithRecovery(
  details: FullDetailEntry[],
  scope: InspectionScope,
  activeIds: Set<string>
) {
  try {
    await AsyncStorage.setItem(detailsKey(scope), JSON.stringify(details));
    return;
  } catch (error) {
    console.warn('Full offline history cache write failed; trimming safe detail cache:', error);
    await noteWriteWarning(scope);
  }

  const protectedDetails = details.filter((entry) => activeIds.has(entry.record.id));
  try {
    await AsyncStorage.setItem(detailsKey(scope), JSON.stringify(protectedDetails));
  } catch (error) {
    console.warn('Offline history detail cache could not be written:', error);
  }
}

export async function cacheInspectionHistory(
  records: StoredInspection[],
  scope: InspectionScope
) {
  if (!records.length) return;
  return serializeForScope(scope, async () => {
    const { index, details } = await ensureLegacyMigrated(scope);
    const now = new Date().toISOString();
    const indexById = new Map(index.map((record) => [record.id, record]));
    records.forEach((record) => indexById.set(record.id, createSummary(record)));
    const nextIndex = normalizeInspectionTypes([...indexById.values()]).sort(
      (left, right) => recordTime(right) - recordTime(left)
    );

    const detailsById = new Map(details.map((entry) => [entry.record.id, entry]));
    records.forEach((record) => {
      const existing = detailsById.get(record.id);
      detailsById.set(record.id, {
        record,
        cachedAt: existing?.cachedAt ?? now,
        lastAccessedAt: existing?.lastAccessedAt ?? record.inspectionDate,
      });
    });

    try {
      await AsyncStorage.setItem(indexKey(scope), JSON.stringify(nextIndex));
    } catch (error) {
      await noteWriteWarning(scope);
      const activeIds = await activeReinspectionSourceIds(scope);
      await AsyncStorage.setItem(
        detailsKey(scope),
        JSON.stringify(details.filter((entry) => activeIds.has(entry.record.id)))
      ).catch(() => undefined);
      try {
        await AsyncStorage.setItem(indexKey(scope), JSON.stringify(nextIndex));
      } catch (retryError) {
        console.warn('Offline history index could not be cached:', retryError);
        return;
      }
    }

    await writeDetailsWithRecovery(
      [...detailsById.values()],
      scope,
      await activeReinspectionSourceIds(scope)
    );
  });
}

export async function getCachedInspectionHistoryForPlace(
  placeId: string,
  scope: InspectionScope
) {
  return serializeForScope(scope, async () => {
    const { index } = await ensureLegacyMigrated(scope);
    return index.filter((inspection) => inspection.placeId === placeId);
  });
}

export async function getCachedInspectionSummaryById(
  inspectionId: string,
  scope: InspectionScope
) {
  return serializeForScope(scope, async () => {
    const { index } = await ensureLegacyMigrated(scope);
    return index.find((inspection) => inspection.id === inspectionId) ?? null;
  });
}

export async function getCachedInspectionById(
  inspectionId: string,
  scope: InspectionScope
) {
  return serializeForScope(scope, async () => {
    const { details } = await ensureLegacyMigrated(scope);
    const found = details.find((entry) => entry.record.id === inspectionId);
    if (!found) return null;
    found.lastAccessedAt = new Date().toISOString();
    await writeDetailsWithRecovery(
      details,
      scope,
      await activeReinspectionSourceIds(scope)
    );
    return found.record;
  });
}

export async function getOfflineStoragePreferences(scope: InspectionScope) {
  return serializeForScope(scope, () => readPreferences(scope));
}

export async function setOfflineStoragePreferences(
  scope: InspectionScope,
  preferences: OfflineStoragePreferences
) {
  await serializeForScope(scope, () =>
    AsyncStorage.setItem(preferencesKey(scope), JSON.stringify(preferences))
  );
  try {
    return await cleanupOfflineStorage(scope);
  } catch (error) {
    console.warn('The storage preference was saved, but cleanup will retry later:', error);
    return {
      detailsRemoved: 0,
      syncedRecordsRemoved: 0,
      evidenceFilesRemoved: 0,
      bytesFreed: 0,
    };
  }
}

async function calculateRemovableUsage(
  index: CachedInspectionSummary[],
  details: FullDetailEntry[],
  local: StoredInspection[]
) {
  const safeSynced = local.filter(isSafelyServerConfirmed);
  const evidenceBytes = safeSynced.reduce(
    (sum, record) =>
      sum +
      allEvidence(record).reduce(
        (evidenceSum, evidence) =>
          evidenceSum + getLocalEvidenceSize(evidence.uri),
        0
      ),
    0
  );
  return (
    approximateJsonBytes(index) +
    approximateJsonBytes(details) +
    approximateJsonBytes(safeSynced) +
    evidenceBytes
  );
}

export async function cleanupOfflineStorage(
  scope: InspectionScope
): Promise<OfflineCleanupResult> {
  return serializeForScope(scope, async () => {
    const [{ index: cachedIndex, details: cachedDetails }, preferences, local, activeIds] =
      await Promise.all([
        ensureLegacyMigrated(scope),
        readPreferences(scope),
        getStoredInspections(scope),
        activeReinspectionSourceIds(scope),
      ]);

    const indexById = new Map(cachedIndex.map((record) => [record.id, record]));
    local
      .filter((record) => record.syncStatus === 'synced')
      .forEach((record) => indexById.set(record.id, createSummary(record)));
    const index = normalizeInspectionTypes([...indexById.values()]).sort(
      (left, right) => recordTime(right) - recordTime(left)
    );
    const retainedIds = retainedByPolicyIds(index, preferences.retentionDays);
    const result: OfflineCleanupResult = {
      detailsRemoved: 0,
      syncedRecordsRemoved: 0,
      evidenceFilesRemoved: 0,
      bytesFreed: 0,
    };

    let nextLocal = [...local];
    for (const record of local) {
      if (
        retainedIds.has(record.id) ||
        activeIds.has(record.id) ||
        !isSafelyServerConfirmed(record)
      ) {
        continue;
      }
      for (const evidence of allEvidence(record)) {
        const freed = deleteUploadedLocalEvidence(evidence.uri);
        if (freed > 0) {
          result.evidenceFilesRemoved += 1;
          result.bytesFreed += freed;
        }
      }
      nextLocal = nextLocal.filter((item) => item.id !== record.id);
      result.syncedRecordsRemoved += 1;
      result.bytesFreed += approximateJsonBytes(record);
    }

    const retainedLocalIds = new Set(nextLocal.map((record) => record.id));
    let details = cachedDetails.filter((entry) => {
      const accessTime = Date.parse(entry.lastAccessedAt);
      const recentlyAccessed =
        !Number.isNaN(accessTime) &&
        accessTime >= Date.now() - preferences.retentionDays * 86_400_000;
      const keep =
        activeIds.has(entry.record.id) ||
        ((retainedIds.has(entry.record.id) || recentlyAccessed) &&
          !retainedLocalIds.has(entry.record.id));
      if (!keep) {
        result.detailsRemoved += 1;
        result.bytesFreed += approximateJsonBytes(entry);
      }
      return keep;
    });

    const targetBytes = preferences.cacheTargetMb * 1024 * 1024;
    let usage = await calculateRemovableUsage(index, details, nextLocal);
    const safeLocalOldestFirst = nextLocal
      .filter((record) => isSafelyServerConfirmed(record) && !activeIds.has(record.id))
      .sort((left, right) => recordTime(left) - recordTime(right));

    // Uploaded evidence is the first removable tier when the target is exceeded.
    for (const record of safeLocalOldestFirst) {
      if (usage <= targetBytes) break;
      for (const evidence of allEvidence(record)) {
        if (usage <= targetBytes) break;
        const freed = deleteUploadedLocalEvidence(evidence.uri);
        if (freed > 0) {
          usage -= freed;
          result.evidenceFilesRemoved += 1;
          result.bytesFreed += freed;
        }
      }
    }

    // Then discard least-recently-used server detail payloads, never summaries.
    for (const entry of [...details].sort((left, right) =>
      left.lastAccessedAt.localeCompare(right.lastAccessedAt)
    )) {
      if (usage <= targetBytes) break;
      if (activeIds.has(entry.record.id)) continue;
      details = details.filter((item) => item.record.id !== entry.record.id);
      const freed = approximateJsonBytes(entry);
      usage -= freed;
      result.detailsRemoved += 1;
      result.bytesFreed += freed;
    }

    // Finally remove confirmed synced local payloads if required by the target.
    for (const record of safeLocalOldestFirst) {
      if (usage <= targetBytes) break;
      if (!nextLocal.some((item) => item.id === record.id)) continue;
      for (const evidence of allEvidence(record)) {
        const evidenceFreed = deleteUploadedLocalEvidence(evidence.uri);
        if (evidenceFreed > 0) {
          usage -= evidenceFreed;
          result.evidenceFilesRemoved += 1;
          result.bytesFreed += evidenceFreed;
        }
      }
      if (usage <= targetBytes) break;
      nextLocal = nextLocal.filter((item) => item.id !== record.id);
      const freed = approximateJsonBytes(record);
      usage -= freed;
      result.syncedRecordsRemoved += 1;
      result.bytesFreed += freed;
    }

    await AsyncStorage.setItem(indexKey(scope), JSON.stringify(index));
    await writeDetailsWithRecovery(details, scope, activeIds);
    if (nextLocal.length !== local.length) {
      await replaceStoredInspections(nextLocal, scope);
    }
    const meta = await readMeta(scope);
    await AsyncStorage.setItem(
      metaKey(scope),
      JSON.stringify({ ...meta, lastCleanupAt: new Date().toISOString() })
    ).catch(() => undefined);
    return result;
  });
}

export async function clearDownloadedInspectionHistory(
  scope: InspectionScope
): Promise<OfflineCleanupResult> {
  return serializeForScope(scope, async () => {
    const [{ details }, activeIds] = await Promise.all([
      ensureLegacyMigrated(scope),
      activeReinspectionSourceIds(scope),
    ]);
    const kept = details.filter((entry) => activeIds.has(entry.record.id));
    const removed = details.filter((entry) => !activeIds.has(entry.record.id));
    await writeDetailsWithRecovery(kept, scope, activeIds);
    const meta = await readMeta(scope);
    await AsyncStorage.setItem(
      metaKey(scope),
      JSON.stringify({ ...meta, lastCleanupAt: new Date().toISOString() })
    ).catch(() => undefined);
    return {
      detailsRemoved: removed.length,
      syncedRecordsRemoved: 0,
      evidenceFilesRemoved: 0,
      bytesFreed: removed.reduce(
        (sum, entry) => sum + approximateJsonBytes(entry),
        0
      ),
    };
  });
}

export async function getOfflineStorageStats(
  scope: InspectionScope
): Promise<OfflineStorageStats> {
  return serializeForScope(scope, async () => {
    const [{ index, details }, preferences, local, meta] = await Promise.all([
      ensureLegacyMigrated(scope),
      readPreferences(scope),
      getStoredInspections(scope),
      readMeta(scope),
    ]);
    const localSyncedIds = new Set(
      local.filter((record) => record.syncStatus === 'synced').map((record) => record.id)
    );
    const fullDetailIds = new Set([
      ...details.map((entry) => entry.record.id),
      ...localSyncedIds,
    ]);
    const warningTime = meta.lastWriteWarningAt
      ? Date.parse(meta.lastWriteWarningAt)
      : 0;
    return {
      ...preferences,
      summaryCount: index.length,
      fullDetailCount: fullDetailIds.size,
      approximateBytes: await calculateRemovableUsage(index, details, local),
      ...(meta.lastCleanupAt ? { lastCleanupAt: meta.lastCleanupAt } : {}),
      hasRecentWriteWarning:
        warningTime > 0 && Date.now() - warningTime < 7 * 86_400_000,
    };
  });
}
