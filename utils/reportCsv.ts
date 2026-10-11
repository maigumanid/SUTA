import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import type { ReportViewModel } from '@/types/report';
import { serializeCsvRows } from '@/utils/csvSerialization';
import { buildWideReportMatrix } from '@/utils/reportMatrix';

export const CURRENT_REGISTER_CSV_COLUMN_ORDER = [
  'No.',
  'Household / Place',
  'Household Representative',
  'Purok',
  'Address',
  'Barangay',
  'Result',
  'Risk',
  'Risk %',
  'Latest Inspection',
  'Inspection Type',
  'BSI',
  'Water Source',
  'Source in Premises',
  'Water ≥12h',
  'Microbial Test',
  'Microbial Date',
  'E. coli',
  'Arsenic Test',
  'Arsenic Date',
  'Arsenic Result',
  'SMDWS',
  'Toilet Type',
  'Shared Toilet',
  'BSF',
  'Disposal',
  'SMSS',
  'Findings',
  'Remarks',
  'Reinspection Required',
  'Reinspection Schedule',
  'Reinspection Status',
  'Follow-up / Completion',
  'Evidence Count',
] as const;

export const PLACE_HISTORY_CSV_COLUMN_ORDER = [
  'No.',
  'Household / Place',
  'Household Representative',
  'Purok',
  'Address',
  'Inspection Date',
  'Inspection Type',
  'BSI',
  'Result',
  'Risk',
  'Risk %',
  'Water Source',
  'Source in Premises',
  'Water ≥12h',
  'Microbial Test',
  'Microbial Date',
  'E. coli',
  'Arsenic Test',
  'Arsenic Date',
  'Arsenic Result',
  'SMDWS',
  'Toilet Type',
  'Shared Toilet',
  'BSF',
  'Disposal',
  'SMSS',
  'Findings',
  'Remarks',
  'Reinspection Required',
  'Reinspection Schedule',
  'Reinspection Status',
  'Follow-up / Completion',
  'Evidence Count',
] as const;

export const MUNICIPAL_SUMMARY_CSV_COLUMN_ORDER = [
  'Barangay',
  'Total Registered Places',
  'Inspected',
  'Compliant',
  'Non-Compliant',
  'Low Risk',
  'Moderate Risk',
  'High Risk',
  'For Reinspection',
  'Pending Reinspections',
  'Overdue Reinspections',
] as const;

const SUMMARY_SOURCE_COLUMNS = [
  'Barangay',
  'Places',
  'Inspected',
  'Compliant',
  'Non-Compliant',
  'Low',
  'Moderate',
  'High',
  'For Reinspection',
  'Pending',
  'Overdue',
] as const;

function safeFilenamePart(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'Scope';
}

export function currentRegisterCsvFilename(report: ReportViewModel) {
  const barangayScope = report.scope
    .find((item) => item.startsWith('Barangay:'))
    ?.slice('Barangay:'.length)
    .trim();
  const scope = !barangayScope || barangayScope === 'All barangays'
    ? 'Municipality'
    : barangayScope;
  return `SUTA_Current_Sanitation_Register_${safeFilenamePart(scope)}_${report.generatedAt.slice(0, 10)}.csv`;
}

function reportScopePart(report: ReportViewModel) {
  const placeScope = report.scope
    .find((item) => item.startsWith('Place / Household:'))
    ?.slice('Place / Household:'.length)
    .trim();
  if (placeScope) return placeScope;

  const barangayScope = report.scope
    .find((item) => item.startsWith('Barangay:'))
    ?.slice('Barangay:'.length)
    .trim();
  return !barangayScope || barangayScope === 'All barangays'
    ? 'Municipality'
    : barangayScope;
}

export function reportCsvFilename(report: ReportViewModel) {
  if (report.layoutKind === 'current_register') return currentRegisterCsvFilename(report);
  const date = report.generatedAt.slice(0, 10);
  const scope = safeFilenamePart(reportScopePart(report));
  if (report.layoutKind === 'place_history') {
    return `SUTA_Place_Inspection_History_${scope}_${date}.csv`;
  }
  if (report.layoutKind === 'municipal_summary') {
    return `SUTA_Municipal_Consolidated_Summary_${scope}_${date}.csv`;
  }
  throw new Error('CSV export is not available for this report type.');
}

function buildWideCsv(report: ReportViewModel, columnOrder: readonly string[]) {
  const matrix = buildWideReportMatrix(report, report.inspectionRecords ?? []);
  const preferredPosition = new Map<string, number>(
    columnOrder.map((label, index) => [label, index])
  );
  const orderedIndexes = matrix.columns
    .map((column, index) => ({ index, position: preferredPosition.get(column.label) }))
    .sort((left, right) =>
      (left.position ?? Number.MAX_SAFE_INTEGER) -
      (right.position ?? Number.MAX_SAFE_INTEGER) || left.index - right.index
    )
    .map((item) => item.index);
  return serializeCsvRows([
    orderedIndexes.map((index) => matrix.columns[index].label),
    ...matrix.rows.map((row) => orderedIndexes.map((index) =>
      row.values[index] === '—' ? '' : row.values[index]
    )),
  ]);
}

export function buildCurrentRegisterCsv(report: ReportViewModel) {
  if (report.layoutKind !== 'current_register') {
    throw new Error('CSV export is available only for the Current Sanitation Register.');
  }
  return buildWideCsv(report, CURRENT_REGISTER_CSV_COLUMN_ORDER);
}

export function buildPlaceHistoryCsv(report: ReportViewModel) {
  if (report.layoutKind !== 'place_history') {
    throw new Error('This CSV builder requires a Place Inspection History report.');
  }
  return buildWideCsv(report, PLACE_HISTORY_CSV_COLUMN_ORDER);
}

export function buildMunicipalSummaryCsv(report: ReportViewModel) {
  if (report.layoutKind !== 'municipal_summary') {
    throw new Error('This CSV builder requires a Municipal/City Consolidated Summary report.');
  }
  const section = report.sections.find((item) => item.title === 'Barangay Current-Status Comparison');
  if (!section) throw new Error('The barangay summary data is unavailable.');

  const sourceIndexes = SUMMARY_SOURCE_COLUMNS.map((label) => section.columns.indexOf(label));
  if (sourceIndexes.some((index) => index < 0)) {
    throw new Error('The barangay summary data is incomplete.');
  }
  return serializeCsvRows([
    [...MUNICIPAL_SUMMARY_CSV_COLUMN_ORDER],
    ...section.rows.map((row) => sourceIndexes.map((index) =>
      row[index] === '—' ? '' : row[index]
    )),
  ]);
}

export function buildReportCsv(report: ReportViewModel) {
  if (report.layoutKind === 'current_register') return buildCurrentRegisterCsv(report);
  if (report.layoutKind === 'place_history') return buildPlaceHistoryCsv(report);
  if (report.layoutKind === 'municipal_summary') return buildMunicipalSummaryCsv(report);
  throw new Error('CSV export is not available for this report type.');
}

function csvDialogTitle(report: ReportViewModel) {
  if (report.layoutKind === 'current_register') return 'Export Current Sanitation Register';
  if (report.layoutKind === 'place_history') return 'Export Place Inspection History';
  return 'Export Municipal/City Consolidated Summary';
}

export async function shareReportCsv(report: ReportViewModel) {
  const filename = reportCsvFilename(report);
  const csv = buildReportCsv(report);

  if (Platform.OS === 'web') {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    return filename;
  }

  const file = new File(Paths.cache, filename);
  file.create({ overwrite: true });
  file.write(csv);
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('File sharing is not available on this device.');
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    UTI: 'public.comma-separated-values-text',
    dialogTitle: csvDialogTitle(report),
  });
  return filename;
}
