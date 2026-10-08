import { requireSupabase } from '@/services/supabase';
import { mapSupabaseInspection } from '@/services/supabaseMappers';
import { throwSupabaseServiceError } from '@/services/supabaseServiceError';
import {
  cacheInspectionHistory,
  cleanupOfflineStorage,
  getCachedInspectionById,
  type CachedInspectionSummary,
} from '@/storage/inspectionHistoryCache';
import type {
  InspectionScope,
  StoredInspection,
} from '@/storage/inspectionStorage';

function inspectionTime(inspection: Pick<StoredInspection, 'inspectionDate'>) {
  const parsed = Date.parse(inspection.inspectionDate);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export type InspectionHistoryItem = StoredInspection | CachedInspectionSummary;

export function mergeInspectionRecord(
  local: StoredInspection,
  server: StoredInspection
): StoredInspection {
  const remoteEvidence = new Map(
    server.findings.flatMap((finding) =>
      finding.evidence.map((evidence) => [evidence.id, evidence] as const)
    )
  );
  const localEvidenceIds = new Set(
    local.findings.flatMap((finding) =>
      finding.evidence.map((evidence) => evidence.id)
    )
  );
  const serverFindings = new Map(
    server.findings.map((finding) => [finding.id, finding] as const)
  );

  const findings = local.findings.map((finding) => {
    const remoteFinding = serverFindings.get(finding.id);
    const evidence = finding.evidence.map((attachment) => {
      const remote = remoteEvidence.get(attachment.id);
      return {
        ...remote,
        ...attachment,
        ...(attachment.storagePath
          ? { storagePath: attachment.storagePath }
          : remote?.storagePath
            ? { storagePath: remote.storagePath }
            : {}),
      };
    });
    remoteFinding?.evidence.forEach((attachment) => {
      if (!localEvidenceIds.has(attachment.id)) evidence.push(attachment);
    });
    return { ...remoteFinding, ...finding, evidence };
  });
  server.findings.forEach((finding) => {
    if (!local.findings.some((candidate) => candidate.id === finding.id)) {
      findings.push(finding);
    }
  });

  // Local sync diagnostics and durable file URIs win. Server evidence paths
  // fill the compatibility gap left by records synchronized before those paths
  // were persisted in the local queue.
  return { ...server, ...local, findings };
}

export function mergeInspectionHistory(
  localRecords: InspectionHistoryItem[],
  serverRecords: InspectionHistoryItem[]
) {
  const byId = new Map(
    serverRecords.map((record) => [record.id, record])
  );

  // The local copy wins for matching IDs so unsynchronized diagnostics and
  // durable on-device evidence URIs remain intact.
  localRecords.forEach((record) => {
    const serverRecord = byId.get(record.id);
    byId.set(
      record.id,
      serverRecord && 'findings' in record && 'findings' in serverRecord
        ? mergeInspectionRecord(record, serverRecord)
        : record
    );
  });

  return [...byId.values()].sort(
    (left, right) => inspectionTime(right) - inspectionTime(left)
  );
}

export async function fetchInspectionHistoryForPlace(
  placeId: string,
  scope: InspectionScope
) {
  const { data, error } = await requireSupabase()
    .from('inspections')
    .select('*')
    .eq('place_id', placeId)
    .eq('barangay_id', scope.barangayId)
    .order('inspection_date', { ascending: false });

  if (error) {
    throwSupabaseServiceError('Load place inspection history', error);
  }

  const records = (data ?? []).map(mapSupabaseInspection);
  await cacheInspectionHistory(records, scope);
  void cleanupOfflineStorage(scope).catch((cleanupError) => {
    console.warn('Offline history cleanup could not finish:', cleanupError);
  });
  return records;
}

export async function fetchStoredInspectionById(
  inspectionId: string,
  scope: InspectionScope
) {
  const { data, error } = await requireSupabase()
    .from('inspections')
    .select('*')
    .eq('id', inspectionId)
    .eq('barangay_id', scope.barangayId)
    .maybeSingle();

  if (error) {
    throwSupabaseServiceError('Load inspection', error);
  }

  const record = data ? mapSupabaseInspection(data) : null;
  if (record) {
    await cacheInspectionHistory([record], scope);
    await getCachedInspectionById(record.id, scope);
    void cleanupOfflineStorage(scope).catch((cleanupError) => {
      console.warn('Offline history cleanup could not finish:', cleanupError);
    });
  }
  return record;
}

export async function refreshInspectionHistoryCache(scope: InspectionScope) {
  const pageSize = 500;
  for (let page = 0; ; page += 1) {
    const from = page * pageSize;
    const { data, error } = await requireSupabase()
      .from('inspections')
      .select('*')
      .eq('barangay_id', scope.barangayId)
      .order('inspection_date', { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) {
      throwSupabaseServiceError('Refresh offline inspection history', error);
    }

    const records = (data ?? []).map(mapSupabaseInspection);
    await cacheInspectionHistory(records, scope);
    if (records.length < pageSize) break;
  }
  await cleanupOfflineStorage(scope);
}
