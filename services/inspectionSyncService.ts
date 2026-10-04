import { uploadInspection } from '@/services/inspectionService';
import { SupabaseServiceError } from '@/services/supabaseServiceError';
import {
  getPendingInspections,
  getStoredInspectionById,
  type InspectionScope,
  type StoredInspection,
  updateInspectionSyncStatus,
} from '@/storage/inspectionStorage';
import {
  completeReinspection,
  getReinspectionById,
  type ReinspectionRecord,
} from '@/storage/reinspectionStorage';

export type InspectionSyncPassResult = {
  attempted: number;
  failed: number;
  succeeded: number;
};

type SyncPassOptions = {
  onInspectionFinish?: (
    inspection: StoredInspection,
    succeeded: boolean
  ) => void;
  onInspectionStart?: (inspection: StoredInspection) => void;
  shouldContinue?: () => boolean;
};

const inspectionRuns = new Map<string, Promise<StoredInspection>>();
const scopeQueues = new Map<string, Promise<void>>();
const scopePassRuns = new Map<string, Promise<InspectionSyncPassResult>>();

function scopeKey(scope: InspectionScope) {
  return `${scope.bsiUid}:${scope.barangayId}`;
}

function inspectionRunKey(inspectionId: string, scope: InspectionScope) {
  return `${scopeKey(scope)}:${inspectionId}`;
}

function assertInspectionScope(
  inspection: StoredInspection,
  scope: InspectionScope
) {
  if (
    inspection.bsiUid !== scope.bsiUid ||
    inspection.barangayId !== scope.barangayId
  ) {
    throw new Error(
      'The local inspection does not belong to the active BSI scope.'
    );
  }
}

async function getCompletedReinspection(
  inspection: StoredInspection,
  scope: InspectionScope
): Promise<ReinspectionRecord | undefined> {
  if (!inspection.reinspectionId) {
    return undefined;
  }

  const record = await getReinspectionById(
    inspection.reinspectionId,
    scope
  );

  if (!record) {
    throw new Error(
      'The linked local reinspection schedule could not be found.'
    );
  }

  if (
    record.placeId !== inspection.placeId ||
    record.originalInspectionId !==
      inspection.reinspectionOfInspectionId
  ) {
    throw new Error(
      'The linked local reinspection does not match this follow-up inspection.'
    );
  }

  if (
    record.completedInspectionId &&
    record.completedInspectionId !== inspection.id
  ) {
    throw new Error(
      'The linked reinspection is already associated with another follow-up inspection.'
    );
  }

  if (
    record.status === 'completed' &&
    record.completedInspectionId === inspection.id
  ) {
    return record;
  }

  return completeReinspection(record.id, inspection.id, scope);
}

async function performInspectionSync(
  inspectionId: string,
  scope: InspectionScope
) {
  const inspection = await getStoredInspectionById(inspectionId, scope);

  if (!inspection) {
    throw new Error('The local inspection could not be found.');
  }

  assertInspectionScope(inspection, scope);

  if (inspection.syncStatus === 'synced') {
    return inspection;
  }

  try {
    const completedReinspection = await getCompletedReinspection(
      inspection,
      scope
    );

    await uploadInspection(inspection, scope, completedReinspection);

    return {
      ...inspection,
      syncStatus: 'synced' as const,
    };
  } catch (error) {
    await updateInspectionSyncStatus(inspection.id, 'failed', scope);
    throw error;
  }
}

export function syncStoredInspection(
  inspectionId: string,
  scope: InspectionScope
): Promise<StoredInspection> {
  const key = inspectionRunKey(inspectionId, scope);
  const activeRun = inspectionRuns.get(key);

  if (activeRun) {
    return activeRun;
  }

  const queueKey = scopeKey(scope);
  const previous = scopeQueues.get(queueKey) ?? Promise.resolve();
  const run = previous
    .catch(() => undefined)
    .then(() => performInspectionSync(inspectionId, scope))
    .finally(() => {
      if (inspectionRuns.get(key) === run) {
        inspectionRuns.delete(key);
      }
    });
  const queueTail = run.then(
    () => undefined,
    () => undefined
  );

  inspectionRuns.set(key, run);
  scopeQueues.set(queueKey, queueTail);
  void queueTail.finally(() => {
    if (scopeQueues.get(queueKey) === queueTail) {
      scopeQueues.delete(queueKey);
    }
  });
  return run;
}

async function performSyncPass(
  scope: InspectionScope,
  options: SyncPassOptions
): Promise<InspectionSyncPassResult> {
  const candidates = (await getPendingInspections(scope)).sort(
    (left, right) => {
      const leftTime = Date.parse(left.savedAt);
      const rightTime = Date.parse(right.savedAt);
      return (
        (Number.isNaN(leftTime) ? 0 : leftTime) -
        (Number.isNaN(rightTime) ? 0 : rightTime)
      );
    }
  );

  const result: InspectionSyncPassResult = {
    attempted: 0,
    failed: 0,
    succeeded: 0,
  };

  for (const inspection of candidates) {
    if (options.shouldContinue && !options.shouldContinue()) {
      break;
    }

    result.attempted += 1;
    options.onInspectionStart?.(inspection);

    try {
      await syncStoredInspection(inspection.id, scope);
      result.succeeded += 1;
      options.onInspectionFinish?.(inspection, true);
    } catch {
      result.failed += 1;
      options.onInspectionFinish?.(inspection, false);
    }
  }

  return result;
}

export function retryPendingInspections(
  scope: InspectionScope,
  options: SyncPassOptions = {}
): Promise<InspectionSyncPassResult> {
  const key = scopeKey(scope);
  const activeRun = scopePassRuns.get(key);

  if (activeRun) {
    return activeRun;
  }

  const run = performSyncPass(scope, options).finally(() => {
    if (scopePassRuns.get(key) === run) {
      scopePassRuns.delete(key);
    }
  });

  scopePassRuns.set(key, run);
  return run;
}

export function getInspectionSyncErrorMessage(error: unknown) {
  if (error instanceof SupabaseServiceError) {
    if (
      error.code === 'AUTH_REQUIRED' ||
      error.code === 'INSPECTION_SCOPE_MISMATCH' ||
      error.code === 'EVIDENCE_SCOPE_MISMATCH' ||
      error.code === 'REINSPECTION_SCOPE_MISMATCH'
    ) {
      return 'The active account no longer matches this inspection. Sign in with the original BSI account and try again.';
    }

    if (error.retryable) {
      return 'Synchronization could not reach the server. The local inspection and evidence were kept for retry.';
    }
  }

  if (
    error instanceof Error &&
    error.message.includes('evidence file is no longer available')
  ) {
    return 'A local evidence photo is no longer available. The inspection remains stored but cannot fully synchronize until the evidence is restored.';
  }

  return 'Synchronization failed. The local inspection and evidence were kept for retry.';
}
