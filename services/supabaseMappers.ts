import type { ReinspectionRecord } from '@/storage/reinspectionStorage';
import type {
  BackendInspectionFinding,
  HouseholdInspection,
} from '@/types/householdInspection';
import type { AppProfile, BsiProfile } from '@/types/inspector';
import {
  PLACE_TYPES,
  type InspectionStatus,
  type Place,
  type PlaceType,
  type RiskLevel,
} from '@/types/place';
import type { Database, Json, Tables, TablesInsert } from '@/types/supabase';

export type SupabaseInspectionRow = Tables<'inspections'>;
export type SupabasePlaceRow = Tables<'places'>;
export type SupabaseReinspectionRow = Tables<'reinspections'>;
export type SubmitInspectionArgs =
  Database['public']['Functions']['submit_inspection']['Args'];

const INSPECTION_STATUSES: readonly InspectionStatus[] = [
  'Compliant',
  'Non-Compliant',
  'For Reinspection',
  'Not Inspected',
];
const RISK_LEVELS: readonly RiskLevel[] = [
  'Low',
  'Moderate',
  'High',
  'Unclassified',
];

function requireText(value: string, field: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${field} is required.`);
  }
  return trimmed;
}

function isPlaceType(value: string): value is PlaceType {
  return PLACE_TYPES.some((placeType) => placeType === value);
}

function isInspectionStatus(value: string): value is InspectionStatus {
  return INSPECTION_STATUSES.some((status) => status === value);
}

function isRiskLevel(value: string): value is RiskLevel {
  return RISK_LEVELS.some((riskLevel) => riskLevel === value);
}

export function mapSupabaseProfile(
  row: Tables<'bsi_profiles'>
): AppProfile {
  if (row.role !== 'bsi' && row.role !== 'admin') {
    throw new Error('The authenticated profile has an unsupported role.');
  }

  const base = {
    uid: row.id,
    name: requireText(row.name, 'Profile name'),
    email: requireText(row.email, 'Profile email'),
    contactNumber: requireText(row.contact_number, 'Profile contact number'),
    assignedBarangayId: row.assigned_barangay_id ?? '',
    assignedBarangay: row.assigned_barangay_name ?? '',
    active: row.active,
    mustChangePassword: row.must_change_password,
    ...(row.jurisdiction_name
      ? { jurisdictionName: row.jurisdiction_name }
      : {}),
  };

  if (row.role === 'bsi') {
    return {
      ...base,
      assignedBarangayId: requireText(
        row.assigned_barangay_id ?? '',
        'Assigned barangay ID'
      ),
      assignedBarangay: requireText(
        row.assigned_barangay_name ?? '',
        'Assigned barangay name'
      ),
      role: 'bsi',
    };
  }

  return { ...base, role: 'admin' };
}

export function mapSupabasePlace(row: SupabasePlaceRow): Place {
  if (!isPlaceType(row.place_type)) {
    throw new Error(`Unsupported place type: ${row.place_type}`);
  }
  if (!isInspectionStatus(row.status)) {
    throw new Error(`Unsupported place status: ${row.status}`);
  }
  if (!isRiskLevel(row.risk_level)) {
    throw new Error(`Unsupported risk level: ${row.risk_level}`);
  }

  return {
    id: row.id,
    barangayId: row.barangay_id,
    ...(row.barangay_name ? { barangay: row.barangay_name } : {}),
    createdByUid: row.created_by_uid,
    name: row.name,
    representativeName: row.representative_name,
    address: row.address,
    purok: row.purok,
    placeType: row.place_type,
    status: row.status,
    riskLevel: row.risk_level,
    ...(row.last_inspection_date
      ? { lastInspectionDate: row.last_inspection_date }
      : {}),
  };
}

export function mapPlaceToInsert(
  place: Place,
  profile: BsiProfile
): TablesInsert<'places'> {
  return {
    id: requireText(place.id, 'Place ID'),
    barangay_id: profile.assignedBarangayId,
    barangay_name: place.barangay ?? profile.assignedBarangay,
    created_by_uid: profile.uid,
    updated_by_uid: profile.uid,
    name: requireText(place.name, 'Place name'),
    representative_name: requireText(
      place.representativeName,
      'Representative name'
    ),
    address: requireText(place.address, 'Place address'),
    purok: requireText(place.purok, 'Purok'),
    place_type: place.placeType,
    status: place.status,
    risk_level: place.riskLevel,
    ...(place.lastInspectionDate
      ? { last_inspection_date: place.lastInspectionDate }
      : {}),
  };
}

export function toJson(value: unknown): Json {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('JSON numbers must be finite.');
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(toJson);
  }

  if (typeof value === 'object') {
    const result: { [key: string]: Json | undefined } = {};
    for (const [key, child] of Object.entries(value)) {
      if (child !== undefined) {
        result[key] = toJson(child);
      }
    }
    return result;
  }

  throw new Error('Value cannot be represented as JSON.');
}

function mapBackendFindings(findings: BackendInspectionFinding[]) {
  return findings.map((finding) => ({
    id: finding.id,
    category: finding.category,
    details: finding.details,
    evidence: finding.evidence.map((evidence) => ({
      id: evidence.id,
      source: evidence.source,
      createdAt: evidence.createdAt,
      storagePath: evidence.storagePath,
      ...(evidence.fileName ? { fileName: evidence.fileName } : {}),
      ...(evidence.mimeType ? { mimeType: evidence.mimeType } : {}),
    })),
  }));
}

export function mapInspectionToRpcArgs(
  inspection: HouseholdInspection & { id: string },
  backendFindings: BackendInspectionFinding[]
): SubmitInspectionArgs {
  if (!inspection.result) {
    throw new Error('A completed inspection result is required.');
  }

  const args: SubmitInspectionArgs = {
    p_id: requireText(inspection.id, 'Inspection ID'),
    p_place_id: requireText(inspection.placeId, 'Place ID'),
    p_inspection_date: inspection.inspectionDate,
    p_location_capture_status: inspection.locationCaptureStatus,
    p_result: inspection.result,
    p_findings: toJson(mapBackendFindings(backendFindings)),
    p_safe_water_supply: toJson(inspection.safeWaterSupply),
    p_sanitation_facility: toJson(inspection.sanitationFacility),
    p_remarks: inspection.remarks,
    ...(inspection.inspectionLocation
      ? { p_inspection_location: toJson(inspection.inspectionLocation) }
      : {}),
    ...(inspection.locationCaptureAttemptedAt
      ? {
          p_location_capture_attempted_at:
            inspection.locationCaptureAttemptedAt,
        }
      : {}),
    ...(inspection.reinspectionId
      ? { p_reinspection_id: inspection.reinspectionId }
      : {}),
    ...(inspection.reinspectionOfInspectionId
      ? {
          p_reinspection_of_inspection_id:
            inspection.reinspectionOfInspectionId,
        }
      : {}),
  };

  return args;
}

export function mapReinspectionToInsert(
  record: ReinspectionRecord
): TablesInsert<'reinspections'> {
  return {
    id: requireText(record.id, 'Reinspection ID'),
    bsi_uid: record.bsiUid,
    barangay_id: record.barangayId,
    original_inspection_id: requireText(
      record.originalInspectionId,
      'Original inspection ID'
    ),
    place_id: requireText(record.placeId, 'Place ID'),
    scheduled_date: record.scheduledDate,
    status: record.status,
    created_at: record.createdAt,
    completed_at: record.completedAt ?? null,
    completed_inspection_id: record.completedInspectionId ?? null,
    synced_at: new Date().toISOString(),
  };
}

export function mapSupabaseReinspection(
  row: SupabaseReinspectionRow
): ReinspectionRecord {
  if (row.status !== 'pending' && row.status !== 'completed') {
    throw new Error(`Unsupported reinspection status: ${row.status}`);
  }

  return {
    id: row.id,
    bsiUid: row.bsi_uid,
    barangayId: row.barangay_id,
    originalInspectionId: row.original_inspection_id,
    placeId: row.place_id,
    scheduledDate: row.scheduled_date,
    status: row.status,
    createdAt: row.created_at,
    ...(row.completed_at ? { completedAt: row.completed_at } : {}),
    ...(row.completed_inspection_id
      ? { completedInspectionId: row.completed_inspection_id }
      : {}),
  };
}
