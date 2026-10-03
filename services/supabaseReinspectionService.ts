import { requireSupabase } from '@/services/supabase';
import {
  mapReinspectionToInsert,
  mapSupabaseReinspection,
} from '@/services/supabaseMappers';
import { loadSupabaseBsiProfile } from '@/services/supabaseProfileService';
import {
  SupabaseServiceError,
  throwSupabaseServiceError,
} from '@/services/supabaseServiceError';
import type { ReinspectionRecord } from '@/storage/reinspectionStorage';
import type { TablesInsert } from '@/types/supabase';

async function validateReinspectionScope(record: ReinspectionRecord) {
  const profile = await loadSupabaseBsiProfile();
  if (
    record.bsiUid !== profile.uid ||
    record.barangayId !== profile.assignedBarangayId
  ) {
    throw new SupabaseServiceError(
      'Validate reinspection',
      'The local reinspection scope does not match the authenticated BSI profile.',
      { code: 'REINSPECTION_SCOPE_MISMATCH' }
    );
  }
}

function assertMatchingReinspection(
  record: ReinspectionRecord,
  existing: ReturnType<typeof mapSupabaseReinspection>
) {
  if (
    existing.bsiUid !== record.bsiUid ||
    existing.barangayId !== record.barangayId ||
    existing.originalInspectionId !== record.originalInspectionId ||
    existing.placeId !== record.placeId
  ) {
    throw new SupabaseServiceError(
      'Ensure reinspection schedule',
      'The stable reinspection ID is already linked to different immutable fields.',
      { code: 'REINSPECTION_ID_CONFLICT' }
    );
  }
}

export async function ensureSupabaseReinspectionSchedule(
  record: ReinspectionRecord
): Promise<ReinspectionRecord> {
  const client = requireSupabase();
  await validateReinspectionScope(record);

  const { data: existingRow, error: lookupError } = await client
    .from('reinspections')
    .select('*')
    .eq('id', record.id)
    .maybeSingle();

  if (lookupError) {
    throwSupabaseServiceError('Find reinspection schedule', lookupError);
  }

  if (existingRow) {
    try {
      const existing = mapSupabaseReinspection(existingRow);
      assertMatchingReinspection(record, existing);
      return existing;
    } catch (error) {
      throwSupabaseServiceError('Validate reinspection schedule', error);
    }
  }

  const pendingRecord: ReinspectionRecord = {
    id: record.id,
    bsiUid: record.bsiUid,
    barangayId: record.barangayId,
    originalInspectionId: record.originalInspectionId,
    placeId: record.placeId,
    scheduledDate: record.scheduledDate,
    status: 'pending',
    createdAt: record.createdAt,
  };

  let payload: TablesInsert<'reinspections'>;
  try {
    payload = mapReinspectionToInsert(pendingRecord);
  } catch (error) {
    throwSupabaseServiceError('Validate reinspection schedule', error);
  }

  const { data, error } = await client
    .from('reinspections')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    throwSupabaseServiceError('Create reinspection schedule', error);
  }

  return mapSupabaseReinspection(data);
}

export async function upsertSupabaseReinspection(
  record: ReinspectionRecord
): Promise<ReinspectionRecord> {
  const client = requireSupabase();
  await validateReinspectionScope(record);

  let payload: TablesInsert<'reinspections'>;
  try {
    payload = mapReinspectionToInsert(record);
  } catch (error) {
    throwSupabaseServiceError('Validate reinspection', error);
  }

  const { data, error } = await client
    .from('reinspections')
    .upsert(payload, { onConflict: 'id' })
    .select('*')
    .single();

  if (error) {
    throwSupabaseServiceError('Upsert reinspection', error);
  }

  try {
    return mapSupabaseReinspection(data);
  } catch (mappingError) {
    throwSupabaseServiceError('Map reinspection', mappingError);
  }
}

export async function completeSupabaseReinspection(
  record: ReinspectionRecord,
  completedInspectionId: string,
  completedAt = new Date().toISOString()
): Promise<ReinspectionRecord> {
  const client = requireSupabase();
  await validateReinspectionScope(record);

  const { data, error } = await client
    .from('reinspections')
    .update({
      status: 'completed',
      completed_at: completedAt,
      completed_inspection_id: completedInspectionId,
      synced_at: new Date().toISOString(),
    })
    .eq('id', record.id)
    .select('*')
    .single();

  if (error) {
    throwSupabaseServiceError('Complete reinspection', error);
  }

  try {
    return mapSupabaseReinspection(data);
  } catch (mappingError) {
    throwSupabaseServiceError('Map completed reinspection', mappingError);
  }
}
