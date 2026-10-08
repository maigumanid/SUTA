import { uploadInspection } from '@/services/inspectionService';
import { SupabaseServiceError } from '@/services/supabaseServiceError';
import { safeSyncDiagnosticText, safeSyncErrorCode } from '@/utils/syncDiagnostics';
import {
  cacheInspectionHistory,
  cleanupOfflineStorage,
} from '@/storage/inspectionHistoryCache';
import {
  getPendingInspections,
  getStoredInspectionById,
  type InspectionScope,
  type InspectionSyncFailureStage,
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

function classifySyncFailure(error: unknown): {
  stage: InspectionSyncFailureStage;
  reason: string;
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
} {
  const operation = error instanceof SupabaseServiceError
    ? error.operation.toLowerCase()
    : '';
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  let stage: InspectionSyncFailureStage = 'preparation';
  let reason = 'Synchronization failed.';

  if (operation.includes('read local inspection evidence') || message.includes('evidence file is unavailable')) {
    stage = 'evidence_file_resolution';
    reason = 'Evidence file is unavailable on this device.';
  } else if (operation.includes('upload inspection evidence')) {
    stage = 'evidence_upload';
    reason = 'Evidence upload failed.';
  } else if (operation.includes('submit inspection') || operation.includes('validate inspection submission')) {
    stage = 'inspection_submission';
    reason = 'Inspection submission failed.';
  } else if (operation.includes('reinspection') || message.includes('reinspection')) {
    stage = 'reinspection_linkage';
    reason = 'Reinspection linkage could not be synchronized.';
  } else if (operation.includes('local sync confirmation')) {
    stage = 'remote_confirmation';
    reason = 'Remote synchronization succeeded, but local confirmation needs recovery.';
  } else if (error instanceof SupabaseServiceError && error.retryable) {
    reason = 'The server could not be reached.';
  }

  return {
    stage,
    reason,
    code: safeSyncErrorCode(error instanceof SupabaseServiceError ? error.code : undefined),
    message: safeSyncDiagnosticText(error instanceof Error ? error.message : undefined),
    details: safeSyncDiagnosticText(error instanceof SupabaseServiceError ? error.details : undefined),
    hint: safeSyncDiagnosticText(error instanceof SupabaseServiceError ? error.hint : undefined),
  };
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

    try {
      await updateInspectionSyncStatus(inspection.id, 'synced', scope);
    } catch (error) {
      const failure = {
        stage: 'remote_confirmation' as const,
        reason: 'Remote synchronization succeeded, but local confirmation could not be saved.',
      };
      console.warn('Inspection sync local confirmation failed:', failure);
      throw new SupabaseServiceError(
        'Save local sync confirmation',
        'The synchronized state could not be written on this device.',
        { cause: error, code: 'LOCAL_SYNC_CONFIRMATION_FAILED', retryable: true }
      );
    }

    try {
      const confirmedLocal = await getStoredInspectionById(inspection.id, scope);
      if (confirmedLocal) {
        const syncedRecord = { ...confirmedLocal, syncStatus: 'synced' as const };
        await cacheInspectionHistory([syncedRecord], scope);
        void cleanupOfflineStorage(scope).catch((cleanupError) => {
          console.warn('Post-sync offline cleanup could not finish:', cleanupError);
        });
      }
    } catch (cacheError) {
      // Historical caching is lower priority than the confirmed sync state.
      console.warn('Synced inspection history could not be cached:', cacheError);
    }

    return {
      ...inspection,
      syncStatus: 'synced' as const,
    };
  } catch (error) {
    const failure = classifySyncFailure(error);
    console.warn('Inspection synchronization failed:', {
      inspectionId: inspection.id,
      stage: failure.stage,
      code: failure.code,
      message: failure.message,
      details: failure.details,
      hint: failure.hint,
      lastAttemptAt: new Date().toISOString(),
    });
    await updateInspectionSyncStatus(
      inspection.id,
      'failed',
      scope,
      failure
    );
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
  const failure = classifySyncFailure(error);
  if (error instanceof SupabaseServiceError) {
    if (
      error.code === 'AUTH_REQUIRED' ||
      error.code === 'INSPECTION_SCOPE_MISMATCH' ||
      error.code === 'EVIDENCE_SCOPE_MISMATCH' ||
      error.code === 'REINSPECTION_SCOPE_MISMATCH'
    ) {
      return 'The active account no longer matches this inspection. Sign in with the original BSI account and try again.';
    }

  }

  if (failure.stage === 'evidence_file_resolution') {
    return 'Evidence file is unavailable on this device. The inspection remains safely stored, but its evidence must be restored before synchronization can finish.';
  }

  if (failure.stage === 'evidence_upload') {
    return 'This inspection is safely stored on this device but could not synchronize. Evidence upload failed.';
  }

  if (failure.stage === 'inspection_submission') {
    return 'This inspection is safely stored on this device but could not synchronize. Inspection submission failed.';
  }

  if (failure.stage === 'reinspection_linkage') {
    return 'This inspection is safely stored on this device but could not synchronize its reinspection relationship.';
  }

  if (failure.stage === 'remote_confirmation') {
    return 'The inspection reached the server, but this device could not save the final synchronized status. Retrying is safe.';
  }

  if (error instanceof SupabaseServiceError && error.retryable) {
    return 'Synchronization could not reach the server. The local inspection and evidence were kept for retry.';
  }

  return 'Synchronization failed. The local inspection and evidence were kept for retry.';
}
