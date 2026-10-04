import type { Json, Tables } from '@/types/supabase';
import type { RiskLevel } from '@/types/place';

export type BarangayOption = { id: string; name: string };

export type AdminDashboardMetrics = {
  activeBsis: number;
  registeredPlaces: number;
  inspections: number;
  compliant: number;
  nonCompliant: number;
  forReinspection: number;
  pendingReinspections: number;
  inspectionsThisMonth: number;
};

export type AdminBsiSummary = {
  id: string;
  name: string;
  email: string;
  contactNumber: string;
  barangayId: string;
  barangayName: string;
  active: boolean;
  inspectionCount: number;
  lastInspectionDate?: string;
  pendingReinspections: number;
};

export type AdminInspectionSummary = {
  id: string;
  placeId: string;
  placeName: string;
  barangayId: string;
  barangayName: string;
  bsiId: string;
  bsiName: string;
  inspectionDate: string;
  result: string;
  inspectionType: 'inspection' | 'reinspection';
  reinspectionStatus?: string;
  riskLevel: RiskLevel;
  riskPercentage: number | null;
  criticalFailure: boolean;
};

export type AdminInspectionDetail = AdminInspectionSummary & {
  address: string;
  purok: string;
  remarks: string;
  location: Json | null;
  safeWaterSupply: Json;
  sanitationFacility: Json;
  findings: Json;
  reinspectionOfInspectionId: string | null;
  riskEarnedPoints: number;
  riskMaximumPoints: number;
  riskEvaluatedItems: number;
};

export type CreateBsiInput = {
  name: string;
  email: string;
  contactNumber: string;
  barangayId: string;
  barangayName: string;
  temporaryPassword: string;
};

export type AdminAuditEvent = Tables<'admin_audit_log'>;
