import type { InspectionRecord, InspectionRecordChecklistItem, InspectionRecordChecklistKey } from '@/types/inspectionRecord';
import type { ReportLayoutKind, ReportSection, ReportViewModel } from '@/types/report';
import { formatLocalDate, formatLocalDateTime } from '@/utils/dateTime';

export type MatrixColumn = { label: string; group: 'Record Information' | 'Safe Water Supply' | 'Sanitation Facility' | 'Assessment'; width: number };
export type MatrixRow = { inspectionId: string; values: string[] };
export type MatrixTable = { title: string; columns: MatrixColumn[]; rows: MatrixRow[] };
export type FindingsRow = { inspectionId: string; values: string[] };
export type RemarksRow = { inspectionId: string; values: string[] };

const answer = (items: InspectionRecordChecklistItem[], key: InspectionRecordChecklistKey) => items.find((item) => item.key === key)?.answer ?? 'Not recorded';
const compactRisk = (record: InspectionRecord) => record.riskLevel === 'Unclassified' ? 'Unclassified' : record.riskLevel;
const reinspectionStatus = (record: InspectionRecord) => record.reinspection.required ? record.reinspection.status : 'Not required';
const meaningfulRemarks = (remarks: string) => remarks.trim() && remarks.trim().toLowerCase() !== 'no remarks recorded.';

const identifiers: MatrixColumn[] = [
  { label: 'Place', group: 'Record Information', width: 16 },
  { label: 'Barangay', group: 'Record Information', width: 10 },
  { label: 'Inspection Date', group: 'Record Information', width: 10 },
];

const waterColumns: MatrixColumn[] = [
  { label: 'Water Source', group: 'Safe Water Supply', width: 10 },
  { label: 'Within Premises', group: 'Safe Water Supply', width: 7 },
  { label: '≥12h Available', group: 'Safe Water Supply', width: 7 },
  { label: 'Microbial Test', group: 'Safe Water Supply', width: 7 },
  { label: 'Microbial Date', group: 'Safe Water Supply', width: 8 },
  { label: 'E. coli', group: 'Safe Water Supply', width: 8 },
  { label: 'Arsenic Test', group: 'Safe Water Supply', width: 7 },
  { label: 'Arsenic Date', group: 'Safe Water Supply', width: 8 },
  { label: 'Arsenic Result', group: 'Safe Water Supply', width: 8 },
  { label: 'SMDWS', group: 'Safe Water Supply', width: 6 },
];

const sanitationAssessmentColumns: MatrixColumn[] = [
  { label: 'Place Type', group: 'Record Information', width: 8 },
  { label: 'Inspector', group: 'Record Information', width: 10 },
  { label: 'Inspection Type', group: 'Record Information', width: 8 },
  { label: 'Toilet / Facility Type', group: 'Sanitation Facility', width: 11 },
  { label: 'Shared Toilet', group: 'Sanitation Facility', width: 7 },
  { label: 'Disposal / Treatment', group: 'Sanitation Facility', width: 10 },
  { label: 'BSF', group: 'Sanitation Facility', width: 5 },
  { label: 'SMSS', group: 'Sanitation Facility', width: 5 },
  { label: 'Result', group: 'Assessment', width: 9 },
  { label: 'Risk', group: 'Assessment', width: 6 },
  { label: 'Risk %', group: 'Assessment', width: 5 },
  { label: 'Reinspection', group: 'Assessment', width: 7 },
  { label: 'Reinspection Status', group: 'Assessment', width: 9 },
];

const idValues = (record: InspectionRecord) => [record.placeName, record.barangayName, formatLocalDateTime(record.inspectionDate)];
const waterValues = (record: InspectionRecord) => [
  answer(record.safeWaterSupply, 'water_source'),
  answer(record.safeWaterSupply, 'within_premises'),
  answer(record.safeWaterSupply, 'available_12h'),
  answer(record.safeWaterSupply, 'microbial_test'),
  answer(record.safeWaterSupply, 'microbial_date'),
  answer(record.safeWaterSupply, 'ecoli_result'),
  answer(record.safeWaterSupply, 'arsenic_test'),
  answer(record.safeWaterSupply, 'arsenic_date'),
  answer(record.safeWaterSupply, 'arsenic_result'),
  answer(record.safeWaterSupply, 'smdws'),
];
const sanitationAssessmentValues = (record: InspectionRecord) => [
  record.placeType,
  record.inspectorName,
  record.inspectionType,
  answer(record.sanitationFacility, 'facility_type'),
  answer(record.sanitationFacility, 'shared_toilet'),
  answer(record.sanitationFacility, 'disposal_method'),
  answer(record.sanitationFacility, 'bsf'),
  answer(record.sanitationFacility, 'smss'),
  record.result,
  compactRisk(record),
  record.riskPercentage === null ? 'N/A' : `${Math.round(record.riskPercentage)}%`,
  record.reinspection.required ? 'Yes' : 'No',
  reinspectionStatus(record),
];

function pair(titlePrefix: string, records: InspectionRecord[]): MatrixTable[] {
  return [
    { title: `${titlePrefix}Safe Water Supply Checklist`, columns: [...identifiers, ...waterColumns], rows: records.map((record) => ({ inspectionId: record.id, values: [...idValues(record), ...waterValues(record)] })) },
    { title: `${titlePrefix}Sanitation Facility & Assessment`, columns: [...identifiers, ...sanitationAssessmentColumns], rows: records.map((record) => ({ inspectionId: record.id, values: [...idValues(record), ...sanitationAssessmentValues(record)] })) },
  ];
}

export function buildMatrixTables(records: InspectionRecord[], layoutKind?: ReportLayoutKind): MatrixTable[] {
  if (layoutKind === 'reinspections' || layoutKind === 'pending_reinspections') {
    const originals = records.filter((record) => record.inspectionType !== 'Reinspection');
    const followUps = records.filter((record) => record.inspectionType === 'Reinspection');
    return [...pair('Original Inspection — ', originals), ...pair('Follow-up Inspection — ', followUps)];
  }
  return pair('', records);
}

export function buildFindingsRows(records: InspectionRecord[]): FindingsRow[] {
  return records.flatMap((record) => record.findings.map((finding, index) => ({ inspectionId: record.id, values: [String(index + 1), record.placeName, formatLocalDateTime(record.inspectionDate), record.inspectionType, finding.category, finding.description, meaningfulRemarks(record.remarks) ? record.remarks : '—', String(finding.evidence.length)] })));
}

export function buildRemarksRows(records: InspectionRecord[]): RemarksRow[] {
  return records.filter((record) => meaningfulRemarks(record.remarks)).map((record) => ({ inspectionId: record.id, values: [record.placeName, formatLocalDateTime(record.inspectionDate), record.inspectionType, record.remarks] }));
}

export const FINDINGS_COLUMNS = ['#', 'Place', 'Inspection Date', 'Record Type', 'Category', 'Finding / Observation', 'Remarks', 'Evidence Count'];
export const REMARKS_COLUMNS = ['Place', 'Inspection Date', 'Record Type', 'Remarks'];
export const MATRIX_LEGEND = ['SMDWS — Safely Managed Drinking Water Service', 'BSF — Basic Sanitation Facility', 'SMSS — Safely Managed Sanitation Service', 'N/A — Not Applicable'];

export type ConsolidatedPart = { number: number; title: string; sections?: ReportSection[]; tables?: MatrixTable[] };

export function buildConsolidatedParts(report: ReportViewModel) {
  const tables = buildMatrixTables(report.inspectionRecords ?? [], report.layoutKind);
  const municipal = report.layoutKind === 'municipal_summary';
  const reinspection = report.layoutKind === 'reinspections' || report.layoutKind === 'pending_reinspections';
  const duplicateSectionTitles = new Set(['Inspection Register', 'Recent Inspections']);
  const summarySections = report.sections.filter((section) => !duplicateSectionTitles.has(section.title) && (!municipal || section.title !== 'Barangay Summary'));
  const parts: ConsolidatedPart[] = [{ number: 1, title: municipal ? 'Executive Summary' : report.layoutKind === 'barangay_summary' || report.layoutKind === 'assigned_barangay_summary' ? 'Barangay Summary' : report.layoutKind === 'priority_places' ? 'Priority Summary' : report.layoutKind === 'reinspections' || report.layoutKind === 'pending_reinspections' ? 'Reinspection Case Summary' : report.layoutKind === 'bsi_activity' ? 'BSI Activity Summary' : 'Report Scope / Totals', sections: summarySections }];
  let next = 2;
  if (municipal) {
    parts.push({ number: next, title: 'Barangay Summary', sections: report.sections.filter((section) => section.title === 'Barangay Summary') });
    next += 1;
  }
  if (reinspection) {
    parts.push({ number: next, title: 'Original Inspection Matrix', tables: tables.filter((table) => table.title.startsWith('Original Inspection')) });
    parts.push({ number: next + 1, title: 'Follow-up Inspection Matrix', tables: tables.filter((table) => table.title.startsWith('Follow-up Inspection')) });
    next += 2;
  } else {
    parts.push({ number: next, title: 'Inspection Checklist Matrix', tables });
    next += 1;
  }
  return { parts, findingsPart: next, remarksPart: next + 1, evidencePart: next + 2 };
}

export function evidenceGroupLabel(record: InspectionRecord) {
  return `${record.placeName} · ${formatLocalDate(record.inspectionDate)} · ${record.inspectionType}`;
}
