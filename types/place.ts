export type PlaceType =
  | 'Household / Residence'
  | 'Food Establishment'
  | 'Retail Establishment'
  | 'School'
  | 'Public Facility'
  | 'Church'
  | 'Other Facility';

export type InspectionStatus =
  | 'Compliant'
  | 'Non-Compliant'
  | 'For Reinspection'
  | 'Not Inspected';

export type RiskLevel = 'Low' | 'Medium' | 'High';

export type Place = {
  id: string;

  name: string;

  representativeName: string;

  address: string;

  purok: string;

  placeType: PlaceType;

  status: InspectionStatus;

  riskLevel: RiskLevel;

  lastInspectionDate?: string;
};
