import { requireSupabase } from '@/services/supabase';
import { throwSupabaseServiceError } from '@/services/supabaseServiceError';
import type { InspectionRecord, InspectionRecordChecklistItem, InspectionRecordEvidence, InspectionRecordFinding } from '@/types/inspectionRecord';
import type { RiskLevel } from '@/types/place';
import type { Json } from '@/types/supabase';
import { formatLocalDate } from '@/utils/dateTime';

type JsonObject = { [key: string]: Json | undefined };
const objectValue = (value: Json | null): JsonObject | null => value && typeof value === 'object' && !Array.isArray(value) ? value : null;
const textValue = (value: Json | undefined) => typeof value === 'string' ? value : undefined;
const numberValue = (value: Json | undefined) => typeof value === 'number' ? value : undefined;
const booleanValue = (value: Json | undefined) => typeof value === 'boolean' ? value : undefined;
const yesNo = (value: boolean | undefined) => value === undefined ? 'Not recorded' : value ? 'Yes' : 'No';
const binary = (value: number | undefined, yes = 'Yes', no = 'No') => value === undefined ? 'N/A' : value === 1 ? yes : no;
const resultLabel = (value: string) => value === 'non_compliant' ? 'Non-Compliant' : value === 'for_reinspection' ? 'For Reinspection' : value === 'compliant' ? 'Compliant' : 'Not recorded';
const riskLevels: readonly RiskLevel[] = ['Low', 'Moderate', 'High', 'Unclassified'];
const riskLevel = (value: string): RiskLevel => riskLevels.find((item) => item === value) ?? 'Unclassified';
const readable = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

function waterSource(value?: string, other?: string) {
  if (value === 'level_1') return 'Level I — Point source';
  if (value === 'level_2') return 'Level II — Communal faucet system';
  if (value === 'level_3') return 'Level III — Individual connection';
  if (value === 'others') return other?.trim() ? `Other — ${other.trim()}` : 'Other source';
  return 'Not recorded';
}

function facility(sanitation: JsonObject | null) {
  const sanitary = textValue(sanitation?.sanitaryFacilityType);
  if (sanitary === 'septic_tank') return 'Septic tank';
  if (sanitary === 'sewer_system') return 'Sewer system';
  if (sanitary === 'vip_or_composting') return 'VIP latrine or composting toilet';
  const unsanitary = numberValue(sanitation?.unsanitaryToiletType);
  if (unsanitary === 3) return 'Water sealed connected to open drain';
  if (unsanitary === 2) return 'Overhung latrine';
  if (unsanitary === 1) return 'Open pit latrine';
  if (unsanitary === 0) return 'Without toilet';
  return 'Not recorded';
}

function disposal(value?: string) {
  if (value === 'onsite_treatment') return 'Stored and treated on-site';
  if (value === 'offsite_dislodging') return 'Transported and treated off-site';
  if (value === 'sewer_or_offsite_treatment') return 'Conveyed and treated off-site';
  return 'N/A';
}

function checklist(safeWater: Json, sanitationJson: Json) {
  const water = objectValue(safeWater); const microbial = objectValue(water?.microbialTest ?? null); const arsenic = objectValue(water?.arsenicTest ?? null); const sanitation = objectValue(sanitationJson);
  const microbialRecorded = booleanValue(microbial?.recorded); const arsenicConducted = booleanValue(arsenic?.conducted); const unsanitary = numberValue(sanitation?.unsanitaryToiletType);
  const safeWaterSupply: InspectionRecordChecklistItem[] = [
    { key: 'water_source', label: 'Primary water source', answer: waterSource(textValue(water?.waterSourceType), textValue(water?.otherWaterSource)) },
    { key: 'within_premises', label: 'Water source located within the premises', answer: yesNo(booleanValue(water?.locatedWithinPremises)) },
    { key: 'available_12h', label: 'Water available for at least 12 hours per day', answer: yesNo(booleanValue(water?.availableAtLeast12Hours)) },
    { key: 'microbial_test', label: 'Microbial test recorded', answer: yesNo(microbialRecorded) },
    { key: 'microbial_date', label: 'Microbial test date', answer: microbialRecorded ? formatLocalDate(textValue(microbial?.dateValidationDone), 'Not recorded') : 'N/A' },
    { key: 'ecoli_result', label: 'E. coli test result', answer: microbialRecorded ? binary(numberValue(microbial?.eColiResult), 'Presence detected', 'No presence detected') : 'N/A' },
    { key: 'arsenic_test', label: 'Arsenic test conducted', answer: yesNo(arsenicConducted) },
    { key: 'arsenic_date', label: 'Arsenic test date', answer: arsenicConducted ? formatLocalDate(textValue(arsenic?.dateTestingDone), 'Not recorded') : 'N/A' },
    { key: 'arsenic_result', label: 'Arsenic test result', answer: arsenicConducted ? binary(numberValue(arsenic?.result), 'Within allowable limit', 'Above allowable limit') : 'N/A' },
    { key: 'smdws', label: 'SMDWS', answer: binary(numberValue(water?.smdwsStatus)), derived: true },
  ];
  const sanitationFacility: InspectionRecordChecklistItem[] = [
    { key: 'facility_type', label: 'Toilet / sanitation facility type', answer: facility(sanitation) },
    { key: 'shared_toilet', label: 'Shared with other households', answer: unsanitary === undefined ? binary(numberValue(sanitation?.sharedWithOtherHouseholds)) : 'N/A' },
    { key: 'bsf', label: 'Basic Sanitation Facility', answer: binary(numberValue(sanitation?.basicSanitationFacility)), derived: true },
    { key: 'disposal_method', label: 'Excreta disposal / treatment method', answer: unsanitary === undefined ? disposal(textValue(sanitation?.excretaDisposalMethod)) : 'N/A' },
    { key: 'smss', label: 'SMSS', answer: binary(numberValue(sanitation?.smssStatus)), derived: true },
  ];
  return { safeWaterSupply, sanitationFacility };
}

function findings(value: Json): InspectionRecordFinding[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const item = objectValue(entry); if (!item) return [];
    const evidenceValue = item.evidence;
    const evidence: InspectionRecordEvidence[] = Array.isArray(evidenceValue) ? evidenceValue.flatMap((raw) => {
      const attachment = objectValue(raw); const storagePath = textValue(attachment?.storagePath); const id = textValue(attachment?.id);
      if (!storagePath || !id) return [];
      return [{ id, storagePath, mimeType: textValue(attachment?.mimeType) ?? 'image/jpeg' }];
    }) : [];
    const category = textValue(item.category) ?? 'other';
    return [{ category: category === 'safe_water_supply' ? 'Safe Water Supply' : category === 'sanitation' ? 'Sanitation' : readable(category), description: textValue(item.details)?.trim() || 'No description recorded.', evidence }];
  });
}

export async function fetchInspectionRecord(inspectionId: string): Promise<InspectionRecord> {
  const client = requireSupabase();
  const { data: inspection, error } = await client.from('inspections').select('*').eq('id', inspectionId).single();
  if (error) throwSupabaseServiceError('Load inspection record', error);
  const [placeResult, profileResult, earlierResult] = await Promise.all([
    client.from('places').select('name,place_type,address,purok,barangay_name,representative_name').eq('id', inspection.place_id).eq('barangay_id', inspection.barangay_id).single(),
    client.from('bsi_profiles').select('name').eq('id', inspection.bsi_uid).maybeSingle(),
    inspection.reinspection_id ? Promise.resolve({ count: 0, error: null }) : client.from('inspections').select('id', { count: 'exact', head: true }).eq('place_id', inspection.place_id).is('reinspection_id', null).is('reinspection_of_inspection_id', null).lt('inspection_date', inspection.inspection_date),
  ]);
  if (placeResult.error ?? profileResult.error ?? earlierResult.error) throwSupabaseServiceError('Load inspection record details', placeResult.error ?? profileResult.error ?? earlierResult.error);
  const linkedResult = await client.from('reinspections').select('id,original_inspection_id,scheduled_date,status,completed_at,completed_inspection_id').or(`id.eq.${inspection.reinspection_id ?? '__none__'},original_inspection_id.eq.${inspection.id}`).maybeSingle();
  if (linkedResult.error) throwSupabaseServiceError('Load inspection reinspection details', linkedResult.error);
  const linked = linkedResult.data;
  const relatedIds = [linked?.original_inspection_id, linked?.completed_inspection_id].filter((value): value is string => Boolean(value) && value !== inspection.id);
  const relatedResult = relatedIds.length ? await client.from('inspections').select('id,inspection_date,result').in('id', relatedIds) : { data: [], error: null };
  if (relatedResult.error) throwSupabaseServiceError('Load related inspection record', relatedResult.error);
  const related = new Map((relatedResult.data ?? []).map((item) => [item.id, item])); const place = placeResult.data; const location = objectValue(inspection.inspection_location); const mappedChecklist = checklist(inspection.safe_water_supply, inspection.sanitation_facility);
  const original = linked?.original_inspection_id === inspection.id ? inspection : linked ? related.get(linked.original_inspection_id) : undefined;
  const followUp = linked?.completed_inspection_id === inspection.id ? inspection : linked?.completed_inspection_id ? related.get(linked.completed_inspection_id) : undefined;
  return {
    id: inspection.id,
    placeName: place.name, placeType: place.place_type, registeredAddress: `${place.purok ? `${place.purok}, ` : ''}${place.address}`, barangayName: place.barangay_name ?? 'Barangay name unavailable', representativeName: place.representative_name,
    inspectionDate: inspection.inspection_date, inspectorName: profileResult.data?.name ?? 'Inspector name unavailable', inspectionType: inspection.reinspection_id ? 'Reinspection' : (earlierResult.count ?? 0) === 0 ? 'Initial Inspection' : 'Inspection', result: resultLabel(inspection.result), riskLevel: riskLevel(inspection.risk_level), riskPercentage: inspection.risk_percentage, criticalFailure: inspection.risk_critical_failure,
    locationStatus: readable(inspection.location_capture_status), ...(numberValue(location?.latitude) !== undefined ? { latitude: numberValue(location?.latitude) } : {}), ...(numberValue(location?.longitude) !== undefined ? { longitude: numberValue(location?.longitude) } : {}),
    ...mappedChecklist, findings: findings(inspection.findings), remarks: inspection.remarks.trim() || 'No remarks recorded.',
    reinspection: { required: inspection.result === 'for_reinspection' || Boolean(linked), status: linked ? readable(linked.status) : 'Not required', ...(linked?.scheduled_date ? { scheduledDate: linked.scheduled_date } : {}), ...(original ? { originalInspectionDate: original.inspection_date, originalResult: resultLabel(original.result) } : {}), ...(linked?.completed_at ? { completedDate: linked.completed_at } : {}), ...(followUp ? { followUpDate: followUp.inspection_date, followUpResult: resultLabel(followUp.result) } : {}) },
  };
}

export async function createInspectionEvidenceSignedUrl(storagePath: string) {
  const { data, error } = await requireSupabase().storage.from('inspection-evidence').createSignedUrl(storagePath, 300);
  if (error) throwSupabaseServiceError('Load private inspection evidence', error);
  return data.signedUrl;
}

export async function fetchInspectionRecords(inspectionIds: string[]) {
  const uniqueIds = [...new Set(inspectionIds.filter(Boolean))];
  const records: InspectionRecord[] = [];
  const concurrency = 4;
  for (let offset = 0; offset < uniqueIds.length; offset += concurrency) {
    const batch = uniqueIds.slice(offset, offset + concurrency);
    records.push(...await Promise.all(batch.map((id) => fetchInspectionRecord(id))));
  }
  return records;
}
