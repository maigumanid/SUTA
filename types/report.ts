import type { InspectionRecord } from '@/types/inspectionRecord';
import type { RiskLevel } from '@/types/place';

export type ReportKind = 'current_register' | 'place_history' | 'municipal_summary';
export type BsiReportKind = Exclude<ReportKind, 'municipal_summary'>;
type LegacyReportLayoutKind =
  | 'municipal_summary'
  | 'inspection_results'
  | 'priority_places'
  | 'reinspections'
  | 'my_activity'
  | 'assigned_barangay_summary'
  | 'pending_reinspections'
  | 'priority_follow_up';
export type ReportLayoutKind = ReportKind | LegacyReportLayoutKind;

export type ReportFilters = {
  startDate?: string;
  endDate?: string;
  barangayId: string;
  purok: string;
  placeId: string;
  bsiId: string;
  placeType: string;
  result: string;
  riskLevel: string;
  inspectionType: string;
  reinspectionStatus: string;
};

export const DEFAULT_REPORT_FILTERS: ReportFilters = {
  barangayId: 'all',
  purok: 'all',
  placeId: 'all',
  bsiId: 'all',
  placeType: 'all',
  result: 'all',
  riskLevel: 'all',
  inspectionType: 'all',
  reinspectionStatus: 'all',
};

export type CurrentInspectionType = 'Initial Inspection' | 'Inspection' | 'Reinspection' | 'Not Yet Inspected';

export type CurrentSanitationRow = {
  placeId: string;
  placeName: string;
  representativeName: string;
  placeType: string;
  address: string;
  purok: string;
  barangayId: string;
  barangayName: string;
  inspectionId?: string;
  inspectionDate?: string;
  inspectionType: CurrentInspectionType;
  bsiId?: string;
  bsiName?: string;
  result: string;
  riskLevel: RiskLevel;
  riskPercentage: number | null;
  reinspectionStatus: string;
  reinspectionScheduledDate?: string;
  findingsCount: number;
  hasRemarks: boolean;
};

export type ReportInspectionRow = {
  id: string;
  placeId: string;
  placeName: string;
  representativeName: string;
  placeType: string;
  address: string;
  purok: string;
  barangayId: string;
  barangayName: string;
  bsiId: string;
  bsiName: string;
  inspectionDate: string;
  inspectionType: 'Initial Inspection' | 'Inspection' | 'Reinspection';
  result: string;
  riskLevel: RiskLevel;
  riskPercentage: number | null;
  reinspectionStatus?: string;
  reinspectionScheduledDate?: string;
  findingsCount: number;
  hasRemarks: boolean;
};

export type BarangayCurrentSummaryRow = {
  barangayId: string;
  barangayName: string;
  registeredPlaces: number;
  placesWithInspectionData: number;
  compliant: number;
  nonCompliant: number;
  lowRisk: number;
  moderateRisk: number;
  highRisk: number;
  forReinspection: number;
  pendingReinspections: number;
  overdueReinspections: number;
};

export type CurrentRegisterSummary = {
  places: number;
  inspected: number;
  notYetInspected: number;
  compliant: number;
  nonCompliant: number;
  lowRisk: number;
  moderateRisk: number;
  highRisk: number;
  forReinspection: number;
  pendingReinspections: number;
  overdueReinspections: number;
  completedReinspections: number;
};

export type MunicipalCurrentSummary = {
  rows: BarangayCurrentSummaryRow[];
  currentRows: CurrentSanitationRow[];
  summary: CurrentRegisterSummary;
};

export type ReportPlaceOption = {
  id: string;
  name: string;
  purok: string;
  barangayId: string;
  barangayName: string;
};

export type PaginatedReport<T> = { rows: T[]; total: number; page: number; pageSize: number };
export type ReportMetric = { label: string; value: string };
export type ReportLink = { kind: 'inspection' | 'bsi'; id: string };
export type ReportSection = {
  title: string;
  columns: string[];
  rows: string[][];
  columnWidths?: number[];
  rowLinks?: (ReportLink | null)[];
  emptyMessage?: string;
  displayedCount?: number;
  totalCount?: number;
};

export type ReportViewModel = {
  title: string;
  jurisdiction: string;
  officeLabel: string;
  reportingPeriod: string;
  generatedAt: string;
  scope: string[];
  metrics: ReportMetric[];
  highlights: string[];
  sections: ReportSection[];
  exportedCount?: number;
  totalCount?: number;
  countLabel?: string;
  isPreview?: boolean;
  previewPage?: number;
  previewPageSize?: number;
  orientation: 'portrait' | 'landscape';
  inspectionRecords?: InspectionRecord[];
  recordRows?: (CurrentSanitationRow | ReportInspectionRow)[];
  layoutKind: ReportLayoutKind;
  /** Retained for compatibility with the superseded Phase 9 matrix helper. */
  includeChecklistAppendix?: boolean;
  includePhotoEvidence?: boolean;
  generatedBy: 'admin' | 'bsi';
  preparedBy?: string;
};
