import type { RiskLevel } from '@/types/place';

export type InspectionRecordChecklistKey = 'water_source' | 'within_premises' | 'available_12h' | 'microbial_test' | 'microbial_date' | 'ecoli_result' | 'arsenic_test' | 'arsenic_date' | 'arsenic_result' | 'smdws' | 'facility_type' | 'shared_toilet' | 'bsf' | 'disposal_method' | 'smss';

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
