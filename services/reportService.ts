import { requireSupabase } from '@/services/supabase';
import { throwSupabaseServiceError } from '@/services/supabaseServiceError';
import type { AdminBsiSummary, BarangayOption } from '@/types/admin';
import type { RiskLevel } from '@/types/place';
import type {
  CurrentRegisterSummary,
  CurrentSanitationRow,
  MunicipalCurrentSummary,
  PaginatedReport,
  ReportFilters,
  ReportInspectionRow,
  ReportPlaceOption,
} from '@/types/report';
import type { Database, Json } from '@/types/supabase';
import { isReinspectionOverdue } from '@/utils/reinspection';

const QUERY_PAGE_SIZE = 500;
const HYDRATION_BATCH_SIZE = 50;
const risks: readonly RiskLevel[] = ['Low', 'Moderate', 'High', 'Unclassified'];

type PlaceRow = Pick<
  Database['public']['Tables']['places']['Row'],
  | 'id'
  | 'name'
  | 'address'
  | 'purok'
  | 'barangay_id'
  | 'barangay_name'
  | 'place_type'
  | 'status'
  | 'risk_level'
  | 'last_inspection_date'
  | 'created_at'
  | 'created_by_uid'
  | 'representative_name'
  | 'updated_at'
  | 'updated_by_uid'
>;
type InspectionRow = Database['public']['Tables']['inspections']['Row'];
type ReinspectionRow = Database['public']['Tables']['reinspections']['Row'];

const readRisk = (value: string): RiskLevel => risks.find((item) => item === value) ?? 'Unclassified';
const range = (page: number, size: number) => ({ from: page * size, to: page * size + size - 1 });
const startIso = (value?: string) => value ? new Date(`${value}T00:00:00`).toISOString() : undefined;
const endIso = (value?: string) => {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + 1);
  return date.toISOString();
};
const findingsCount = (value: Json) => Array.isArray(value) ? value.length : 0;
const isFollowUp = (inspection: Pick<InspectionRow, 'reinspection_id' | 'reinspection_of_inspection_id'>) =>
  Boolean(inspection.reinspection_id || inspection.reinspection_of_inspection_id);
const chunks = <T,>(values: T[], size: number) =>
  Array.from({ length: Math.ceil(values.length / size) }, (_, index) => values.slice(index * size, (index + 1) * size));

function currentReinspectionState(
  inspection: InspectionRow | undefined,
  byOriginal: Map<string, ReinspectionRow>,
  byCompleted: Map<string, ReinspectionRow>,
) {
  if (!inspection) return { status: 'Not applicable' };
  const completed = byCompleted.get(inspection.id);
  if (completed) return { status: 'Completed', scheduledDate: completed.scheduled_date };
  const pending = byOriginal.get(inspection.id);
  if (pending?.status === 'completed') return { status: 'Completed', scheduledDate: pending.scheduled_date };
  if (pending) {
    return {
      status: isReinspectionOverdue(pending.scheduled_date, 'pending') ? 'Overdue' : 'Pending',
      scheduledDate: pending.scheduled_date,
    };
  }
  return inspection.result === 'for_reinspection'
    ? { status: 'For Reinspection' }
    : { status: 'Not required' };
}

function matchesClientFilters(row: CurrentSanitationRow, filters: ReportFilters) {
  if (filters.bsiId !== 'all' && row.bsiId !== filters.bsiId) return false;
  if (filters.reinspectionStatus !== 'all') {
    const normalized = row.reinspectionStatus.toLowerCase().replaceAll(' ', '_');
    if (normalized !== filters.reinspectionStatus) return false;
  }
  return true;
}

async function fetchPlacePage(filters: ReportFilters, page: number, pageSize: number, withCount: boolean) {
  const client = requireSupabase();
  const slice = range(page, pageSize);
  let query = client
    .from('places')
    .select(
      'id,name,address,purok,barangay_id,barangay_name,place_type,status,risk_level,last_inspection_date,created_at,created_by_uid,representative_name,updated_at,updated_by_uid',
      withCount ? { count: 'exact' } : undefined,
    );
  if (filters.barangayId !== 'all') query = query.eq('barangay_id', filters.barangayId);
  if (filters.purok !== 'all') query = query.eq('purok', filters.purok);
  if (filters.placeType !== 'all') query = query.eq('place_type', filters.placeType);
  if (filters.result === 'compliant') query = query.eq('status', 'Compliant');
  if (filters.result === 'non_compliant') query = query.eq('status', 'Non-Compliant');
  if (filters.riskLevel !== 'all') query = query.eq('risk_level', filters.riskLevel);
  const start = startIso(filters.startDate);
  const end = endIso(filters.endDate);
  if (start) query = query.gte('last_inspection_date', start);
  if (end) query = query.lt('last_inspection_date', end);
  return query
    .order('last_inspection_date', { ascending: false, nullsFirst: false })
    .order('name', { ascending: true })
    .order('id', { ascending: true })
    .range(slice.from, slice.to);
}

async function fetchAllCandidatePlaces(filters: ReportFilters): Promise<PlaceRow[]> {
  const rows: PlaceRow[] = [];
  for (let page = 0; ; page += 1) {
    const { data, error } = await fetchPlacePage(filters, page, QUERY_PAGE_SIZE, false);
    if (error) throwSupabaseServiceError('Load current sanitation places', error);
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < QUERY_PAGE_SIZE) break;
  }
  return rows;
}

async function loadLatestCompletedInspections(places: PlaceRow[]) {
  const client = requireSupabase();
  const selected = new Map<string, InspectionRow>();
  for (const batch of chunks(places.filter((place) => place.last_inspection_date), HYDRATION_BATCH_SIZE)) {
    const target = new Map(batch.map((place) => [place.id, place.last_inspection_date!]));
    for (let page = 0; selectedForBatch(selected, batch) < batch.length; page += 1) {
      const slice = range(page, QUERY_PAGE_SIZE);
      const { data, error } = await client
        .from('inspections')
        .select('*')
        .in('place_id', batch.map((place) => place.id))
        .order('inspection_date', { ascending: false })
        .order('id', { ascending: false })
        .range(slice.from, slice.to);
      if (error) throwSupabaseServiceError('Resolve current inspection records', error);
      for (const inspection of data ?? []) {
        if (!selected.has(inspection.place_id) && inspection.inspection_date === target.get(inspection.place_id)) {
          selected.set(inspection.place_id, inspection);
        }
      }
      if ((data?.length ?? 0) < QUERY_PAGE_SIZE) break;
    }
  }
  return selected;
}

function selectedForBatch(selected: Map<string, InspectionRow>, batch: PlaceRow[]) {
  return batch.reduce((count, place) => count + Number(selected.has(place.id)), 0);
}

async function loadInitialInspectionIds(inspections: InspectionRow[]) {
  const client = requireSupabase();
  const ordinaryPlaceIds = [...new Set(inspections.filter((item) => !isFollowUp(item)).map((item) => item.place_id))];
  const initialIds = new Set<string>();
  for (const placeIds of chunks(ordinaryPlaceIds, HYDRATION_BATCH_SIZE)) {
    const firstByPlace = new Map<string, string>();
    for (let page = 0; firstByPlace.size < placeIds.length; page += 1) {
      const slice = range(page, QUERY_PAGE_SIZE);
      const { data, error } = await client
        .from('inspections')
        .select('id,place_id,inspection_date')
        .in('place_id', placeIds)
        .is('reinspection_id', null)
        .is('reinspection_of_inspection_id', null)
        .order('inspection_date', { ascending: true })
        .order('id', { ascending: true })
        .range(slice.from, slice.to);
      if (error) throwSupabaseServiceError('Classify current inspections', error);
      for (const item of data ?? []) if (!firstByPlace.has(item.place_id)) firstByPlace.set(item.place_id, item.id);
      if ((data?.length ?? 0) < QUERY_PAGE_SIZE) break;
    }
    firstByPlace.forEach((id) => initialIds.add(id));
  }
  return initialIds;
}

async function loadCurrentLinks(inspectionIds: string[]) {
  const client = requireSupabase();
  const byOriginal = new Map<string, ReinspectionRow>();
  const byCompleted = new Map<string, ReinspectionRow>();
  for (const ids of chunks([...new Set(inspectionIds)], 100)) {
    const [original, completed] = await Promise.all([
      client.from('reinspections').select('*').in('original_inspection_id', ids),
      client.from('reinspections').select('*').in('completed_inspection_id', ids),
    ]);
    if (original.error ?? completed.error) {
      throwSupabaseServiceError('Load current reinspection relationships', original.error ?? completed.error);
    }
    for (const item of original.data ?? []) byOriginal.set(item.original_inspection_id, item);
    for (const item of completed.data ?? []) if (item.completed_inspection_id) byCompleted.set(item.completed_inspection_id, item);
  }
  return { byOriginal, byCompleted };
}

async function loadBsiNames(ids: string[]) {
  const client = requireSupabase();
  const names = new Map<string, string>();
  for (const batch of chunks([...new Set(ids.filter(Boolean))], 100)) {
    const { data, error } = await client.from('bsi_profiles').select('id,name').in('id', batch);
    if (error) throwSupabaseServiceError('Load report inspector names', error);
    for (const item of data ?? []) names.set(item.id, item.name);
  }
  return names;
}

async function hydrateCurrentPlaces(places: PlaceRow[]): Promise<CurrentSanitationRow[]> {
  if (!places.length) return [];
  const latest = await loadLatestCompletedInspections(places);
  const inspections = [...latest.values()];
  const [initialIds, links, bsiNames] = await Promise.all([
    loadInitialInspectionIds(inspections),
    loadCurrentLinks(inspections.map((item) => item.id)),
    loadBsiNames(inspections.map((item) => item.bsi_uid)),
  ]);
  return places.map((place) => {
    const inspection = latest.get(place.id);
    const reinspection = currentReinspectionState(inspection, links.byOriginal, links.byCompleted);
    const inspectionType = !inspection
      ? 'Not Yet Inspected'
      : isFollowUp(inspection)
        ? 'Reinspection'
        : initialIds.has(inspection.id)
          ? 'Initial Inspection'
          : 'Inspection';
    return {
      placeId: place.id,
      placeName: place.name,
      placeType: place.place_type,
      address: place.address,
      purok: place.purok,
      barangayId: place.barangay_id,
      barangayName: place.barangay_name ?? place.barangay_id,
      inspectionId: inspection?.id,
      inspectionDate: inspection?.inspection_date,
      inspectionType,
      bsiId: inspection?.bsi_uid,
      bsiName: inspection ? (bsiNames.get(inspection.bsi_uid) ?? 'Unknown BSI') : undefined,
      result: inspection?.result ?? 'not_yet_inspected',
      riskLevel: readRisk(inspection?.risk_level ?? place.risk_level),
      riskPercentage: inspection?.risk_percentage ?? null,
      reinspectionStatus: reinspection.status,
      reinspectionScheduledDate: reinspection.scheduledDate,
      findingsCount: inspection ? findingsCount(inspection.findings) : 0,
      hasRemarks: Boolean(inspection?.remarks.trim()),
    };
  });
}

export async function fetchCurrentSanitationRegister(
  filters: ReportFilters,
  page = 0,
  pageSize = 20,
): Promise<PaginatedReport<CurrentSanitationRow>> {
  const needsClientFiltering = filters.bsiId !== 'all' || filters.reinspectionStatus !== 'all';
  if (needsClientFiltering) {
    const rows = (await hydrateCurrentPlaces(await fetchAllCandidatePlaces(filters))).filter((row) =>
      matchesClientFilters(row, filters)
    );
    const slice = range(page, pageSize);
    return { rows: rows.slice(slice.from, slice.to + 1), total: rows.length, page, pageSize };
  }
  const result = await fetchPlacePage(filters, page, pageSize, true);
  if (result.error) throwSupabaseServiceError('Load current sanitation register', result.error);
  return {
    rows: await hydrateCurrentPlaces(result.data ?? []),
    total: result.count ?? 0,
    page,
    pageSize,
  };
}

export async function fetchCompleteCurrentSanitationRegister(filters: ReportFilters) {
  const rows = (await hydrateCurrentPlaces(await fetchAllCandidatePlaces(filters))).filter((row) =>
    matchesClientFilters(row, filters)
  );
  return { rows, total: rows.length, page: 0, pageSize: rows.length } satisfies PaginatedReport<CurrentSanitationRow>;
}

async function classifyHistoryRows(records: InspectionRow[], place: PlaceRow): Promise<ReportInspectionRow[]> {
  const [initialIds, links, bsiNames] = await Promise.all([
    loadInitialInspectionIds(records),
    loadCurrentLinks(records.map((item) => item.id)),
    loadBsiNames(records.map((item) => item.bsi_uid)),
  ]);
  return records.map((item) => {
    const reinspection = currentReinspectionState(item, links.byOriginal, links.byCompleted);
    return {
      id: item.id,
      placeId: item.place_id,
      placeName: place.name,
      placeType: place.place_type,
      address: place.address,
      purok: place.purok,
      barangayId: place.barangay_id,
      barangayName: place.barangay_name ?? place.barangay_id,
      bsiId: item.bsi_uid,
      bsiName: bsiNames.get(item.bsi_uid) ?? 'Unknown BSI',
      inspectionDate: item.inspection_date,
      inspectionType: isFollowUp(item) ? 'Reinspection' : initialIds.has(item.id) ? 'Initial Inspection' : 'Inspection',
      result: item.result,
      riskLevel: readRisk(item.risk_level),
      riskPercentage: item.risk_percentage,
      reinspectionStatus: reinspection.status,
      reinspectionScheduledDate: reinspection.scheduledDate,
      findingsCount: findingsCount(item.findings),
      hasRemarks: Boolean(item.remarks.trim()),
    };
  });
}

async function loadReportPlace(placeId: string) {
  const { data, error } = await requireSupabase().from('places').select('*').eq('id', placeId).single();
  if (error) throwSupabaseServiceError('Load report place', error);
  return data;
}

async function fetchHistoryPage(filters: ReportFilters, page: number, pageSize: number, withCount: boolean) {
  if (filters.placeId === 'all') return { data: [], error: null, count: 0 };
  const slice = range(page, pageSize);
  let query = requireSupabase()
    .from('inspections')
    .select('*', withCount ? { count: 'exact' } : undefined)
    .eq('place_id', filters.placeId);
  const start = startIso(filters.startDate);
  const end = endIso(filters.endDate);
  if (start) query = query.gte('inspection_date', start);
  if (end) query = query.lt('inspection_date', end);
  if (filters.inspectionType === 'inspection') {
    query = query.is('reinspection_id', null).is('reinspection_of_inspection_id', null);
  }
  if (filters.inspectionType === 'reinspection') {
    query = query.or('reinspection_id.not.is.null,reinspection_of_inspection_id.not.is.null');
  }
  return query
    .order('inspection_date', { ascending: true })
    .order('id', { ascending: true })
    .range(slice.from, slice.to);
}

export async function fetchPlaceInspectionHistory(
  filters: ReportFilters,
  page = 0,
  pageSize = 20,
): Promise<PaginatedReport<ReportInspectionRow>> {
  if (filters.placeId === 'all') return { rows: [], total: 0, page, pageSize };
  const [place, result] = await Promise.all([
    loadReportPlace(filters.placeId),
    fetchHistoryPage(filters, page, pageSize, true),
  ]);
  if (result.error) throwSupabaseServiceError('Load place inspection history', result.error);
  return {
    rows: await classifyHistoryRows(result.data ?? [], place),
    total: result.count ?? 0,
    page,
    pageSize,
  };
}

export async function fetchCompletePlaceInspectionHistory(filters: ReportFilters) {
  if (filters.placeId === 'all') return { rows: [], total: 0, page: 0, pageSize: 0 } satisfies PaginatedReport<ReportInspectionRow>;
  const place = await loadReportPlace(filters.placeId);
  const records: InspectionRow[] = [];
  for (let page = 0; ; page += 1) {
    const result = await fetchHistoryPage(filters, page, 200, false);
    if (result.error) throwSupabaseServiceError('Load complete place inspection history', result.error);
    records.push(...(result.data ?? []));
    if ((result.data?.length ?? 0) < 200) break;
  }
  const rows = await classifyHistoryRows(records, place);
  return { rows, total: rows.length, page: 0, pageSize: rows.length };
}

export async function fetchReportPuroks(barangayId = 'all') {
  const values = new Set<string>();
  for (let page = 0; ; page += 1) {
    const slice = range(page, QUERY_PAGE_SIZE);
    let query = requireSupabase().from('places').select('purok');
    if (barangayId !== 'all') query = query.eq('barangay_id', barangayId);
    const { data, error } = await query.order('purok', { ascending: true }).range(slice.from, slice.to);
    if (error) throwSupabaseServiceError('Load report puroks', error);
    for (const item of data ?? []) if (item.purok.trim()) values.add(item.purok.trim());
    if ((data?.length ?? 0) < QUERY_PAGE_SIZE) break;
  }
  return [...values].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

export async function fetchReportPlaces(barangayId = 'all', purok = 'all'): Promise<ReportPlaceOption[]> {
  const rows: ReportPlaceOption[] = [];
  for (let page = 0; ; page += 1) {
    const slice = range(page, QUERY_PAGE_SIZE);
    let query = requireSupabase().from('places').select('id,name,purok,barangay_id,barangay_name');
    if (barangayId !== 'all') query = query.eq('barangay_id', barangayId);
    if (purok !== 'all') query = query.eq('purok', purok);
    const { data, error } = await query.order('name', { ascending: true }).order('id', { ascending: true }).range(slice.from, slice.to);
    if (error) throwSupabaseServiceError('Load report places', error);
    rows.push(...(data ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      purok: item.purok,
      barangayId: item.barangay_id,
      barangayName: item.barangay_name ?? item.barangay_id,
    })));
    if ((data?.length ?? 0) < QUERY_PAGE_SIZE) break;
  }
  return rows;
}

export function summarizeCurrentRows(rows: CurrentSanitationRow[]): CurrentRegisterSummary {
  return {
    places: rows.length,
    inspected: rows.filter((item) => item.inspectionId).length,
    notYetInspected: rows.filter((item) => !item.inspectionId).length,
    compliant: rows.filter((item) => item.result === 'compliant').length,
    nonCompliant: rows.filter((item) => item.result === 'non_compliant').length,
    lowRisk: rows.filter((item) => item.riskLevel === 'Low').length,
    moderateRisk: rows.filter((item) => item.riskLevel === 'Moderate').length,
    highRisk: rows.filter((item) => item.riskLevel === 'High').length,
    forReinspection: rows.filter((item) => item.reinspectionStatus === 'For Reinspection').length,
    pendingReinspections: rows.filter((item) => item.reinspectionStatus === 'Pending').length,
    overdueReinspections: rows.filter((item) => item.reinspectionStatus === 'Overdue').length,
    completedReinspections: rows.filter((item) => item.reinspectionStatus === 'Completed').length,
  };
}

export async function fetchMunicipalCurrentSummary(
  filters: ReportFilters,
  barangays: BarangayOption[],
): Promise<MunicipalCurrentSummary> {
  const current = await fetchCompleteCurrentSanitationRegister(filters);
  const includedBarangays = filters.barangayId === 'all'
    ? barangays
    : barangays.filter((item) => item.id === filters.barangayId);
  const rows = includedBarangays.map((barangay) => {
    const values = current.rows.filter((item) => item.barangayId === barangay.id);
    const summary = summarizeCurrentRows(values);
    return {
      barangayId: barangay.id,
      barangayName: barangay.name,
      registeredPlaces: summary.places,
      placesWithInspectionData: summary.inspected,
      compliant: summary.compliant,
      nonCompliant: summary.nonCompliant,
      lowRisk: summary.lowRisk,
      moderateRisk: summary.moderateRisk,
      highRisk: summary.highRisk,
      forReinspection: summary.forReinspection,
      pendingReinspections: summary.pendingReinspections,
      overdueReinspections: summary.overdueReinspections,
    };
  });
  return { rows, currentRows: current.rows, summary: summarizeCurrentRows(current.rows) };
}

export function getReportInspectorOptions(bsis: AdminBsiSummary[], barangayId: string) {
  return bsis.filter((item) => barangayId === 'all' || item.barangayId === barangayId);
}
