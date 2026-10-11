import {
  INSPECTION_RECORD_CHECKLIST_DEFINITIONS,
  type EmbeddedInspectionRecord,
  type InspectionRecord,
  type InspectionRecordChecklistItem,
  type InspectionRecordChecklistKey,
} from '@/types/inspectionRecord';
import type { CurrentSanitationRow, ReportInspectionRow, ReportViewModel } from '@/types/report';
import { formatLocalDate, formatLocalDateTime } from '@/utils/dateTime';

export type WideReportColumn = {
  label: string;
  group: 'Identity / Location' | 'Inspection' | 'Safe Water Supply' | 'Sanitation Facility' | 'Findings / Remarks' | 'Reinspection' | 'Evidence';
  className?: 'number' | 'identity' | 'date' | 'compact' | 'narrative';
};

export type WideReportRow = { inspectionId?: string; values: string[] };
export type WideReportMatrix = { columns: WideReportColumn[]; rows: WideReportRow[] };
export type EvidenceAppendixEntry = { rowNumber: number; record: EmbeddedInspectionRecord };

const isHistoryRow = (row: CurrentSanitationRow | ReportInspectionRow): row is ReportInspectionRow => 'id' in row;
const rowInspectionId = (row: CurrentSanitationRow | ReportInspectionRow) => isHistoryRow(row) ? row.id : row.inspectionId;
const answer = (items: InspectionRecordChecklistItem[], key: InspectionRecordChecklistKey) =>
  items.find((item) => item.key === key)?.answer ?? 'N/A';
const compactAnswer = (value: string) => {
  if (value === 'Presence detected') return 'Unsafe';
  if (value === 'No presence detected') return 'Safe';
  if (value === 'Within allowable limit') return 'Safe';
  if (value === 'Above allowable limit') return 'Unsafe';
  if (value === 'Not recorded') return 'N/A';
  return value;
};
const findings = (record?: InspectionRecord) => {
  if (!record?.findings.length) return 'None';
  return record.findings.map((item) => `${item.category}: ${item.description}`).join('; ');
};
const evidenceCount = (record?: InspectionRecord) =>
  record?.findings.reduce((total, item) => total + item.evidence.length, 0) ?? 0;
const result = (row: CurrentSanitationRow | ReportInspectionRow, record?: InspectionRecord) =>
  record?.result ?? (row.result === 'compliant' ? 'Compliant' : row.result === 'non_compliant' ? 'Non-Compliant' : row.result === 'for_reinspection' ? 'For Reinspection' : 'Not Yet Inspected');
const risk = (row: CurrentSanitationRow | ReportInspectionRow, record?: InspectionRecord) =>
  record?.riskLevel === 'Unclassified' || (!record && row.riskLevel === 'Unclassified') ? 'Unclassified' : record?.riskLevel ?? row.riskLevel;
const percentage = (row: CurrentSanitationRow | ReportInspectionRow, record?: InspectionRecord) => {
  const value = record?.riskPercentage ?? row.riskPercentage;
  return value === null ? 'N/A' : `${Math.round(value)}%`;
};
const completionDate = (record?: InspectionRecord) =>
  record?.reinspection.followUpDate
    ? formatLocalDate(record.reinspection.followUpDate)
    : record?.reinspection.completedDate
      ? formatLocalDate(record.reinspection.completedDate)
      : 'N/A';

function hasSingleAdminScope(report: ReportViewModel, label: 'Barangay' | 'Inspector') {
  return report.generatedBy === 'admin' && report.scope.some((item) =>
    item.startsWith(`${label}:`) && !item.endsWith('All barangays') && !item.endsWith('All BSIs')
  );
}

function identityColumns(report: ReportViewModel): WideReportColumn[] {
  if (report.layoutKind === 'place_history') {
    return [
      { label: 'No.', group: 'Identity / Location', className: 'number' },
      { label: 'Place', group: 'Identity / Location', className: 'identity' },
      { label: 'Representative', group: 'Identity / Location', className: 'identity' },
      { label: 'Purok', group: 'Identity / Location', className: 'compact' },
      { label: 'Address', group: 'Identity / Location', className: 'identity' },
      { label: 'Inspection Date', group: 'Inspection', className: 'date' },
      { label: 'Inspection Type', group: 'Inspection', className: 'compact' },
      ...(report.generatedBy === 'admin' && !hasSingleAdminScope(report, 'Inspector')
        ? [{ label: 'BSI', group: 'Inspection' as const, className: 'identity' as const }]
        : []),
    ];
  }
  const includeBarangay = report.generatedBy === 'admin' && !hasSingleAdminScope(report, 'Barangay');
  const includeInspector = report.generatedBy === 'admin' && !hasSingleAdminScope(report, 'Inspector');
  return [
    { label: 'No.', group: 'Identity / Location', className: 'number' },
    { label: 'Place', group: 'Identity / Location', className: 'identity' },
    { label: 'Representative', group: 'Identity / Location', className: 'identity' },
    { label: 'Purok', group: 'Identity / Location', className: 'compact' },
    { label: 'Address', group: 'Identity / Location', className: 'identity' },
    ...(includeBarangay ? [{ label: 'Barangay', group: 'Identity / Location' as const, className: 'identity' as const }] : []),
    { label: 'Latest Inspection', group: 'Inspection', className: 'date' },
    { label: 'Inspection Type', group: 'Inspection', className: 'compact' },
    ...(includeInspector ? [{ label: 'BSI', group: 'Inspection' as const, className: 'identity' as const }] : []),
  ];
}

const assessmentColumns: WideReportColumn[] = [
  { label: 'Result', group: 'Inspection', className: 'compact' },
  { label: 'Risk', group: 'Inspection', className: 'compact' },
  { label: 'Risk %', group: 'Inspection', className: 'compact' },
];
const checklistColumns: WideReportColumn[] = INSPECTION_RECORD_CHECKLIST_DEFINITIONS.map((item) => ({
  label: item.shortLabel,
  group: item.group,
  className: item.key.includes('date') ? 'date' : 'compact',
}));
const finalColumns: WideReportColumn[] = [
  { label: 'Findings', group: 'Findings / Remarks', className: 'narrative' },
  { label: 'Remarks', group: 'Findings / Remarks', className: 'narrative' },
  { label: 'Reinspection Required', group: 'Reinspection', className: 'compact' },
  { label: 'Reinspection Schedule', group: 'Reinspection', className: 'date' },
  { label: 'Reinspection Status', group: 'Reinspection', className: 'compact' },
  { label: 'Follow-up / Completion', group: 'Reinspection', className: 'date' },
  { label: 'Evidence Count', group: 'Evidence', className: 'compact' },
];

export function buildWideReportMatrix(report: ReportViewModel, records: InspectionRecord[]): WideReportMatrix {
  const recordById = new Map(records.map((record) => [record.id, record]));
  const sourceRows = report.recordRows ?? [];
  const columns = [...identityColumns(report), ...assessmentColumns, ...checklistColumns, ...finalColumns];
  const rows = sourceRows.map((source, index) => {
    const inspectionId = rowInspectionId(source);
    const record = inspectionId ? recordById.get(inspectionId) : undefined;
    const identity = report.layoutKind === 'place_history'
      ? [
        String(index + 1),
        record?.placeName ?? source.placeName,
        record?.representativeName?.trim() || '—',
        record?.purok ?? source.purok,
        record?.address ?? source.address,
        formatLocalDateTime(record?.inspectionDate ?? source.inspectionDate),
        record?.inspectionType ?? source.inspectionType,
        ...(report.generatedBy === 'admin' && !hasSingleAdminScope(report, 'Inspector') ? [record?.inspectorName ?? source.bsiName ?? 'N/A'] : []),
      ]
      : [
        String(index + 1),
        record?.placeName ?? source.placeName,
        record?.representativeName?.trim() || '—',
        record?.purok ?? source.purok,
        record?.address ?? source.address,
        ...(report.generatedBy === 'admin' && !hasSingleAdminScope(report, 'Barangay') ? [record?.barangayName ?? source.barangayName] : []),
        formatLocalDateTime(record?.inspectionDate ?? source.inspectionDate, 'Not Yet Inspected'),
        record?.inspectionType ?? source.inspectionType,
        ...(report.generatedBy === 'admin' && !hasSingleAdminScope(report, 'Inspector') ? [record?.inspectorName ?? source.bsiName ?? 'N/A'] : []),
      ];
    const checklist = INSPECTION_RECORD_CHECKLIST_DEFINITIONS.map((definition) => {
      if (!record) return 'N/A';
      const items = definition.group === 'Safe Water Supply' ? record.safeWaterSupply : record.sanitationFacility;
      return compactAnswer(answer(items, definition.key));
    });
    return {
      inspectionId,
      values: [
        ...identity,
        result(source, record),
        risk(source, record),
        percentage(source, record),
        ...checklist,
        findings(record),
        record?.remarks ?? 'None',
        record ? (record.reinspection.required ? 'Yes' : 'No') : 'N/A',
        record?.reinspection.scheduledDate ? formatLocalDate(record.reinspection.scheduledDate) : 'N/A',
        record?.reinspection.status ?? source.reinspectionStatus ?? 'N/A',
        completionDate(record),
        String(evidenceCount(record)),
      ],
    };
  });
  return { columns, rows };
}

export function buildEvidenceAppendixEntries(
  report: ReportViewModel,
  records: EmbeddedInspectionRecord[],
): EvidenceAppendixEntry[] {
  const rowNumbers = new Map<string, number>();
  for (const [index, row] of (report.recordRows ?? []).entries()) {
    const id = rowInspectionId(row);
    if (id) rowNumbers.set(id, index + 1);
  }
  return records
    .filter((record) => evidenceCount(record) > 0)
    .map((record) => ({ rowNumber: rowNumbers.get(record.id) ?? 0, record }));
}

export function evidenceGroupLabel(record: InspectionRecord) {
  return `${record.placeName} · ${formatLocalDate(record.inspectionDate)} · ${record.inspectionType}`;
}
