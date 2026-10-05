import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { createInspectionEvidenceSignedUrl } from '@/services/inspectionRecordService';
import type { EmbeddedInspectionRecord, InspectionRecord, InspectionRecordChecklistItem } from '@/types/inspectionRecord';
import { formatLocalDateTime } from '@/utils/dateTime';

const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
const value = (input?: string) => escape(input?.trim() || 'Not available');
const percentage = (input: number | null) => input === null ? 'Not available' : `${Math.round(input)}%`;

async function evidenceDataUri(storagePath: string, mimeType: string, index: number) {
  const safeMime = mimeType.startsWith('image/') ? mimeType : 'image/jpeg';
  const extension = safeMime === 'image/png' ? 'png' : safeMime === 'image/webp' ? 'webp' : 'jpg';
  const target = new File(Paths.cache, `suta-inspection-evidence-${Date.now()}-${index}.${extension}`);
  try {
    const signedUrl = await createInspectionEvidenceSignedUrl(storagePath);
    const downloaded = await File.downloadFileAsync(signedUrl, target, { idempotent: true });
    return `data:${safeMime};base64,${await downloaded.base64()}`;
  } catch {
    return undefined;
  } finally {
    try { if (target.exists) target.delete(); } catch { /* Cache cleanup must not fail the report. */ }
  }
}

export async function embedInspectionRecordEvidence(record: InspectionRecord, includePhotoEvidence = true): Promise<EmbeddedInspectionRecord> {
  let evidenceIndex = 0;
  const mappedFindings: EmbeddedInspectionRecord['findings'] = [];
  for (const finding of record.findings) {
    const evidence: EmbeddedInspectionRecord['findings'][number]['evidence'] = [];
    for (const item of finding.evidence) {
      evidenceIndex += 1;
      evidence.push({ ...item, ...(includePhotoEvidence ? { dataUri: await evidenceDataUri(item.storagePath, item.mimeType, evidenceIndex) } : {}) });
    }
    mappedFindings.push({ category: finding.category, description: finding.description, evidence });
  }
  return { ...record, findings: mappedFindings };
}

function detailRows(rows: [string, string][]) {
  return `<table class="details"><tbody>${rows.map(([label, answer]) => `<tr><th>${escape(label)}</th><td>${value(answer)}</td></tr>`).join('')}</tbody></table>`;
}

function checklistRows(rows: InspectionRecordChecklistItem[]) {
  return `<table><thead><tr><th class="number">No.</th><th>Checklist Item</th><th class="answer">Recorded Answer</th></tr></thead><tbody>${rows.map((item, index) => `<tr class="${item.derived ? 'derived' : ''}"><td>${index + 1}</td><td>${escape(item.label)}${item.derived ? ' <em>(Derived result)</em>' : ''}</td><td>${escape(item.answer)}</td></tr>`).join('')}</tbody></table>`;
}

function findingsHtml(record: EmbeddedInspectionRecord, includePhotoEvidence: boolean) {
  if (!record.findings.length) return '<p class="empty">No findings recorded.</p>';
  return record.findings.map((finding, findingIndex) => `<article class="finding"><h3>Finding ${findingIndex + 1}: ${escape(finding.category)}</h3><p>${escape(finding.description).replaceAll('\n', '<br>')}</p><h4>Photo Evidence</h4>${!includePhotoEvidence && finding.evidence.length ? `<p class="empty">${finding.evidence.length} private evidence image${finding.evidence.length === 1 ? '' : 's'} recorded; images excluded from this report.</p>` : finding.evidence.length ? `<div class="photos">${finding.evidence.map((item, evidenceIndex) => item.dataUri ? `<figure><img src="${item.dataUri}" /><figcaption>Finding ${findingIndex + 1} — Evidence ${evidenceIndex + 1}</figcaption></figure>` : `<figure class="unavailable"><div>Evidence image unavailable</div><figcaption>Finding ${findingIndex + 1} — Evidence ${evidenceIndex + 1}</figcaption></figure>`).join('')}</div>` : '<p class="empty">No photo evidence attached to this finding.</p>'}</article>`).join('');
}

export function inspectionRecordSectionsHtml(record: EmbeddedInspectionRecord, includePhotoEvidence: boolean, includeRepresentativeAcknowledgment = false) {
  const coordinates = record.latitude !== undefined && record.longitude !== undefined ? `${record.latitude.toFixed(6)}, ${record.longitude.toFixed(6)}` : 'Not captured';
  return `<article class="inspection-record">
    <h2>Place Information</h2>${detailRows([['Place name', record.placeName], ['Place type', record.placeType], ['Registered address', record.registeredAddress], ['Barangay', record.barangayName], ['Representative', record.representativeName]])}
    <h2>Inspection Information</h2>${detailRows([['Inspection date and time', formatLocalDateTime(record.inspectionDate)], ['Inspector', record.inspectorName], ['Inspection type', record.inspectionType], ['Result', record.result], ['Risk level', record.riskLevel === 'Unclassified' ? 'Not yet classified' : `${record.riskLevel} Risk`], ['Risk percentage', percentage(record.riskPercentage)], ['Critical violation detected', record.criticalFailure ? 'Yes' : 'No'], ['Location capture status', record.locationStatus], ['Inspection coordinates', coordinates]])}
    <h2>Safe Water Supply Checklist</h2>${checklistRows(record.safeWaterSupply)}
    <h2>Sanitation Facility Checklist</h2>${checklistRows(record.sanitationFacility)}
    <h2>Findings and Photo Evidence</h2>${findingsHtml(record, includePhotoEvidence)}
    <h2>Remarks</h2><p class="remarks">${escape(record.remarks).replaceAll('\n', '<br>')}</p>
    <h2>Reinspection Information</h2>${detailRows([['Reinspection required', record.reinspection.required ? 'Yes' : 'No'], ['Status', record.reinspection.status], ['Scheduled date', record.reinspection.scheduledDate ? formatLocalDateTime(record.reinspection.scheduledDate) : 'Not applicable'], ['Original inspection', record.reinspection.originalInspectionDate ? `${formatLocalDateTime(record.reinspection.originalInspectionDate)} — ${record.reinspection.originalResult ?? 'Result unavailable'}` : record.inspectionType === 'Reinspection' ? 'Original record unavailable' : 'This inspection is the original record'], ['Follow-up completion', record.reinspection.followUpDate ? `${formatLocalDateTime(record.reinspection.followUpDate)} — ${record.reinspection.followUpResult ?? 'Result unavailable'}` : record.reinspection.completedDate ? formatLocalDateTime(record.reinspection.completedDate) : 'Not completed']])}
    ${includeRepresentativeAcknowledgment ? representativeAcknowledgmentHtml(record.representativeName) : ''}
  </article>`;
}

export function bsiReportSignatureHtml(preparedBy: string) {
  return `<section class="signature"><div><p><strong>Prepared by:</strong></p><p class="line">${escape(preparedBy)}</p><p>Barangay Sanitary Inspector</p><p>Date: ______________________</p></div><div><p><strong>Received / Reviewed by:</strong></p><p class="line">Municipal/City Sanitation Administrator</p><p>Date: ______________________</p></div></section>`;
}

export function representativeAcknowledgmentHtml(representativeName: string) {
  return `<section class="signature representative"><div><p><strong>Acknowledged / Received by:</strong></p><p class="line">${escape(representativeName || 'Representative Name / Signature')}</p><p>Representative Name / Signature</p><p>Date: ______________________</p></div></section>`;
}

export const inspectionRecordPdfStyles = `
    .inspection-record { page-break-before: always; } .inspection-record:first-of-type { page-break-before: auto; }
    .inspection-record h2 { color: #075e5a; font-size: 12px; margin: 13px 0 5px; padding: 4px 6px; border-left: 4px solid #075e5a; background: #eef7f5; }
    .inspection-record h3 { font-size: 11px; margin: 0 0 5px; } .inspection-record h4 { font-size: 10px; margin: 7px 0 4px; }
    .inspection-record table { width: 100%; border-collapse: collapse; table-layout: fixed; } .inspection-record thead { display: table-header-group; } .inspection-record tr, .inspection-record figure { page-break-inside: avoid; } .inspection-record th, .inspection-record td { border: 1px solid #aeb9b6; padding: 5px 6px; vertical-align: top; overflow-wrap: anywhere; } .inspection-record thead th { background: #075e5a; color: white; text-align: left; } .inspection-record .details th { width: 34%; background: #eef7f5; text-align: left; } .inspection-record .number { width: 9%; } .inspection-record .answer { width: 29%; } .inspection-record .derived td { background: #f1f6f5; font-weight: bold; } .inspection-record em { font-size: 8px; font-weight: normal; color: #5f6b68; }
    .inspection-record .finding { border: 1px solid #aeb9b6; padding: 8px; margin-bottom: 8px; page-break-inside: auto; } .inspection-record .finding p, .inspection-record .remarks { white-space: normal; overflow-wrap: anywhere; } .inspection-record .photos { display: flex; flex-wrap: wrap; gap: 7px; } .inspection-record figure { width: 48%; margin: 0; border: 1px solid #c8d0ce; padding: 4px; text-align: center; } .inspection-record img { display: block; width: 100%; height: 57mm; object-fit: contain; } .inspection-record figcaption { margin-top: 3px; color: #5f6b68; font-size: 8px; } .inspection-record .unavailable div { height: 57mm; display: flex; align-items: center; justify-content: center; background: #f1f3f2; color: #6f7875; }
    .empty { color: #6f7875; font-style: italic; } .signature { display: flex; gap: 14mm; margin-top: 18mm; page-break-inside: avoid; } .signature div { width: 48%; text-align: center; } .signature.representative div { margin-left: auto; margin-right: auto; } .line { border-top: 1px solid #17211f; margin-top: 16mm; padding-top: 4px; }
  `;

function buildHtml(record: EmbeddedInspectionRecord, jurisdiction: string, generatedBy: 'admin' | 'bsi', preparedBy?: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A4 portrait; margin: 14mm 12mm 17mm; }
    * { box-sizing: border-box; } body { margin: 0; font-family: Arial, sans-serif; color: #17211f; font-size: 10px; line-height: 1.4; }
    header { text-align: center; border-bottom: 2px solid #075e5a; padding-bottom: 9px; margin-bottom: 10px; } .brand { margin: 0; color: #075e5a; font-size: 22px; letter-spacing: 1px; } header p { margin: 1px 0; } h1 { font-size: 16px; margin: 7px 0 0; }
    ${inspectionRecordPdfStyles} footer { position: fixed; bottom: -12mm; left: 0; right: 0; border-top: 1px solid #c8d0ce; padding-top: 3px; color: #6f7875; display: flex; justify-content: space-between; font-size: 8px; } .page:after { content: 'Page ' counter(page); }
  </style></head><body>
    <header><p class="brand"><strong>SUTA</strong></p><p><strong>${value(jurisdiction)}</strong></p><p>Municipal/City Sanitation Office</p><h1>Sanitary Inspection Record</h1><p>Generated ${escape(formatLocalDateTime(new Date()))}</p></header>
    ${inspectionRecordSectionsHtml(record, true, true)}
    ${generatedBy === 'bsi' ? bsiReportSignatureHtml(preparedBy ?? record.inspectorName) : ''}
    <footer><span>Generated by SUTA · Official inspection record</span><span class="page"></span></footer>
  </body></html>`;
}

export async function shareInspectionRecordPdf(record: InspectionRecord, jurisdiction: string, options: { generatedBy: 'admin' | 'bsi'; preparedBy?: string }) {
  const embedded = await embedInspectionRecordEvidence(record, true);
  const { uri } = await Print.printToFileAsync({ html: buildHtml(embedded, jurisdiction, options.generatedBy, options.preparedBy) });
  if (!(await Sharing.isAvailableAsync())) throw new Error('File sharing is not available on this device.');
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: `Inspection Record — ${record.placeName}` });
}
