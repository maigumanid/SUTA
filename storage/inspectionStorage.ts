import AsyncStorage from '@react-native-async-storage/async-storage';

import { HouseholdInspection } from '@/types/householdInspection';
import type { BackendInspectionFinding } from '@/types/householdInspection';
import { ensureInspectionEvidenceDurable } from '@/storage/evidenceFileStorage';

export type InspectionScope = {
  bsiUid: string;
  barangayId: string;
};

function inspectionsKey(scope: InspectionScope) {
  return `suta_household_inspections:${scope.bsiUid}:${scope.barangayId}`;
}

export type InspectionSyncStatus =
  | 'pending'
  | 'synced'
  | 'failed';

export type StoredInspection =
  HouseholdInspection & {
    id: string;
    bsiUid: string;
    barangayId: string;
    savedAt: string;
    syncStatus: InspectionSyncStatus;
    syncFailureStage?: InspectionSyncFailureStage;
    syncFailureReason?: string;
    syncErrorCode?: string;
    syncErrorMessage?: string;
    syncErrorDetails?: string;
    syncErrorHint?: string;
    lastSyncAttemptAt?: string;
  };

export type InspectionSyncFailureStage =
  | 'preparation'
  | 'evidence_file_resolution'
  | 'evidence_upload'
  | 'inspection_submission'
  | 'reinspection_linkage'
  | 'remote_confirmation';

async function readStoredInspections(
  scope: InspectionScope
): Promise<StoredInspection[]> {
  const data = await AsyncStorage.getItem(
    inspectionsKey(scope)
  );

  if (!data) {
    return [];
  }

  const parsed = JSON.parse(data);

  return Array.isArray(parsed)
    ? (parsed as StoredInspection[])
    : [];
}

function createInspectionId() {
  return `inspection_${Date.now()}_${Math.random()
    .toString(36)
    .substring(2, 8)}`;
}

export async function getStoredInspections(scope: InspectionScope): Promise<
  StoredInspection[]
> {
  try {
    return await readStoredInspections(scope);
  } catch (error) {
    console.error(
      'getStoredInspections error:',
      error
    );

    return [];
  }
}

async function writeInspectionsWithCacheRecovery(
  inspections: StoredInspection[],
  scope: InspectionScope
) {
  try {
    await AsyncStorage.setItem(inspectionsKey(scope), JSON.stringify(inspections));
  } catch (initialError) {
    // Working inspection data outranks downloaded history. Reclaim only the
    // removable cache, then retry the exact same queue write once.
    try {
      const { clearDownloadedInspectionHistory, cleanupOfflineStorage } =
        await import('@/storage/inspectionHistoryCache');
      await cleanupOfflineStorage(scope);
      await clearDownloadedInspectionHistory(scope);
    } catch (cleanupError) {
      console.warn('Safe history cleanup could not reclaim storage:', cleanupError);
    }

    try {
      const newest = inspections[0];
      const afterCleanup = await readStoredInspections(scope);
      const recovered = newest
        ? [newest, ...afterCleanup.filter((item) => item.id !== newest.id)]
        : afterCleanup;
      await AsyncStorage.setItem(inspectionsKey(scope), JSON.stringify(recovered));
    } catch {
      throw initialError;
    }
  }
}

export async function getStoredInspectionsForPlace(
  placeId: string,
  scope: InspectionScope
): Promise<StoredInspection[]> {
  const inspections = await readStoredInspections(scope);

  return inspections
    .filter((inspection) => inspection.placeId === placeId)
    .sort((left, right) => {
      const leftTime = Date.parse(left.inspectionDate);
      const rightTime = Date.parse(right.inspectionDate);

      return (
        (Number.isNaN(rightTime) ? 0 : rightTime) -
        (Number.isNaN(leftTime) ? 0 : leftTime)
      );
    });
}

export async function saveInspectionLocally(
  inspection: HouseholdInspection & InspectionScope
): Promise<StoredInspection> {
  try {
    const inspections =
      await getStoredInspections(inspection);

    const now = new Date();

    const durableInspection = ensureInspectionEvidenceDurable(inspection);
    const savedInspection: StoredInspection =
      {
        ...durableInspection,

        id:
          inspection.id ||
          createInspectionId(),

        savedAt: now.toISOString(),

        syncStatus: 'pending',
      };

    const updatedInspections = [
      savedInspection,
      ...inspections,
    ];

    await writeInspectionsWithCacheRecovery(updatedInspections, inspection);

    return savedInspection;
  } catch (error) {
    console.error(
      'saveInspectionLocally error:',
      error
    );

    throw error;
  }
}

export async function getStoredInspectionById(
  inspectionId: string,
  scope: InspectionScope
): Promise<StoredInspection | null> {
  const inspections =
    await getStoredInspections(scope);

  return (
    inspections.find(
      (inspection) =>
        inspection.id === inspectionId
    ) ?? null
  );
}

export async function getPendingInspections(scope: InspectionScope): Promise<
  StoredInspection[]
> {
  const inspections =
    await getStoredInspections(scope);

  return inspections.filter(
    (inspection) =>
      inspection.syncStatus === 'pending' ||
      inspection.syncStatus === 'failed'
  );
}

export async function updateInspectionSyncStatus(
  inspectionId: string,
  status: InspectionSyncStatus,
  scope: InspectionScope,
  failure?: {
    stage: InspectionSyncFailureStage;
    reason: string;
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
  }
): Promise<void> {
  const inspections =
    await getStoredInspections(scope);

  const updatedInspections =
    inspections.map((inspection) => {
      if (
        inspection.id !== inspectionId
      ) {
        return inspection;
      }

      return {
        ...inspection,
        syncStatus: status,
        lastSyncAttemptAt: new Date().toISOString(),
        ...(status === 'failed' && failure
          ? {
              syncFailureStage: failure.stage,
              syncFailureReason: failure.reason,
              syncErrorCode: failure.code,
              syncErrorMessage: failure.message,
              syncErrorDetails: failure.details,
              syncErrorHint: failure.hint,
            }
          : {
              syncFailureStage: undefined,
              syncFailureReason: undefined,
              syncErrorCode: undefined,
              syncErrorMessage: undefined,
              syncErrorDetails: undefined,
              syncErrorHint: undefined,
            }),
      };
    });

  await AsyncStorage.setItem(
    inspectionsKey(scope),
    JSON.stringify(updatedInspections)
  );
}

export async function deleteStoredInspection(
  inspectionId: string,
  scope: InspectionScope
): Promise<void> {
  const inspections =
    await getStoredInspections(scope);

  const updatedInspections =
    inspections.filter(
      (inspection) =>
        inspection.id !== inspectionId
    );

  await AsyncStorage.setItem(
    inspectionsKey(scope),
    JSON.stringify(updatedInspections)
  );
}

export async function clearStoredInspections(scope: InspectionScope): Promise<void> {
  await AsyncStorage.removeItem(
    inspectionsKey(scope)
  );
}

/** Internal retention helper. Callers must preserve Pending and Failed rows. */
export async function replaceStoredInspections(
  inspections: StoredInspection[],
  scope: InspectionScope
) {
  await AsyncStorage.setItem(inspectionsKey(scope), JSON.stringify(inspections));
}

export async function updateInspectionEvidenceStoragePaths(
  inspectionId: string,
  backendFindings: BackendInspectionFinding[],
  scope: InspectionScope
): Promise<void> {
  const inspections = await getStoredInspections(scope);
  const storagePaths = new Map(
    backendFindings.flatMap((finding) =>
      finding.evidence.map((evidence) => [evidence.id, evidence.storagePath] as const)
    )
  );

  const updatedInspections = inspections.map((inspection) =>
    inspection.id !== inspectionId
      ? inspection
      : {
          ...inspection,
          findings: inspection.findings.map((finding) => ({
            ...finding,
            evidence: finding.evidence.map((evidence) => ({
              ...evidence,
              ...(storagePaths.get(evidence.id)
                ? { storagePath: storagePaths.get(evidence.id) }
                : {}),
            })),
          })),
        }
  );

  await AsyncStorage.setItem(
    inspectionsKey(scope),
    JSON.stringify(updatedInspections)
  );
}
