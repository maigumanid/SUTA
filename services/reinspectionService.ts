import { upsertSupabaseReinspection } from '@/services/supabaseReinspectionService';
import type { ReinspectionRecord } from '@/storage/reinspectionStorage';

export async function uploadReinspection(record: ReinspectionRecord) {
  return upsertSupabaseReinspection(record);
}
