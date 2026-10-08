import { uploadSupabaseInspectionEvidence } from '@/services/supabaseEvidenceService';
import { submitSupabaseInspection } from '@/services/supabaseInspectionService';
import {
  completeSupabaseReinspection,
  ensureSupabaseReinspectionSchedule,
} from '@/services/supabaseReinspectionService';
import {
  type InspectionScope,
  type StoredInspection,
  updateInspectionEvidenceStoragePaths,
} from '@/storage/inspectionStorage';
import type { ReinspectionRecord } from '@/storage/reinspectionStorage';

export async function uploadInspection(
  inspection: StoredInspection,
  scope: InspectionScope,
  completedReinspection?: ReinspectionRecord
) {
  const backendFindings = await uploadSupabaseInspectionEvidence(
    inspection.id,
    inspection.findings,
    scope
  );
  try {
    await updateInspectionEvidenceStoragePaths(
      inspection.id,
      backendFindings,
      scope
    );
  } catch (error) {
    // Remote synchronization remains authoritative. Losing this optional
    // local fallback metadata must not prevent the idempotent RPC submission.
    console.warn('Unable to cache remote evidence metadata locally:', error);
  }

  return finishInspectionUpload(
    inspection,
    backendFindings,
    completedReinspection
  );
}

async function finishInspectionUpload(
  inspection: StoredInspection,
  backendFindings: Awaited<ReturnType<typeof uploadSupabaseInspectionEvidence>>,
  completedReinspection?: ReinspectionRecord
) {
  if (completedReinspection) {
    await ensureSupabaseReinspectionSchedule(completedReinspection);
  }

  await submitSupabaseInspection(inspection, backendFindings);

  if (completedReinspection) {
    if (!completedReinspection.completedInspectionId) {
      throw new Error(
        'A completed reinspection must reference its follow-up inspection.'
      );
    }

    await completeSupabaseReinspection(
      completedReinspection,
      completedReinspection.completedInspectionId,
      completedReinspection.completedAt
    );
  }
}
