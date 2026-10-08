import {
  fetchSupabaseReinspections,
  upsertSupabaseReinspection,
} from '@/services/supabaseReinspectionService';
import type { InspectionScope } from '@/storage/inspectionStorage';
import {
  getReinspections,
  mergeReinspectionsFromServer,
  type ReinspectionRecord,
} from '@/storage/reinspectionStorage';

export async function uploadReinspection(record: ReinspectionRecord) {
  return upsertSupabaseReinspection(record);
}

export async function loadReinspections(
  scope: InspectionScope,
  includeServer: boolean
) {
  const localRecords = await getReinspections(scope);

  if (!includeServer) {
    return localRecords;
  }

  const serverRecords = await fetchSupabaseReinspections(scope);
  return mergeReinspectionsFromServer(serverRecords, scope);
}
