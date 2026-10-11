import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import type { EmbeddedInspectionRecord } from '@/types/inspectionRecord';
import type { ReportSection, ReportViewModel } from '@/types/report';
import { formatLocalDateTime } from '@/utils/dateTime';
import { bsiReportSignatureHtml, embedInspectionRecordEvidence } from '@/utils/inspectionRecordPdf';
import {
  buildEvidenceAppendixEntries,
  buildWideReportMatrix,
  type WideReportColumn,
} from '@/utils/reportMatrix';

const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');

function sectionTable(section: ReportSection) {
  return `<section class="report-table"><h2>${escape(section.title)}</h2><table class="summary-table">${section.columnWidths ? `<colgroup>${section.columnWidths.map((width) => `<col style="width:${width}%">`).join('')}</colgroup>` : ''}<tbody class="table-heading"><tr>${section.columns.map((item) => `<th>${escape(item)}</th>`).join('')}</tr></tbody><tbody>${section.rows.length ? section.rows.map((row) => `<tr>${row.map((cell) => `<td>${escape(cell || '—')}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${Math.max(1, section.columns.length)}" class="empty">${escape(section.emptyMessage ?? 'No records matched the selected filters.')}</td></tr>`}</tbody></table></section>`;
}

function columnClass(column: WideReportColumn) {
  return column.className ? ` class="${column.className}"` : '';
}

function wideRegisterHtml(report: ReportViewModel) {
  const matrix = buildWideReportMatrix(report, report.inspectionRecords ?? []);
  const groups: { label: string; count: number }[] = [];
  for (const column of matrix.columns) {
    const previous = groups.at(-1);
    if (previous?.label === column.group) previous.count += 1;
    else groups.push({ label: column.group, count: 1 });
  }
  return `<section class="wide-register"><h2>${escape(report.layoutKind === 'place_history' ? 'Inspection / Reinspection History' : 'Current Sanitation Register')}</h2><table class="matrix-table"><tbody class="table-heading"><tr class="group-row">${groups.map((group) => `<th colspan="${group.count}">${escape(group.label)}</th>`).join('')}</tr><tr>${matrix.columns.map((column) => `<th${columnClass(column)}>${escape(column.label)}</th>`).join('')}</tr></tbody><tbody>${matrix.rows.length ? matrix.rows.map((row) => `<tr>${row.values.map((cell, index) => `<td${columnClass(matrix.columns[index])}>${escape(cell || '—')}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${matrix.columns.length}" class="empty">No records matched the selected filters.</td></tr>`}</tbody></table></section>`;
}

function photoAppendixHtml(report: ReportViewModel, records: EmbeddedInspectionRecord[]) {
  const entries = buildEvidenceAppendixEntries(report, records);
  if (!entries.length) return '<section class="photo-appendix"><h1>Photo Evidence Appendix</h1><p class="empty">No photo evidence is attached to the included records.</p></section>';
  return `<section class="photo-appendix"><h1>Photo Evidence Appendix</h1>${entries.map(({ rowNumber, record }) => {
    let photoNumber = 0;
    const evidence = record.findings.flatMap((finding) => finding.evidence.map((item) => {
      photoNumber += 1;
      const hasSpecificAssociation = Boolean(finding.category.trim() && finding.description.trim() && finding.description !== 'No description recorded.');
      const category = hasSpecificAssociation ? finding.category : 'General Inspection Evidence';
      const description = hasSpecificAssociation ? finding.description : 'General Inspection Evidence';
      return {
      item,
        photoNumber,
        category,
        description,
      };
    }));
    return `<article class="evidence-entry"><div class="evidence-heading"><h2>Row ${rowNumber} — ${escape(record.placeName)}</h2><p><strong>Place:</strong> ${escape(record.placeName)} &nbsp; <strong>Inspection Date:</strong> ${escape(formatLocalDateTime(record.inspectionDate))}</p></div><div class="photos">${evidence.map(({ item, photoNumber: number, category, description }) => {
      const caption = `<figcaption><strong>Photo ${number}</strong><span><strong>Category:</strong> ${escape(category)}</span><span><strong>Finding:</strong> ${escape(description)}</span></figcaption>`;
      return item.dataUri ? `<figure><img src="${item.dataUri}">${caption}</figure>` : `<figure class="unavailable"><div>Evidence image unavailable</div>${caption}</figure>`;
    }).join('')}</div></article>`;
  }).join('')}</section>`;
}

export function buildReportHtml(report: ReportViewModel, embeddedRecords: EmbeddedInspectionRecord[]) {
  const recordLevel = report.layoutKind === 'current_register' || report.layoutKind === 'place_history';
  const body = recordLevel
    ? wideRegisterHtml(report)
    : `<div class="metrics">${report.metrics.map((item) => `<div class="metric"><strong>${escape(item.value)}</strong><span>${escape(item.label)}</span></div>`).join('')}</div>${report.highlights.length ? `<div class="highlights">${report.highlights.map((item) => `<p>• ${escape(item)}</p>`).join('')}</div>` : ''}${report.sections.map(sectionTable).join('')}`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A4 landscape; margin: 7mm 5mm 8mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, sans-serif; color: #17211f; font-size: 8px; line-height: 1.22; }
    .report-header { position: static; page-break-inside: avoid; page-break-after: avoid; text-align: center; border-bottom: 2px solid #075e5a; padding-bottom: 5px; margin-bottom: 6px; }
    .brand { margin: 0; color: #075e5a; font-size: 18px; letter-spacing: 1.5px; }
    .jurisdiction { margin: 1px 0; font-size: 10px; } .office { color: #5f6b68; margin: 1px 0; } .report-header h1 { font-size: 14px; margin: 4px 0 0; }
    .meta { page-break-inside: avoid; background: #eef7f5; border: 1px solid #c9ded9; padding: 5px; margin-bottom: 6px; columns: 3; column-gap: 8px; }
    .meta p { margin: 1px 0; break-inside: avoid; }
    h2 { color: #075e5a; font-size: 9px; margin: 6px 0 3px; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .table-heading { display: table-row-group; }
    tr { page-break-inside: avoid; }
    th, td { border: 0.35px solid #9ea9a6; vertical-align: top; overflow-wrap: anywhere; word-break: normal; }
    th { background: #075e5a; color: white; font-weight: 700; text-align: center; }
    .matrix-table { font-size: 5px; line-height: 1.1; }
    .matrix-table th, .matrix-table td { padding: 1.25px 1px; }
    .matrix-table .group-row th { background: #d9ece8; color: #075e5a; border-color: #8eaaa4; font-size: 5.3px; }
    .matrix-table .number { width: 1.6%; text-align: center; }
    .matrix-table .identity { width: 5.2%; }
    .matrix-table .date { width: 3.8%; text-align: center; }
    .matrix-table .compact { width: 3.2%; text-align: center; }
    .matrix-table .narrative { width: 7.2%; white-space: normal; }
    .matrix-table tbody tr:nth-child(even), .summary-table tbody tr:nth-child(even) { background: #f5f7f6; }
    .summary-table { font-size: 7px; } .summary-table th, .summary-table td { padding: 2.5px; }
    .metrics { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 6px; }
    .metric { width: 15.8%; border: 1px solid #d8ddd9; padding: 4px; min-height: 30px; }
    .metric strong { display: block; color: #075e5a; font-size: 11px; } .metric span { color: #5f6b68; }
    .highlights { border-left: 3px solid #a06b00; padding: 3px 6px; margin: 5px 0; } .highlights p { margin: 1px 0; }
    .empty { color: #6f7875; font-style: italic; }
    .photo-appendix { page-break-before: always; }
    .photo-appendix > h1 { font-size: 14px; border-bottom: 2px solid #075e5a; padding-bottom: 4px; }
    .evidence-entry { margin-top: 6px; page-break-before: auto; break-before: auto; }
    .evidence-heading { page-break-after: avoid; break-after: avoid; border-top: 1px solid #8eaaa4; padding-top: 4px; }
    .evidence-entry p { margin: 2px 0 4px; }
    .photos { display: flex; flex-wrap: wrap; gap: 6px; }
    figure { width: calc(50% - 3px); margin: 0; border: 1px solid #c8d0ce; padding: 3px; text-align: center; page-break-inside: avoid; break-inside: avoid; }
    figure img { display: block; width: 100%; height: 48mm; max-height: 48mm; object-fit: contain; object-position: center; }
    figcaption { margin-top: 2px; color: #37433f; text-align: left; font-size: 7px; line-height: 1.2; }
    figcaption strong, figcaption span { display: block; }
    .unavailable div { height: 48mm; display: flex; align-items: center; justify-content: center; background: #f1f3f2; color: #6f7875; }
    .signature { display: flex; gap: 14mm; margin-top: 14mm; page-break-inside: avoid; }
    .signature div { width: 48%; text-align: center; } .line { border-top: 1px solid #17211f; margin-top: 14mm; padding-top: 4px; }
  </style></head><body>
    <section class="report-header"><p class="brand"><strong>SUTA</strong></p><p class="jurisdiction"><strong>${escape(report.jurisdiction)}</strong></p><p class="office">${escape(report.officeLabel)}</p><h1>${escape(report.title)}</h1></section>
    <section class="meta"><p><strong>Reporting Period:</strong> ${escape(report.reportingPeriod)}</p><p><strong>Generated:</strong> ${escape(formatLocalDateTime(report.generatedAt))}</p>${report.scope.map((item) => `<p>${escape(item)}</p>`).join('')}<p><strong>${report.layoutKind === 'municipal_summary' ? 'Places summarized' : 'Places / records included'}:</strong> ${(report.totalCount ?? report.exportedCount ?? 0).toLocaleString()}</p>${report.generatedBy === 'bsi' ? `<p><strong>Prepared by / BSI:</strong> ${escape(report.preparedBy ?? 'Barangay Sanitary Inspector')}</p>` : ''}</section>
    ${body}
    ${recordLevel && report.includePhotoEvidence ? photoAppendixHtml(report, embeddedRecords) : ''}
    ${report.generatedBy === 'bsi' ? bsiReportSignatureHtml(report.preparedBy ?? 'Barangay Sanitary Inspector') : ''}
  </body></html>`;
  return html;
}

export async function shareReportPdf(report: ReportViewModel) {
  const embeddedRecords: EmbeddedInspectionRecord[] = [];
  for (const record of report.inspectionRecords ?? []) {
    embeddedRecords.push(await embedInspectionRecordEvidence(record, report.includePhotoEvidence ?? false));
  }
  const html = buildReportHtml(report, embeddedRecords);
  const { uri } = await Print.printToFileAsync({ html });
  if (!(await Sharing.isAvailableAsync())) throw new Error('File sharing is not available on this device.');
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: report.title });
}
