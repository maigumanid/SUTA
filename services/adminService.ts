import { FunctionsHttpError } from '@supabase/supabase-js';

import { requireSupabase } from '@/services/supabase';
import {
  SupabaseServiceError,
  throwSupabaseServiceError,
} from '@/services/supabaseServiceError';
import type {
  AdminBsiSummary,
  AdminDashboardMetrics,
  AdminInspectionDetail,
  AdminInspectionSummary,
  BarangayOption,
  CreateBsiInput,
} from '@/types/admin';
import type { RiskLevel } from '@/types/place';

const riskLevels: readonly RiskLevel[] = ['Low', 'Moderate', 'High', 'Unclassified'];
function readRiskLevel(value: string): RiskLevel {
  return riskLevels.find((level) => level === value) ?? 'Unclassified';
}

export async function fetchBarangays(): Promise<BarangayOption[]> {
  const { data, error } = await requireSupabase()
    .from('barangays').select('id, display_name').eq('active', true)
    .order('display_name');
  if (error) throwSupabaseServiceError('Load barangays', error);
  return (data ?? []).map((item) => ({ id: item.id, name: item.display_name }));
}

type AdminFunctionRequest =
  | {
      action: 'create';
      name: string;
      email: string;
      contactNumber: string;
      assignedBarangayId: string;
      assignedBarangayName: string;
      temporaryPassword: string;
    }
  | { action: 'reassign'; targetUserId: string; assignedBarangayId: string; assignedBarangayName: string }
  | { action: 'deactivate' | 'reactivate'; targetUserId: string }
  | { action: 'reset_password'; targetUserId: string; temporaryPassword: string };

async function invokeAdminFunction(body: AdminFunctionRequest) {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke('admin-manage-bsi', {
    body,
  });

  if (error) {
    let message = 'The account-management request could not be completed.';
    if (error instanceof FunctionsHttpError) {
      try {
        const response = await error.context.json() as {
          error?: unknown;
          message?: unknown;
        };
        const serverMessage = response.error ?? response.message;
        if (typeof serverMessage === 'string') message = serverMessage;
      } catch {
        // Retain the safe generic message for a non-JSON server response.
      }
    }
    throw new SupabaseServiceError('Manage BSI account', message, {
      code: 'ADMIN_FUNCTION_FAILED',
    });
  }
  return data;
}

export async function createBsiAccount(input: CreateBsiInput) {
  return invokeAdminFunction({
    action: 'create',
    name: input.name,
    email: input.email,
    contactNumber: input.contactNumber,
    assignedBarangayId: input.barangayId,
    assignedBarangayName: input.barangayName,
    temporaryPassword: input.temporaryPassword,
  });
}

export async function reassignBsi(
  targetUserId: string,
  barangayId: string,
  barangayName: string
) {
  return invokeAdminFunction({
    action: 'reassign',
    targetUserId,
    assignedBarangayId: barangayId,
    assignedBarangayName: barangayName,
  });
}

export async function setBsiActive(targetUserId: string, active: boolean) {
  return invokeAdminFunction({
    action: active ? 'reactivate' : 'deactivate', targetUserId,
  });
}

export async function resetBsiPassword(
  targetUserId: string,
  temporaryPassword: string
) {
  return invokeAdminFunction({
    action: 'reset_password', targetUserId, temporaryPassword,
  });
}

export async function fetchAdminDashboard(): Promise<AdminDashboardMetrics> {
  const client = requireSupabase();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const requests = await Promise.all([
    client.from('bsi_profiles').select('*', { count: 'exact', head: true }).eq('role', 'bsi').eq('active', true),
    client.from('places').select('*', { count: 'exact', head: true }),
    client.from('inspections').select('*', { count: 'exact', head: true }),
    client.from('inspections').select('*', { count: 'exact', head: true }).eq('result', 'compliant'),
    client.from('inspections').select('*', { count: 'exact', head: true }).eq('result', 'non_compliant'),
    client.from('inspections').select('*', { count: 'exact', head: true }).eq('result', 'for_reinspection'),
    client.from('reinspections').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    client.from('inspections').select('*', { count: 'exact', head: true }).gte('inspection_date', monthStart.toISOString()),
  ]);

  const failed = requests.find((request) => request.error);
  if (failed?.error) throwSupabaseServiceError('Load admin dashboard', failed.error);
  const counts = requests.map((request) => request.count ?? 0);
  return {
    activeBsis: counts[0], registeredPlaces: counts[1], inspections: counts[2],
    compliant: counts[3], nonCompliant: counts[4], forReinspection: counts[5],
    pendingReinspections: counts[6], inspectionsThisMonth: counts[7],
  };
}

export async function fetchAdminBsis(): Promise<AdminBsiSummary[]> {
  const client = requireSupabase();
  const [profilesResult, inspectionsResult, reinspectionsResult] = await Promise.all([
    client.from('bsi_profiles').select('*').eq('role', 'bsi').order('name'),
    client.from('inspections').select('bsi_uid, inspection_date'),
    client.from('reinspections').select('bsi_uid, status'),
  ]);
  const error = profilesResult.error ?? inspectionsResult.error ?? reinspectionsResult.error;
  if (error) throwSupabaseServiceError('Load BSI accounts', error);

  const profiles = profilesResult.data ?? [];
  const inspectionsData = inspectionsResult.data ?? [];
  const reinspectionsData = reinspectionsResult.data ?? [];
  return profiles.map((profile) => {
    const inspections = inspectionsData.filter((item) => item.bsi_uid === profile.id);
    const lastInspectionDate = inspections.reduce<string | undefined>(
      (latest, item) => !latest || item.inspection_date > latest ? item.inspection_date : latest,
      undefined
    );
    return {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      contactNumber: profile.contact_number,
      barangayId: profile.assigned_barangay_id ?? '',
      barangayName: profile.assigned_barangay_name ?? '',
      active: profile.active,
      inspectionCount: inspections.length,
      ...(lastInspectionDate ? { lastInspectionDate } : {}),
      pendingReinspections: reinspectionsData.filter(
        (item) => item.bsi_uid === profile.id && item.status === 'pending'
      ).length,
    };
  });
}

export async function fetchAdminInspections(): Promise<AdminInspectionSummary[]> {
  const client = requireSupabase();
  const [inspectionResult, placesResult, profilesResult, reinspectionsResult] = await Promise.all([
    client.from('inspections').select('*').order('inspection_date', { ascending: false }),
    client.from('places').select('id, name, barangay_id, barangay_name'),
    client.from('bsi_profiles').select('id, name'),
    client.from('reinspections').select('id, original_inspection_id, status'),
  ]);
  const error = inspectionResult.error ?? placesResult.error ?? profilesResult.error ?? reinspectionsResult.error;
  if (error) throwSupabaseServiceError('Load inspection oversight', error);

  const places = new Map((placesResult.data ?? []).map((place) => [place.id, place]));
  const profiles = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile.name]));
  const reinspections = new Map((reinspectionsResult.data ?? []).map((item) => [item.id, item.status]));
  const reinspectionByOriginal = new Map(
    (reinspectionsResult.data ?? []).map((item) => [item.original_inspection_id, item.status])
  );
  return (inspectionResult.data ?? []).map((inspection) => {
    const place = places.get(inspection.place_id);
    return {
      id: inspection.id,
      placeId: inspection.place_id,
      placeName: place?.name ?? 'Unknown place',
      barangayId: inspection.barangay_id,
      barangayName: place?.barangay_name ?? inspection.barangay_id,
      bsiId: inspection.bsi_uid,
      bsiName: profiles.get(inspection.bsi_uid) ?? 'Unknown BSI',
      inspectionDate: inspection.inspection_date,
      result: inspection.result,
      inspectionType: inspection.reinspection_id || inspection.reinspection_of_inspection_id
        ? 'reinspection' : 'inspection',
      ...(inspection.reinspection_id
        ? { reinspectionStatus: reinspections.get(inspection.reinspection_id) ?? 'pending' }
        : reinspectionByOriginal.has(inspection.id)
          ? { reinspectionStatus: reinspectionByOriginal.get(inspection.id) }
          : {}),
      riskLevel: readRiskLevel(inspection.risk_level),
      riskPercentage: inspection.risk_percentage,
      criticalFailure: inspection.risk_critical_failure,
    };
  });
}

export async function fetchAdminInspectionDetail(id: string): Promise<AdminInspectionDetail> {
  const client = requireSupabase();
  const { data: inspection, error } = await client.from('inspections').select('*').eq('id', id).single();
  if (error) throwSupabaseServiceError('Load inspection details', error);
  const [{ data: place, error: placeError }, { data: bsi, error: bsiError }] = await Promise.all([
    client.from('places').select('*').eq('id', inspection.place_id).single(),
    client.from('bsi_profiles').select('name').eq('id', inspection.bsi_uid).single(),
  ]);
  if (placeError ?? bsiError) throwSupabaseServiceError('Load inspection details', placeError ?? bsiError);
  return {
    id: inspection.id, placeId: inspection.place_id, placeName: place.name,
    barangayId: inspection.barangay_id, barangayName: place.barangay_name ?? inspection.barangay_id,
    bsiId: inspection.bsi_uid, bsiName: bsi.name, inspectionDate: inspection.inspection_date, result: inspection.result,
    inspectionType: inspection.reinspection_id || inspection.reinspection_of_inspection_id ? 'reinspection' : 'inspection',
    address: place.address, purok: place.purok, remarks: inspection.remarks,
    location: inspection.inspection_location, safeWaterSupply: inspection.safe_water_supply,
    sanitationFacility: inspection.sanitation_facility, findings: inspection.findings,
    reinspectionOfInspectionId: inspection.reinspection_of_inspection_id,
    riskLevel: readRiskLevel(inspection.risk_level),
    riskPercentage: inspection.risk_percentage,
    criticalFailure: inspection.risk_critical_failure,
    riskEarnedPoints: inspection.risk_earned_points,
    riskMaximumPoints: inspection.risk_maximum_points,
    riskEvaluatedItems: inspection.risk_evaluated_items,
  };
}

export async function createEvidenceSignedUrl(storagePath: string) {
  const { data, error } = await requireSupabase().storage
    .from('inspection-evidence').createSignedUrl(storagePath, 300);
  if (error) throwSupabaseServiceError('Load private evidence', error);
  return data.signedUrl;
}
