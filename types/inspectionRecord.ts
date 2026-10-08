import type { RiskLevel } from '@/types/place';

export type InspectionRecordChecklistKey = 'water_source' | 'within_premises' | 'available_12h' | 'microbial_test' | 'microbial_date' | 'ecoli_result' | 'arsenic_test' | 'arsenic_date' | 'arsenic_result' | 'smdws' | 'facility_type' | 'shared_toilet' | 'bsf' | 'disposal_method' | 'smss';

export const INSPECTION_RECORD_CHECKLIST_DEFINITIONS: readonly {
  key: InspectionRecordChecklistKey;
  label: string;
  shortLabel: string;
  group: 'Safe Water Supply' | 'Sanitation Facility';
}[] = [
  { key: 'water_source', label: 'Primary water source', shortLabel: 'Water Source', group: 'Safe Water Supply' },
  { key: 'within_premises', label: 'Water source located within the premises', shortLabel: 'Source in Premises', group: 'Safe Water Supply' },
  { key: 'available_12h', label: 'Water available for at least 12 hours per day', shortLabel: 'Water ≥12h', group: 'Safe Water Supply' },
  { key: 'microbial_test', label: 'Microbial test recorded', shortLabel: 'Microbial Test', group: 'Safe Water Supply' },
  { key: 'microbial_date', label: 'Microbial test date', shortLabel: 'Microbial Date', group: 'Safe Water Supply' },
  { key: 'ecoli_result', label: 'E. coli test result', shortLabel: 'E. coli', group: 'Safe Water Supply' },
  { key: 'arsenic_test', label: 'Arsenic test conducted', shortLabel: 'Arsenic Test', group: 'Safe Water Supply' },
  { key: 'arsenic_date', label: 'Arsenic test date', shortLabel: 'Arsenic Date', group: 'Safe Water Supply' },
  { key: 'arsenic_result', label: 'Arsenic test result', shortLabel: 'Arsenic Result', group: 'Safe Water Supply' },
  { key: 'smdws', label: 'Safely Managed Drinking Water Service', shortLabel: 'SMDWS', group: 'Safe Water Supply' },
  { key: 'facility_type', label: 'Toilet / sanitation facility type', shortLabel: 'Toilet Type', group: 'Sanitation Facility' },
  { key: 'shared_toilet', label: 'Shared with other households', shortLabel: 'Shared Toilet', group: 'Sanitation Facility' },
  { key: 'bsf', label: 'Basic Sanitation Facility', shortLabel: 'BSF', group: 'Sanitation Facility' },
  { key: 'disposal_method', label: 'Excreta disposal / treatment method', shortLabel: 'Disposal', group: 'Sanitation Facility' },
  { key: 'smss', label: 'Safely Managed Sanitation Service', shortLabel: 'SMSS', group: 'Sanitation Facility' },
];

export type InspectionRecordChecklistItem = {
  key: InspectionRecordChecklistKey;
  label: string;
  answer: string;
  derived?: boolean;
};

export type InspectionRecordEvidence = {
  id: string;
  storagePath: string;
  mimeType: string;
};

export type InspectionRecordFinding = {
  category: string;
  description: string;
  evidence: InspectionRecordEvidence[];
};

export type InspectionRecordReinspection = {
  required: boolean;
  status: string;
  scheduledDate?: string;
  originalInspectionDate?: string;
  originalResult?: string;
  completedDate?: string;
  followUpDate?: string;
  followUpResult?: string;
};

export type InspectionRecord = {
  id: string;
  placeName: string;
  placeType: string;
  purok: string;
  address: string;
  registeredAddress: string;
  barangayName: string;
  representativeName: string;
  inspectionDate: string;
  inspectorName: string;
  inspectionType: 'Initial Inspection' | 'Inspection' | 'Reinspection';
  result: string;
  riskLevel: RiskLevel;
  riskPercentage: number | null;
  criticalFailure: boolean;
  locationStatus: string;
  latitude?: number;
  longitude?: number;
  safeWaterSupply: InspectionRecordChecklistItem[];
  sanitationFacility: InspectionRecordChecklistItem[];
  findings: InspectionRecordFinding[];
  remarks: string;
  reinspection: InspectionRecordReinspection;
};

export type EmbeddedInspectionRecordEvidence = InspectionRecordEvidence & {
  dataUri?: string;
};

export type EmbeddedInspectionRecord = Omit<InspectionRecord, 'findings'> & {
  findings: (Omit<InspectionRecordFinding, 'evidence'> & {
    evidence: EmbeddedInspectionRecordEvidence[];
  })[];
};
