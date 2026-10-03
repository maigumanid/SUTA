import { requireSupabase } from '@/services/supabase';
import {
  mapInspectionToRpcArgs,
  type SupabaseInspectionRow,
  type SubmitInspectionArgs,
} from '@/services/supabaseMappers';
import { loadSupabaseBsiProfile } from '@/services/supabaseProfileService';
import {
  SupabaseServiceError,
  throwSupabaseServiceError,
} from '@/services/supabaseServiceError';
import type { StoredInspection } from '@/storage/inspectionStorage';
import type { BackendInspectionFinding } from '@/types/householdInspection';

export async function submitSupabaseInspection(
  inspection: StoredInspection,
  backendFindings: BackendInspectionFinding[]
): Promise<SupabaseInspectionRow> {
  const client = requireSupabase();
  const profile = await loadSupabaseBsiProfile();

  if (
    inspection.bsiUid !== profile.uid ||
    inspection.barangayId !== profile.assignedBarangayId
  ) {
    throw new SupabaseServiceError(
      'Submit inspection',
      'The local inspection scope does not match the authenticated BSI profile.',
      { code: 'INSPECTION_SCOPE_MISMATCH' }
    );
  }

  let args: SubmitInspectionArgs;
  try {
    args = mapInspectionToRpcArgs(inspection, backendFindings);
  } catch (error) {
    throwSupabaseServiceError('Validate inspection submission', error);
  }

  const { data, error } = await client
    .rpc('submit_inspection', args)
    .single();

  if (error) {
    throwSupabaseServiceError('Submit inspection', error);
  }

  return data;
}
