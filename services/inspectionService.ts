import { uploadSupabaseInspectionEvidence } from '@/services/supabaseEvidenceService';
import { submitSupabaseInspection } from '@/services/supabaseInspectionService';
import {
  completeSupabaseReinspection,
  ensureSupabaseReinspectionSchedule,
} from '@/services/supabaseReinspectionService';
import {
  type InspectionScope,
  type StoredInspection,
  updateInspectionSyncStatus,
} from '@/storage/inspectionStorage';
import type { ReinspectionRecord } from '@/storage/reinspectionStorage';

export async function uploadInspection(
  inspection: StoredInspection,
  scope: InspectionScope,
  completedReinspection?: ReinspectionRecord
) {
  try {
    const backendFindings = await uploadSupabaseInspectionEvidence(
      inspection.id,
      inspection.findings,
      scope
    );

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

    await updateInspectionSyncStatus(inspection.id, 'synced', scope);
  } catch (error) {
    await updateInspectionSyncStatus(inspection.id, 'failed', scope);
    throw error;
  }
}
