export const PLACE_TYPES = [
  'Household / Residence',
  'Food Establishment',
  'Retail Establishment',
  'School',
  'Public Facility',
  'Church',
  'Other Facility',
] as const;

export type PlaceType = (typeof PLACE_TYPES)[number];

export function isSupportedPlaceType(value: unknown): value is PlaceType {
  return typeof value === 'string' && PLACE_TYPES.some((placeType) => placeType === value);
}

export type InspectionStatus =
  | 'Compliant'
  | 'Non-Compliant'
  | 'For Reinspection'
  | 'Not Inspected';

export type RiskLevel = 'Low' | 'Moderate' | 'High' | 'Unclassified';

export type PlaceProfileStatus = 'starter' | 'complete';
export type PlaceSourceKind = 'manual' | 'bulk_import';

export type Place = {
  id: string;

  barangayId: string;

  barangay?: string;

  createdByUid?: string;

  name: string;

  representativeName: string;

  contactNumber: string;

  address: string;

  purok: string;

  notes: string;

  placeType: PlaceType;

  status: InspectionStatus;

  riskLevel: RiskLevel;

  lastInspectionDate?: string;

  profileStatus: PlaceProfileStatus;

  sourceKind: PlaceSourceKind;

  importBatchId?: string;
};
