import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import type { EmbeddedInspectionRecord } from '@/types/inspectionRecord';
import type { ReportSection, ReportViewModel } from '@/types/report';
import { formatLocalDateTime } from '@/utils/dateTime';
import { bsiReportSignatureHtml, embedInspectionRecordEvidence } from '@/utils/inspectionRecordPdf';
import { buildConsolidatedParts, buildFindingsRows, buildRemarksRows, evidenceGroupLabel, FINDINGS_COLUMNS, MATRIX_LEGEND, REMARKS_COLUMNS, type MatrixTable } from '@/utils/reportMatrix';

const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');

function plainTable(title: string, columns: string[], rows: string[][], empty = 'No records matched the selected filters.', widths?: number[]) {
  return `<section class="report-table"><h2>${escape(title)}</h2><table>${widths ? `<colgroup>${widths.map((width) => `<col style="width:${width}%">`).join('')}</colgroup>` : ''}<thead><tr>${columns.map((item) => `<th>${escape(item)}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.map((row) => `<tr>${row.map((cell) => `<td>${escape(cell || '—')}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${Math.max(1, columns.length)}" class="empty">${escape(empty)}</td></tr>`}</tbody></table></section>`;
}

function sectionTable(section: ReportSection) { return plainTable(section.title, section.columns, section.rows, section.emptyMessage); }

function matrixTable(table: MatrixTable) {
  const totalWidth = table.columns.reduce((sum, column) => sum + column.width, 0);
  const groups: { label: string; count: number }[] = [];
  for (const column of table.columns) { const last = groups.at(-1); if (last?.label === column.group) last.count += 1; else groups.push({ label: column.group, count: 1 }); }
  return `<section class="matrix"><h2>${escape(table.title)}</h2><table><colgroup>${table.columns.map((column) => `<col style="width:${((column.width / totalWidth) * 100).toFixed(2)}%">`).join('')}</colgroup><thead><tr class="group-head">${groups.map((group) => `<th colspan="${group.count}">${escape(group.label)}</th>`).join('')}</tr><tr>${table.columns.map((column) => `<th>${escape(column.label)}</th>`).join('')}</tr></thead><tbody>${table.rows.length ? table.rows.map((row) => `<tr>${row.values.map((cell) => `<td>${escape(cell || '—')}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${table.columns.length}" class="empty">No inspection records matched this report scope.</td></tr>`}</tbody></table></section>`;
}

function photoEvidenceHtml(records: EmbeddedInspectionRecord[]) {
  const groups = records.flatMap((record) => {
    const findings = record.findings.flatMap((finding, findingIndex) => finding.evidence.length ? [`<div class="photo-finding"><h3>Finding ${findingIndex + 1} — ${escape(finding.category)}</h3><div class="photos">${finding.evidence.map((item, evidenceIndex) => item.dataUri ? `<figure><img src="${item.dataUri}"><figcaption>Finding ${findingIndex + 1} — Evidence ${evidenceIndex + 1}</figcaption></figure>` : `<figure class="unavailable"><div>Evidence image unavailable</div><figcaption>Finding ${findingIndex + 1} — Evidence ${evidenceIndex + 1}</figcaption></figure>`).join('')}</div></div>`] : []);
    return findings.length ? [`<section class="evidence-group"><h2>${escape(evidenceGroupLabel(record))}</h2>${findings.join('')}</section>`] : [];
  });
  return groups.length ? groups.join('') : '<p class="empty">No photo evidence is attached to the exported inspection set.</p>';
}

export async function shareReportPdf(report: ReportViewModel) {
  const embeddedRecords: EmbeddedInspectionRecord[] = [];
  for (const record of report.inspectionRecords ?? []) embeddedRecords.push(await embedInspectionRecordEvidence(record, report.includePhotoEvidence ?? false));
  const layout = buildConsolidatedParts(report); const findings = buildFindingsRows(embeddedRecords); const remarks = buildRemarksRows(embeddedRecords);
  const partsHtml = layout.parts.map((part) => `<section class="part"><h1>Part ${part.number} — ${escape(part.title)}</h1>${part.number === 1 ? `<h2>Executive Metrics</h2><div class="metrics">${report.metrics.map((item) => `<div class="metric"><strong>${escape(item.value)}</strong><span>${escape(item.label)}</span></div>`).join('')}</div>${report.highlights.length ? `<div class="highlights">${report.highlights.map((item) => `<p>• ${escape(item)}</p>`).join('')}</div>` : ''}` : ''}${part.sections?.map(sectionTable).join('') ?? ''}${part.tables?.map(matrixTable).join('') ?? ''}${part.tables?.length ? `<div class="legend"><strong>Legend:</strong> ${MATRIX_LEGEND.map(escape).join(' · ')}</div>` : ''}</section>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A4 landscape; margin: 8mm 7mm 12mm; }
    * { box-sizing: border-box; } body { margin: 0; font-family: Arial, sans-serif; color: #17211f; font-size: 7.3px; line-height: 1.25; }
    header { text-align: center; border-bottom: 2px solid #075e5a; padding-bottom: 5px; margin-bottom: 7px; } .brand { margin: 0; color: #075e5a; font-size: 20px; letter-spacing: 1px; } .jurisdiction { margin: 1px 0; font-size: 11px; } .office { color: #5f6b68; margin: 1px 0; } header h1 { font-size: 15px; margin: 5px 0 0; }
    .meta { background: #eef7f5; border: 1px solid #c9ded9; padding: 6px; margin-bottom: 7px; } .meta p { margin: 1px 0; }
    .part { page-break-before: always; } .part:first-of-type { page-break-before: auto; } .part > h1 { color: #17211f; font-size: 13px; text-transform: uppercase; border-bottom: 2px solid #075e5a; padding-bottom: 4px; margin: 8px 0 7px; }
    h2 { color: #075e5a; font-size: 9px; margin: 8px 0 4px; } h3 { font-size: 8px; margin: 5px 0 3px; }
    .metrics { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 6px; } .metric { width: 15.8%; border: 1px solid #d8ddd9; padding: 4px; min-height: 32px; } .metric strong { display: block; color: #075e5a; font-size: 12px; } .metric span { color: #5f6b68; }
    .highlights { border-left: 3px solid #a06b00; padding: 3px 6px; margin: 5px 0; } .highlights p { margin: 1px 0; }
    .report-table, .matrix { page-break-inside: auto; margin-bottom: 7px; } table { width: 100%; border-collapse: collapse; table-layout: fixed; } thead { display: table-header-group; } tr, figure { page-break-inside: avoid; } th { background: #075e5a; color: #fff; text-align: left; font-weight: 700; } th, td { border: 1px solid #bdc8c5; padding: 2.4px 2px; vertical-align: top; overflow-wrap: anywhere; word-break: normal; } tbody tr:nth-child(even) { background: #f5f7f6; }
    .matrix table { font-size: 6.6px; line-height: 1.18; } .matrix th, .matrix td { padding: 2px 1.6px; } .matrix .group-head th { background: #dcefeb; color: #075e5a; text-align: center; border-color: #9ebbb5; font-size: 7px; }
    .legend { background: #f1f5f4; border: 1px solid #d8ddd9; padding: 4px; margin-bottom: 6px; color: #4f5d59; }
    .photo-part { page-break-before: always; } .evidence-group { page-break-before: always; } .evidence-group:first-of-type { page-break-before: auto; } .photo-finding { page-break-inside: auto; } .photos { display: flex; flex-wrap: wrap; gap: 6px; } figure { width: 48.5%; margin: 0; border: 1px solid #c8d0ce; padding: 3px; text-align: center; } figure img { display: block; width: 100%; height: 55mm; object-fit: contain; } figcaption { margin-top: 2px; color: #5f6b68; } .unavailable div { height: 55mm; display: flex; align-items: center; justify-content: center; background: #f1f3f2; color: #6f7875; }
    .empty { color: #6f7875; font-style: italic; } .signature { display: flex; gap: 14mm; margin-top: 15mm; page-break-inside: avoid; } .signature div { width: 48%; text-align: center; } .line { border-top: 1px solid #17211f; margin-top: 14mm; padding-top: 4px; }
    footer { position: fixed; bottom: -9mm; left: 0; right: 0; border-top: 1px solid #d8ddd9; padding-top: 2px; color: #6f7875; display: flex; justify-content: space-between; } .page:after { content: 'Page ' counter(page); }
  </style></head><body>
    <header><p class="brand"><strong>SUTA</strong></p><p class="jurisdiction"><strong>${escape(report.jurisdiction)}</strong></p><p class="office">${escape(report.officeLabel)}</p><h1>${escape(report.title)}</h1></header>
    <div class="meta"><p><strong>Reporting Period:</strong> ${escape(report.reportingPeriod)}</p><p><strong>Generated On:</strong> ${escape(formatLocalDateTime(report.generatedAt))}</p>${report.scope.map((item) => `<p>${escape(item)}</p>`).join('')}${report.totalCount !== undefined ? `<p><strong>Included:</strong> ${report.exportedCount ?? 0} of ${report.totalCount} matching records</p>` : ''}</div>
    ${partsHtml}
    <section class="part"><h1>Part ${layout.findingsPart} — Findings / Observations</h1>${plainTable('Complete Recorded Findings', FINDINGS_COLUMNS, findings.map((row) => row.values), 'No findings were recorded for the exported inspection set.', [4, 13, 11, 9, 10, 29, 18, 6])}</section>
    <section class="part"><h1>Part ${layout.remarksPart} — Remarks</h1>${plainTable('Recorded Remarks', REMARKS_COLUMNS, remarks.map((row) => row.values), 'No remarks were recorded for the exported inspection set.', [18, 14, 12, 56])}</section>
    ${report.includePhotoEvidence ? `<section class="part photo-part"><h1>Part ${layout.evidencePart} — Photo Evidence</h1>${photoEvidenceHtml(embeddedRecords)}</section>` : ''}
    ${report.generatedBy === 'bsi' ? bsiReportSignatureHtml(report.preparedBy ?? 'Barangay Sanitary Inspector') : ''}
    <footer><span>Generated by SUTA · Internal sanitation operations report</span><span class="page"></span></footer>
  </body></html>`;
  const { uri } = await Print.printToFileAsync({ html });
  if (!(await Sharing.isAvailableAsync())) throw new Error('File sharing is not available on this device.');
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: report.title });
}
