import { requireSupabase } from '@/services/supabase';
import { throwSupabaseServiceError } from '@/services/supabaseServiceError';
import type { AdminBsiSummary, BarangayOption } from '@/types/admin';
import type { RiskLevel } from '@/types/place';
import type { Json } from '@/types/supabase';
import type { BsiActivityRow, PaginatedReport, PriorityPlaceRow, ReinspectionReportRow, RepeatedNonComplianceRow, ReportFilters, ReportInspectionRow, ReportSummary } from '@/types/report';

const PAGE_SIZE = 500;
const risks: readonly RiskLevel[] = ['Low', 'Moderate', 'High', 'Unclassified'];
const readRisk = (value: string): RiskLevel => risks.find((item) => item === value) ?? 'Unclassified';
const startIso = (value?: string) => value ? new Date(`${value}T00:00:00`).toISOString() : undefined;
const endIso = (value?: string) => { if (!value) return undefined; const date = new Date(`${value}T00:00:00`); date.setDate(date.getDate() + 1); return date.toISOString(); };
const range = (page: number, size: number) => ({ from: page * size, to: page * size + size - 1 });
const isOverdue = (scheduled: string, status: string) => status !== 'completed' && new Date(scheduled).getTime() < Date.now();
const daysOverdue = (scheduled: string, status: string) => isOverdue(scheduled, status) ? Math.max(1, Math.floor((Date.now() - new Date(scheduled).getTime()) / 86_400_000)) : 0;

function applyInspectionFilters<T extends { gte: (c: string, v: string) => T; lt: (c: string, v: string) => T; eq: (c: string, v: string) => T; is: (c: string, v: null) => T; or: (v: string) => T }>(query: T, filters: ReportFilters): T {
  let next = query; const start = startIso(filters.startDate); const end = endIso(filters.endDate);
  if (start) next = next.gte('inspection_date', start); if (end) next = next.lt('inspection_date', end);
  if (filters.barangayId !== 'all') next = next.eq('barangay_id', filters.barangayId);
  if (filters.bsiId !== 'all') next = next.eq('bsi_uid', filters.bsiId);
  if (filters.result !== 'all') next = next.eq('result', filters.result);
  if (filters.riskLevel !== 'all') next = next.eq('risk_level', filters.riskLevel);
  if (filters.placeType !== 'all') next = next.eq('places.place_type', filters.placeType);
  if (filters.inspectionType === 'inspection') next = next.is('reinspection_id', null).is('reinspection_of_inspection_id', null);
  if (filters.inspectionType === 'reinspection') next = next.or('reinspection_id.not.is.null,reinspection_of_inspection_id.not.is.null');
  return next;
}

async function loadLabels(placeIds: string[], bsiIds: string[]) {
  const client = requireSupabase();
  const [places, profiles] = await Promise.all([
    placeIds.length ? client.from('places').select('id,name,barangay_name,barangay_id,place_type,status,risk_level,last_inspection_date').in('id', [...new Set(placeIds)]) : Promise.resolve({ data: [], error: null }),
    bsiIds.length ? client.from('bsi_profiles').select('id,name').in('id', [...new Set(bsiIds)]) : Promise.resolve({ data: [], error: null }),
  ]);
  if (places.error ?? profiles.error) throwSupabaseServiceError('Load report labels', places.error ?? profiles.error);
  return { places: new Map((places.data ?? []).map((item) => [item.id, item])), profiles: new Map((profiles.data ?? []).map((item) => [item.id, item.name])) };
}

function findingSummary(findings: Json): string | undefined {
  if (!Array.isArray(findings)) return undefined;
  for (const value of findings) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    for (const key of ['description', 'details', 'finding']) {
      const text = value[key];
      if (typeof text === 'string' && text.trim()) return text.trim().slice(0, 160);
    }
  }
  return undefined;
}

async function initialIds(placeIds: string[]) {
  if (!placeIds.length) return new Set<string>();
  const client = requireSupabase();
  const { data, error } = await client.from('inspections').select('id,place_id,inspection_date').in('place_id', [...new Set(placeIds)]).is('reinspection_id', null).is('reinspection_of_inspection_id', null).order('inspection_date', { ascending: true });
  if (error) throwSupabaseServiceError('Classify inspection history', error);
  const first = new Map<string, string>();
  for (const item of data ?? []) if (!first.has(item.place_id)) first.set(item.place_id, item.id);
  return new Set(first.values());
}

export async function fetchInspectionReport(filters: ReportFilters, page = 0, pageSize = 25): Promise<PaginatedReport<ReportInspectionRow>> {
  const client = requireSupabase(); const pageRange = range(page, pageSize);
  let query = client.from('inspections').select('id,place_id,barangay_id,bsi_uid,inspection_date,result,risk_level,risk_percentage,reinspection_id,reinspection_of_inspection_id,remarks,places!inspections_place_barangay_fk!inner(place_type)', { count: 'exact' });
  query = applyInspectionFilters(query, filters);
  const { data, error, count } = await query.order('inspection_date', { ascending: false }).range(pageRange.from, pageRange.to);
  if (error) throwSupabaseServiceError('Load inspection report', error);
  const records = data ?? []; const labels = await loadLabels(records.map((item) => item.place_id), records.map((item) => item.bsi_uid));
  const firstIds = await initialIds(records.map((item) => item.place_id));
  const reinspectionIds = records.flatMap((item) => item.reinspection_id ? [item.reinspection_id] : []);
  const originalIds = records.map((item) => item.id);
  const linked = records.length ? await client.from('reinspections').select('id,original_inspection_id,status').or([reinspectionIds.length ? `id.in.(${reinspectionIds.join(',')})` : '', originalIds.length ? `original_inspection_id.in.(${originalIds.join(',')})` : ''].filter(Boolean).join(',')) : { data: [], error: null };
  if (linked.error) throwSupabaseServiceError('Load report reinspection status', linked.error);
  const byId = new Map((linked.data ?? []).map((item) => [item.id, item.status])); const byOriginal = new Map((linked.data ?? []).map((item) => [item.original_inspection_id, item.status]));
  return { total: count ?? 0, page, pageSize, rows: records.map((item) => {
    const place = labels.places.get(item.place_id); const isFollowUp = Boolean(item.reinspection_id || item.reinspection_of_inspection_id);
    return { id: item.id, placeId: item.place_id, placeName: place?.name ?? 'Unknown place', placeType: place?.place_type ?? 'Not available', barangayId: item.barangay_id, barangayName: place?.barangay_name ?? item.barangay_id, bsiId: item.bsi_uid, bsiName: labels.profiles.get(item.bsi_uid) ?? 'Unknown BSI', inspectionDate: item.inspection_date, inspectionType: isFollowUp ? 'Reinspection' : firstIds.has(item.id) ? 'Initial Inspection' : 'Inspection', result: item.result, riskLevel: readRisk(item.risk_level), riskPercentage: item.risk_percentage, reinspectionRequired: item.result === 'for_reinspection', remarksSummary: item.remarks.trim() ? item.remarks.trim().slice(0, 120) : undefined, ...(item.reinspection_id ? { reinspectionStatus: byId.get(item.reinspection_id) } : byOriginal.has(item.id) ? { reinspectionStatus: byOriginal.get(item.id) } : {}) };
  }) };
}

async function fetchAllInspections(filters: ReportFilters) {
  const rows: { id: string; place_id: string; barangay_id: string; bsi_uid: string; inspection_date: string; result: string; risk_level: string; reinspection_id: string | null; reinspection_of_inspection_id: string | null }[] = [];
  for (let page = 0; ; page += 1) {
    let query = requireSupabase().from('inspections').select('id,place_id,barangay_id,bsi_uid,inspection_date,result,risk_level,reinspection_id,reinspection_of_inspection_id,places!inspections_place_barangay_fk!inner(place_type)');
    query = applyInspectionFilters(query, filters); const slice = range(page, PAGE_SIZE);
    const { data, error } = await query.order('inspection_date', { ascending: true }).range(slice.from, slice.to);
    if (error) throwSupabaseServiceError('Calculate inspection report totals', error);
    rows.push(...(data ?? [])); if ((data?.length ?? 0) < PAGE_SIZE) break;
  }
  return rows;
}

export async function fetchReportSummary(filters: ReportFilters, barangays: BarangayOption[]): Promise<ReportSummary> {
  const client = requireSupabase();
  let placesQuery = client.from('places').select('id,barangay_id,risk_level,last_inspection_date');
  if (filters.barangayId !== 'all') placesQuery = placesQuery.eq('barangay_id', filters.barangayId); if (filters.placeType !== 'all') placesQuery = placesQuery.eq('place_type', filters.placeType);
  let reinspectionQuery = client.from('reinspections').select('id,barangay_id,bsi_uid,scheduled_date,status,completed_at');
  if (filters.barangayId !== 'all') reinspectionQuery = reinspectionQuery.eq('barangay_id', filters.barangayId); if (filters.bsiId !== 'all') reinspectionQuery = reinspectionQuery.eq('bsi_uid', filters.bsiId);
  const start = startIso(filters.startDate); const end = endIso(filters.endDate); if (start) reinspectionQuery = reinspectionQuery.gte('scheduled_date', start); if (end) reinspectionQuery = reinspectionQuery.lt('scheduled_date', end);
  let profileQuery = client.from('bsi_profiles').select('id,assigned_barangay_id,active').eq('role', 'bsi'); if (filters.barangayId !== 'all') profileQuery = profileQuery.eq('assigned_barangay_id', filters.barangayId);
  const allTimeFilters = { ...filters, startDate: undefined, endDate: undefined };
  const [placesResult, inspections, allTimeInspections, reinspectionsResult, profilesResult] = await Promise.all([placesQuery, fetchAllInspections(filters), fetchAllInspections(allTimeFilters), reinspectionQuery, profileQuery]);
  if (placesResult.error ?? reinspectionsResult.error ?? profilesResult.error) throwSupabaseServiceError('Calculate report summary', placesResult.error ?? reinspectionsResult.error ?? profilesResult.error);
  const places = placesResult.data ?? []; const reinspections = reinspectionsResult.data ?? []; const profiles = profilesResult.data ?? [];
  const firstIds = await initialIds(allTimeInspections.map((item) => item.place_id));
  const values = (barangayId: string) => { const scopedPlaces = places.filter((item) => item.barangay_id === barangayId); const scopedInspections = inspections.filter((item) => item.barangay_id === barangayId); const scopedReinspections = reinspections.filter((item) => item.barangay_id === barangayId); return { barangayId, registeredPlaces: scopedPlaces.length, inspectionsInRange: scopedInspections.length, compliant: scopedInspections.filter((item) => item.result === 'compliant').length, nonCompliant: scopedInspections.filter((item) => item.result === 'non_compliant').length, forReinspection: scopedInspections.filter((item) => item.result === 'for_reinspection').length, highRisk: scopedPlaces.filter((item) => item.risk_level === 'High').length, pendingReinspections: scopedReinspections.filter((item) => item.status === 'pending').length, overdueReinspections: scopedReinspections.filter((item) => isOverdue(item.scheduled_date, item.status)).length, activeBsis: profiles.filter((item) => item.active && item.assigned_barangay_id === barangayId).length }; };
  const scopeBarangays = (filters.barangayId === 'all' ? barangays : barangays.filter((item) => item.id === filters.barangayId));
  const coverage = scopeBarangays.map((item) => ({ ...values(item.id), barangayName: item.name }));
  const inspectedPlaces = new Set(allTimeInspections.map((item) => item.place_id)).size; const pending = reinspections.filter((item) => item.status === 'pending').length; const completed = reinspections.filter((item) => item.status === 'completed').length; const high = places.filter((item) => item.risk_level === 'High').length;
  const ordinary = inspections.filter((item) => !item.reinspection_id && !item.reinspection_of_inspection_id); const followUps = inspections.length - ordinary.length;
  const represented = new Set(inspections.map((item) => item.barangay_id)).size; const assigned = new Set(profiles.filter((item) => item.active && item.assigned_barangay_id).map((item) => item.assigned_barangay_id)).size;
  const compliant = inspections.filter((item) => item.result === 'compliant').length;
  return { totalBarangays: scopeBarangays.length, activeBarangaysWithInspections: represented, totalRegisteredPlaces: places.length, inspectedPlaces, uninspectedPlaces: Math.max(0, places.length - inspectedPlaces), totalInspections: allTimeInspections.length, inspectionsInRange: inspections.length, initialInspections: ordinary.filter((item) => firstIds.has(item.id)).length, regularInspections: ordinary.filter((item) => !firstIds.has(item.id)).length, reinspectionInspections: followUps, compliant, nonCompliant: inspections.filter((item) => item.result === 'non_compliant').length, forReinspection: inspections.filter((item) => item.result === 'for_reinspection').length, lowRiskPlaces: places.filter((item) => item.risk_level === 'Low').length, moderateRiskPlaces: places.filter((item) => item.risk_level === 'Moderate').length, highRiskPlaces: high, unclassifiedRiskPlaces: places.filter((item) => item.risk_level === 'Unclassified').length, pendingReinspections: pending, overdueReinspections: reinspections.filter((item) => isOverdue(item.scheduled_date, item.status)).length, completedReinspections: completed, activeBsis: profiles.filter((item) => item.active).length, inactiveBsis: profiles.filter((item) => !item.active).length, barangaysWithAssignedBsi: assigned, barangaysWithoutAssignedBsi: Math.max(0, scopeBarangays.length - assigned), compliancePercentage: inspections.length ? compliant / inspections.length * 100 : null, highRiskPercentage: places.length ? high / places.length * 100 : null, reinspectionCompletionPercentage: pending + completed ? completed / (pending + completed) * 100 : null, barangayCoverage: coverage };
}

export async function fetchRepeatedNonCompliancePlaces(filters: ReportFilters, limit = 15): Promise<RepeatedNonComplianceRow[]> {
  const inspections = await fetchAllInspections({ ...filters, startDate: undefined, endDate: undefined, result: 'non_compliant' });
  const grouped = new Map<string, typeof inspections>();
  for (const inspection of inspections) grouped.set(inspection.place_id, [...(grouped.get(inspection.place_id) ?? []), inspection]);
  const repeated = [...grouped.entries()].filter(([, records]) => records.length >= 2).map(([placeId, records]) => ({ placeId, records, latest: records.at(-1)! })).sort((left, right) => right.latest.inspection_date.localeCompare(left.latest.inspection_date)).slice(0, limit);
  const labels = await loadLabels(repeated.map((item) => item.placeId), []);
  return repeated.map((item) => ({ placeId: item.placeId, placeName: labels.places.get(item.placeId)?.name ?? 'Unknown place', barangayName: labels.places.get(item.placeId)?.barangay_name ?? 'Barangay name unavailable', occurrences: item.records.length, latestInspectionId: item.latest.id, latestInspectionDate: item.latest.inspection_date }));
}

export async function fetchPriorityPlaces(filters: ReportFilters, page = 0, pageSize = 25): Promise<PaginatedReport<PriorityPlaceRow>> {
  const client = requireSupabase(); const slice = range(page, pageSize);
  let query = client.from('places').select('id,name,barangay_id,barangay_name,place_type,status,risk_level,last_inspection_date', { count: 'exact' }).or('risk_level.eq.High,status.eq.Non-Compliant,status.eq.For Reinspection');
  if (filters.barangayId !== 'all') query = query.eq('barangay_id', filters.barangayId); if (filters.placeType !== 'all') query = query.eq('place_type', filters.placeType); if (filters.riskLevel !== 'all') query = query.eq('risk_level', filters.riskLevel);
  if (filters.result === 'non_compliant') query = query.eq('status', 'Non-Compliant'); if (filters.result === 'for_reinspection') query = query.eq('status', 'For Reinspection');
  const start = startIso(filters.startDate); const end = endIso(filters.endDate); if (start) query = query.gte('last_inspection_date', start); if (end) query = query.lt('last_inspection_date', end);
  const { data, error, count } = await query.order('last_inspection_date', { ascending: false, nullsFirst: false }).range(slice.from, slice.to); if (error) throwSupabaseServiceError('Load priority places report', error);
  const places = data ?? []; const ids = places.map((item) => item.id);
  const [inspectionResult, reinspectionResult] = await Promise.all([ids.length ? client.from('inspections').select('id,place_id,bsi_uid,inspection_date,risk_percentage,findings').in('place_id', ids).order('inspection_date', { ascending: false }) : Promise.resolve({ data: [], error: null }), ids.length ? client.from('reinspections').select('place_id,status,scheduled_date').in('place_id', ids).order('scheduled_date', { ascending: false }) : Promise.resolve({ data: [], error: null })]);
  if (inspectionResult.error ?? reinspectionResult.error) throwSupabaseServiceError('Load priority place details', inspectionResult.error ?? reinspectionResult.error);
  const latest = new Map<string, NonNullable<typeof inspectionResult.data>[number]>(); for (const item of inspectionResult.data ?? []) if (!latest.has(item.place_id)) latest.set(item.place_id, item);
  const latestFollowUp = new Map<string, NonNullable<typeof reinspectionResult.data>[number]>(); for (const item of reinspectionResult.data ?? []) if (!latestFollowUp.has(item.place_id)) latestFollowUp.set(item.place_id, item);
  const labels = await loadLabels([], [...latest.values()].map((item) => item.bsi_uid));
  const rows = places.map((place) => { const inspection = latest.get(place.id); const followUp = latestFollowUp.get(place.id); return { placeId: place.id, placeName: place.name, barangayName: place.barangay_name ?? place.barangay_id, placeType: place.place_type, status: place.status, riskLevel: readRisk(place.risk_level), latestRiskPercentage: inspection?.risk_percentage ?? null, overdue: followUp ? isOverdue(followUp.scheduled_date, followUp.status) : false, ...(inspection ? { latestInspectionId: inspection.id, latestInspectionDate: inspection.inspection_date, inspectorName: labels.profiles.get(inspection.bsi_uid), findingSummary: findingSummary(inspection.findings) } : {}), ...(followUp ? { reinspectionStatus: followUp.status, scheduledDate: followUp.scheduled_date } : {}) }; }).sort((a, b) => Number(b.riskLevel === 'High' && b.overdue) - Number(a.riskLevel === 'High' && a.overdue) || Number(b.riskLevel === 'High') - Number(a.riskLevel === 'High') || Number(b.status === 'Non-Compliant' && b.overdue) - Number(a.status === 'Non-Compliant' && a.overdue) || Number(b.status === 'Non-Compliant') - Number(a.status === 'Non-Compliant') || Number(b.status === 'For Reinspection') - Number(a.status === 'For Reinspection'));
  return { rows, total: count ?? 0, page, pageSize };
}

export async function fetchReinspectionReport(filters: ReportFilters, page = 0, pageSize = 25): Promise<PaginatedReport<ReinspectionReportRow>> {
  const client = requireSupabase(); const slice = range(page, pageSize);
  let query = client.from('reinspections').select('id,place_id,barangay_id,bsi_uid,original_inspection_id,scheduled_date,status,completed_at,completed_inspection_id,places!reinspections_place_barangay_fk!inner(place_type)', { count: 'exact' });
  if (filters.barangayId !== 'all') query = query.eq('barangay_id', filters.barangayId); if (filters.bsiId !== 'all') query = query.eq('bsi_uid', filters.bsiId); if (filters.placeType !== 'all') query = query.eq('places.place_type', filters.placeType);
  const start = startIso(filters.startDate); const end = endIso(filters.endDate); if (start) query = query.gte('scheduled_date', start); if (end) query = query.lt('scheduled_date', end);
  if (filters.reinspectionStatus === 'pending') query = query.eq('status', 'pending'); if (filters.reinspectionStatus === 'completed') query = query.eq('status', 'completed'); if (filters.reinspectionStatus === 'overdue') query = query.eq('status', 'pending').lt('scheduled_date', new Date().toISOString());
  const { data, error, count } = await query.order('scheduled_date', { ascending: false }).range(slice.from, slice.to); if (error) throwSupabaseServiceError('Load reinspection report', error);
  const records = data ?? []; const inspectionIds = records.flatMap((item) => [item.original_inspection_id, ...(item.completed_inspection_id ? [item.completed_inspection_id] : [])]);
  const [labels, linked] = await Promise.all([loadLabels(records.map((item) => item.place_id), records.map((item) => item.bsi_uid)), inspectionIds.length ? client.from('inspections').select('id,result,inspection_date,risk_level,risk_percentage').in('id', inspectionIds) : Promise.resolve({ data: [], error: null })]); if (linked.error) throwSupabaseServiceError('Load linked inspection results', linked.error);
  const inspections = new Map((linked.data ?? []).map((item) => [item.id, item]));
  return { total: count ?? 0, page, pageSize, rows: records.map((item) => { const original = inspections.get(item.original_inspection_id); const followUp = item.completed_inspection_id ? inspections.get(item.completed_inspection_id) : undefined; const overdue = daysOverdue(item.scheduled_date, item.status); return { id: item.id, placeName: labels.places.get(item.place_id)?.name ?? 'Unknown place', barangayId: item.barangay_id, barangayName: labels.places.get(item.place_id)?.barangay_name ?? item.barangay_id, bsiName: labels.profiles.get(item.bsi_uid) ?? 'Unknown BSI', originalInspectionId: item.original_inspection_id, originalInspectionDate: original?.inspection_date, originalResult: original?.result ?? 'Not available', originalRiskLevel: readRisk(original?.risk_level ?? 'Unclassified'), originalRiskPercentage: original?.risk_percentage ?? null, scheduledDate: item.scheduled_date, status: item.status === 'completed' ? 'Completed' : overdue ? 'Overdue' : 'Pending', daysOverdue: overdue, ...(item.completed_at ? { completedDate: item.completed_at } : {}), ...(item.completed_inspection_id ? { completedInspectionId: item.completed_inspection_id, followUpDate: followUp?.inspection_date, followUpResult: followUp?.result } : {}) }; }) };
}

export async function fetchBsiActivityReport(filters: ReportFilters, page = 0, pageSize = 25): Promise<PaginatedReport<BsiActivityRow>> {
  const client = requireSupabase(); const slice = range(page, pageSize);
  let profiles = client.from('bsi_profiles').select('id,name,assigned_barangay_id,assigned_barangay_name,active', { count: 'exact' }).eq('role', 'bsi'); if (filters.barangayId !== 'all') profiles = profiles.eq('assigned_barangay_id', filters.barangayId); if (filters.bsiId !== 'all') profiles = profiles.eq('id', filters.bsiId);
  if (filters.accountStatus === 'active') profiles = profiles.eq('active', true); if (filters.accountStatus === 'inactive') profiles = profiles.eq('active', false);
  const { data, error, count } = await profiles.order('name').range(slice.from, slice.to); if (error) throwSupabaseServiceError('Load BSI activity report', error);
  const ids = (data ?? []).map((item) => item.id); const scopedInspections = await fetchAllInspections({ ...filters, barangayId: 'all' });
  let reinspectionQuery = client.from('reinspections').select('bsi_uid,status,completed_at,scheduled_date'); if (ids.length) reinspectionQuery = reinspectionQuery.in('bsi_uid', ids); const start = startIso(filters.startDate); const end = endIso(filters.endDate); if (start) reinspectionQuery = reinspectionQuery.gte('scheduled_date', start); if (end) reinspectionQuery = reinspectionQuery.lt('scheduled_date', end);
  const reinspectionResult = ids.length ? await reinspectionQuery : { data: [], error: null }; if (reinspectionResult.error) throwSupabaseServiceError('Calculate BSI follow-up activity', reinspectionResult.error);
  return { total: count ?? 0, page, pageSize, rows: (data ?? []).map((profile) => { const inspections = scopedInspections.filter((item) => item.bsi_uid === profile.id); const followUps = (reinspectionResult.data ?? []).filter((item) => item.bsi_uid === profile.id); return { bsiId: profile.id, name: profile.name, barangayId: profile.assigned_barangay_id ?? '', barangayName: profile.assigned_barangay_name ?? 'Not assigned', active: profile.active, inspections: inspections.length, compliant: inspections.filter((item) => item.result === 'compliant').length, nonCompliant: inspections.filter((item) => item.result === 'non_compliant').length, forReinspection: inspections.filter((item) => item.result === 'for_reinspection').length, reinspectionsCompleted: followUps.filter((item) => item.status === 'completed').length, pendingFollowUps: followUps.filter((item) => item.status === 'pending').length, lastInspectionDate: inspections.at(-1)?.inspection_date }; }) };
}

export function getReportInspectorOptions(bsis: AdminBsiSummary[], barangayId: string) { return bsis.filter((item) => barangayId === 'all' || item.barangayId === barangayId); }
