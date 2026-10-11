import type {
  CurrentSanitationRow,
  MunicipalCurrentSummary,
  ReportFilters,
  ReportInspectionRow,
  ReportSection,
  ReportViewModel,
} from '@/types/report';
import { summarizeCurrentRows } from '@/services/reportService';
import { formatLocalDate, formatLocalDateTime } from '@/utils/dateTime';

export const resultLabel = (value: string) =>
  value === 'non_compliant' ? 'Non-Compliant'
    : value === 'for_reinspection' ? 'For Reinspection'
      : value === 'compliant' ? 'Compliant'
        : value === 'not_yet_inspected' ? 'Not Yet Inspected'
          : value;
export const riskLabel = (value: string) => value === 'Unclassified' ? 'Unclassified' : `${value} Risk`;
export const percentage = (value: number | null) => value === null ? 'Not available' : `${Math.round(value)}%`;

const reportingPeriod = (filters: ReportFilters) => filters.startDate || filters.endDate
  ? `${filters.startDate ? formatLocalDate(filters.startDate) : 'Earliest available record'} to ${filters.endDate ? formatLocalDate(filters.endDate) : 'Present'}`
  : 'All available dates';

export function reportScope(
  filters: ReportFilters,
  labels: { barangay: string; inspector: string; place?: string },
) {
  return [
    `Barangay: ${labels.barangay}`,
    `Purok: ${filters.purok === 'all' ? 'All' : filters.purok}`,
    ...(filters.placeId !== 'all' ? [`Place / Household: ${labels.place ?? filters.placeId}`] : []),
    ...(filters.bsiId !== 'all' ? [`Inspector: ${labels.inspector}`] : []),
    `Status: ${filters.result === 'all' ? 'All' : resultLabel(filters.result)}`,
    `Risk: ${filters.riskLevel === 'all' ? 'All' : riskLabel(filters.riskLevel)}`,
    `Reinspection: ${filters.reinspectionStatus === 'all' ? 'All' : filters.reinspectionStatus.replaceAll('_', ' ')}`,
    `Place type: ${filters.placeType === 'all' ? 'All' : filters.placeType}`,
    ...(filters.inspectionType !== 'all' ? [`Inspection type: ${filters.inspectionType === 'reinspection' ? 'Reinspection' : 'Initial / regular inspection'}`] : []),
  ];
}

function base(args: {
  title: string;
  jurisdiction: string;
  filters: ReportFilters;
  scope: string[];
  generatedBy: 'admin' | 'bsi';
  layoutKind: ReportViewModel['layoutKind'];
}): Omit<ReportViewModel, 'metrics' | 'highlights' | 'sections'> {
  return {
    title: args.title,
    jurisdiction: args.jurisdiction,
    officeLabel: 'Municipal/City Sanitation Office',
    reportingPeriod: reportingPeriod(args.filters),
    generatedAt: new Date().toISOString(),
    scope: args.scope,
    orientation: 'landscape',
    generatedBy: args.generatedBy,
    layoutKind: args.layoutKind,
  };
}

function currentRegisterSection(rows: CurrentSanitationRow[]): ReportSection {
  return {
    title: 'Current Place Register',
    columns: ['Place', 'Representative', 'Purok', 'Barangay', 'Address', 'Latest Date', 'Type', 'Inspector', 'Result', 'Risk', 'Reinspection', 'Findings', 'Remarks'],
    columnWidths: [10, 10, 5, 8, 12, 8, 8, 8, 7, 7, 8, 4, 5],
    rows: rows.map((row) => [
      row.placeName,
      row.representativeName.trim() || '—',
      row.purok || 'Not recorded',
      row.barangayName,
      row.address || 'Not recorded',
      formatLocalDateTime(row.inspectionDate, 'Not yet inspected'),
      row.inspectionType,
      row.bsiName ?? 'Not yet assigned',
      resultLabel(row.result),
      row.inspectionId ? `${riskLabel(row.riskLevel)}${row.riskPercentage === null ? '' : ` (${percentage(row.riskPercentage)})`}` : 'Not yet classified',
      `${row.reinspectionStatus}${row.reinspectionScheduledDate ? ` · ${formatLocalDate(row.reinspectionScheduledDate)}` : ''}`,
      String(row.findingsCount),
      row.hasRemarks ? 'Yes' : 'None',
    ]),
    rowLinks: rows.map((row) => row.inspectionId ? { kind: 'inspection', id: row.inspectionId } : null),
    emptyMessage: 'No places matched the selected current-status filters.',
  };
}

export function currentRegisterTitle(filters: ReportFilters) {
  if (filters.purok !== 'all') return 'Purok Sanitary Inspection Register';
  if (filters.result !== 'all' || filters.riskLevel !== 'all' || filters.reinspectionStatus !== 'all') return 'Filtered Sanitary Inspection Register';
  return 'Barangay Sanitary Inspection Register';
}

export function buildCurrentRegisterViewModel(args: {
  title: string;
  jurisdiction: string;
  filters: ReportFilters;
  scope: string[];
  rows: CurrentSanitationRow[];
  total: number;
  generatedBy: 'admin' | 'bsi';
  isPreview?: boolean;
}): ReportViewModel {
  const summary = summarizeCurrentRows(args.rows);
  return {
    ...base({ ...args, layoutKind: 'current_register' }),
    exportedCount: args.rows.length,
    totalCount: args.total,
    countLabel: 'places',
    recordRows: args.rows,
    metrics: [
      { label: 'Places Included', value: String(args.total) },
      { label: args.isPreview ? 'Compliant Shown' : 'Compliant', value: String(summary.compliant) },
      { label: args.isPreview ? 'Non-Compliant Shown' : 'Non-Compliant', value: String(summary.nonCompliant) },
      { label: args.isPreview ? 'High Risk Shown' : 'High Risk', value: String(summary.highRisk) },
      { label: args.isPreview ? 'Overdue Shown' : 'Overdue', value: String(summary.overdueReinspections) },
      { label: args.isPreview ? 'Not Inspected Shown' : 'Not Yet Inspected', value: String(summary.notYetInspected) },
    ],
    highlights: [
      'One row represents one place and uses its latest completed inspection or reinspection.',
      'The complete export includes every supported checklist, testing, finding, remark, result, risk, and follow-up field in the same row as each place.',
    ],
    sections: [currentRegisterSection(args.rows)],
  };
}

function historySection(rows: ReportInspectionRow[]): ReportSection {
  return {
    title: 'Inspection History Timeline (Oldest to Newest)',
    columns: ['Date', 'Inspection Type', 'Representative', 'Inspector', 'Result', 'Risk', 'Reinspection', 'Findings', 'Remarks'],
    columnWidths: [12, 12, 15, 12, 10, 11, 14, 6, 8],
    rows: rows.map((row) => [
      formatLocalDateTime(row.inspectionDate),
      row.inspectionType,
      row.representativeName.trim() || '—',
      row.bsiName,
      resultLabel(row.result),
      `${riskLabel(row.riskLevel)}${row.riskPercentage === null ? '' : ` (${percentage(row.riskPercentage)})`}`,
      `${row.reinspectionStatus ?? 'Not applicable'}${row.reinspectionScheduledDate ? ` · ${formatLocalDate(row.reinspectionScheduledDate)}` : ''}`,
      String(row.findingsCount),
      row.hasRemarks ? 'Yes' : 'None',
    ]),
    rowLinks: rows.map((row) => ({ kind: 'inspection', id: row.id })),
    emptyMessage: 'No completed inspection history matched the selected filters.',
  };
}

export function buildPlaceHistoryViewModel(args: {
  title: string;
  jurisdiction: string;
  filters: ReportFilters;
  scope: string[];
  rows: ReportInspectionRow[];
  total: number;
  generatedBy: 'admin' | 'bsi';
  isPreview?: boolean;
}): ReportViewModel {
  return {
    ...base({ ...args, layoutKind: 'place_history' }),
    exportedCount: args.rows.length,
    totalCount: args.total,
    countLabel: 'inspection records',
    recordRows: args.rows,
    metrics: [
      { label: 'Inspection Events', value: String(args.total) },
      { label: args.isPreview ? 'Initial / Regular Shown' : 'Initial / Regular', value: String(args.rows.filter((row) => row.inspectionType !== 'Reinspection').length) },
      { label: args.isPreview ? 'Reinspections Shown' : 'Reinspections', value: String(args.rows.filter((row) => row.inspectionType === 'Reinspection').length) },
      { label: args.isPreview ? 'Last Shown Result' : 'Latest Result', value: args.rows.length ? resultLabel(args.rows.at(-1)!.result) : 'No records' },
    ],
    highlights: ['History is ordered from oldest to newest so changes and follow-up outcomes read as a clear audit trail.'],
    sections: [historySection(args.rows)],
  };
}

export function buildMunicipalSummaryViewModel(args: {
  title: string;
  jurisdiction: string;
  filters: ReportFilters;
  scope: string[];
  data: MunicipalCurrentSummary;
}): ReportViewModel {
  const priority = args.data.currentRows
    .filter((row) => row.riskLevel === 'High' || row.result === 'non_compliant' || row.reinspectionStatus === 'Overdue')
    .sort((a, b) => Number(b.reinspectionStatus === 'Overdue') - Number(a.reinspectionStatus === 'Overdue')
      || Number(b.riskLevel === 'High') - Number(a.riskLevel === 'High')
      || (b.inspectionDate ?? '').localeCompare(a.inspectionDate ?? ''));
  const priorityPreview = priority.slice(0, 20);
  return {
    ...base({ ...args, generatedBy: 'admin', layoutKind: 'municipal_summary' }),
    exportedCount: args.data.rows.length,
    totalCount: args.data.summary.places,
    countLabel: 'current places',
    metrics: [
      { label: 'Registered Places', value: String(args.data.summary.places) },
      { label: 'With Inspection Data', value: String(args.data.summary.inspected) },
      { label: 'Compliant', value: String(args.data.summary.compliant) },
      { label: 'Non-Compliant', value: String(args.data.summary.nonCompliant) },
      { label: 'High Risk', value: String(args.data.summary.highRisk) },
      { label: 'Overdue Reinspections', value: String(args.data.summary.overdueReinspections) },
    ],
    highlights: [
      'Municipal counts use one current record per place, not inspection-event totals.',
      `Priority overview shows ${priorityPreview.length} of ${priority.length} current priority places; use Current Sanitation Register for complete record-level drilldown.`,
    ],
    sections: [
      {
        title: 'Barangay Current-Status Comparison',
        columns: ['Barangay', 'Places', 'Inspected', 'Compliant', 'Non-Compliant', 'Low', 'Moderate', 'High', 'For Reinspection', 'Pending', 'Overdue'],
        rows: args.data.rows.map((row) => [
          row.barangayName,
          String(row.registeredPlaces),
          String(row.placesWithInspectionData),
          String(row.compliant),
          String(row.nonCompliant),
          String(row.lowRisk),
          String(row.moderateRisk),
          String(row.highRisk),
          String(row.forReinspection),
          String(row.pendingReinspections),
          String(row.overdueReinspections),
        ]),
        emptyMessage: 'No barangay data matched the active filters.',
      },
      {
        title: `Priority / Overdue Overview (showing ${priorityPreview.length} of ${priority.length})`,
        columns: ['Place', 'Barangay', 'Purok', 'Latest Date', 'Result', 'Risk', 'Reinspection'],
        rows: priorityPreview.map((row) => [
          row.placeName,
          row.barangayName,
          row.purok,
          formatLocalDateTime(row.inspectionDate, 'Not inspected'),
          resultLabel(row.result),
          riskLabel(row.riskLevel),
          row.reinspectionStatus,
        ]),
        rowLinks: priorityPreview.map((row) => row.inspectionId ? { kind: 'inspection', id: row.inspectionId } : null),
        emptyMessage: 'No current high-risk, non-compliant, or overdue places matched the active filters.',
      },
    ],
  };
}
