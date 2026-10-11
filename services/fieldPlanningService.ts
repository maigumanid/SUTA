import { requireSupabase } from '@/services/supabase';
import { mapSupabasePlace } from '@/services/supabaseMappers';
import { throwSupabaseServiceError } from '@/services/supabaseServiceError';
import type { PlanningInspection, PlanningSnapshot } from '@/types/fieldPlanning';
import type { Json, Tables } from '@/types/supabase';
import type { RiskLevel } from '@/types/place';

function locationFromJson(value: Json | null) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const latitude = typeof value.latitude === 'number' ? value.latitude : undefined;
  const longitude = typeof value.longitude === 'number' ? value.longitude : undefined;
  if (latitude === undefined || longitude === undefined) return {};
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return {};
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return {};
  return { latitude, longitude };
}

function riskLevel(value: string): RiskLevel {
  return value === 'Low' || value === 'Moderate' || value === 'High'
    ? value
    : 'Unclassified';
}

export async function fetchPlanningSnapshot(barangayId?: string): Promise<PlanningSnapshot> {
  const [placeRows, inspectionRows, reinspectionRows] = await Promise.all([
    fetchAllPlaceRows(barangayId),
    fetchAllInspectionRows(barangayId),
    fetchAllReinspectionRows(barangayId),
  ]);

  const inspections: PlanningInspection[] = inspectionRows.map((item) => ({
    id: item.id,
    placeId: item.place_id,
    inspectionDate: item.inspection_date,
    result: item.result,
    riskLevel: riskLevel(item.risk_level),
    ...locationFromJson(item.inspection_location),
  }));

  return {
    places: placeRows.map(mapSupabasePlace),
    inspections,
    reinspections: reinspectionRows.map((item) => ({
      id: item.id,
      placeId: item.place_id,
      scheduledDate: item.scheduled_date,
      status: item.status,
    })),
  };
}

const PAGE_SIZE = 500;
type InspectionPlanningRow = Pick<Tables<'inspections'>, 'id' | 'place_id' | 'barangay_id' | 'inspection_date' | 'inspection_location' | 'result' | 'risk_level'>;
type ReinspectionPlanningRow = Pick<Tables<'reinspections'>, 'id' | 'place_id' | 'barangay_id' | 'scheduled_date' | 'status'>;

async function fetchAllPlaceRows(barangayId?: string) {
  const rows: Tables<'places'>[] = [];
  for (let page = 0; ; page += 1) {
    let query = requireSupabase().from('places').select('*').order('name').range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (barangayId) query = query.eq('barangay_id', barangayId);
    const { data, error } = await query;
    if (error) throwSupabaseServiceError('Load field plan places', error);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

async function fetchAllInspectionRows(barangayId?: string) {
  const rows: InspectionPlanningRow[] = [];
  for (let page = 0; ; page += 1) {
    let query = requireSupabase().from('inspections').select('id,place_id,barangay_id,inspection_date,inspection_location,result,risk_level').order('inspection_date', { ascending: false }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (barangayId) query = query.eq('barangay_id', barangayId);
    const { data, error } = await query;
    if (error) throwSupabaseServiceError('Load field plan inspections', error);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

async function fetchAllReinspectionRows(barangayId?: string) {
  const rows: ReinspectionPlanningRow[] = [];
  for (let page = 0; ; page += 1) {
    let query = requireSupabase().from('reinspections').select('id,place_id,barangay_id,scheduled_date,status').order('scheduled_date', { ascending: true }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (barangayId) query = query.eq('barangay_id', barangayId);
    const { data, error } = await query;
    if (error) throwSupabaseServiceError('Load field plan reinspections', error);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

