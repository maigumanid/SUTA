import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import type { StoredInspection } from '@/storage/inspectionStorage';
import type { Place } from '@/types/place';
import { formatLocalDate, formatLocalDateTime } from '@/utils/dateTime';
import { calculateInspectionRisk, getRiskClassification } from '@/utils/riskClassification';

const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
const cell = (value?: string) => escape(value?.trim() || 'Not recorded');
const resultLabel = (value: StoredInspection['result']) => value === 'compliant'
  ? 'Compliant'
  : value === 'non_compliant'
    ? 'Non-Compliant'
    : value === 'for_reinspection'
      ? 'For Reinspection'
      : 'Not recorded';

function buildComplianceNoticeHtml(input: {
  place: Place;
  inspection: StoredInspection;
  barangay: string;
  preparedBy: string;
  scheduledDate?: string;
  correctiveStatuses?: Record<string, 'Unresolved' | 'Partially Corrected' | 'Corrected'>;
}) {
  const risk = calculateInspectionRisk(input.inspection);
  const riskLabel = getRiskClassification(risk.level).label;
  const findings = input.inspection.findings.filter((finding) => !finding.correctiveAction);
  const corrections = findings.length
    ? findings.map((finding, index) => `<article class="finding"><h3>${index + 1}. ${cell(finding.category === 'safe_water_supply' ? 'Safe Water Supply' : finding.category === 'sanitation' ? 'Sanitation' : 'Other')}</h3><p>${cell(finding.details)}</p>${input.correctiveStatuses?.[finding.id] ? `<p class="muted">Current corrective status: ${cell(input.correctiveStatuses[finding.id])}</p>` : ''}</article>`).join('')
    : '<p>No findings were recorded in this inspection.</p>';
  const generatedAt = formatLocalDateTime(new Date());

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A4 portrait; margin: 18mm 16mm 20mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #1c2927; font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.45; }
    header { border-bottom: 3px solid #087c76; padding-bottom: 12pt; margin-bottom: 16pt; }
    .brand { color: #087c76; font-size: 22pt; font-weight: 800; letter-spacing: 1.2pt; margin: 0; }
    .jurisdiction { color: #45615e; font-size: 10pt; margin: 3pt 0; }
    h1 { font-size: 17pt; line-height: 1.2; margin: 13pt 0 4pt; }
    .generated { color: #5b6e6b; font-size: 9pt; margin: 0; }
    h2 { color: #075e5a; font-size: 12pt; margin: 16pt 0 7pt; border-left: 3px solid #35b8aa; padding-left: 7pt; }
    table { width: 100%; border-collapse: collapse; page-break-inside: auto; }
    th, td { border: 1px solid #c9d6d3; padding: 7pt 8pt; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
    th { width: 31%; background: #edf6f4; font-weight: 700; }
    tr { page-break-inside: avoid; }
    .finding { border-top: 1px solid #c9d6d3; padding: 7pt 0 4pt; page-break-inside: avoid; }
    .finding h3 { color: #075e5a; font-size: 11pt; margin: 0 0 4pt; }
    .finding p { margin: 3pt 0 7pt; white-space: pre-wrap; overflow-wrap: anywhere; }
    .muted { color: #5b6e6b; font-size: 9pt; }
    .ack { margin-top: 30pt; page-break-inside: avoid; }
    .signature { border-top: 1px solid #263431; margin-top: 26pt; padding-top: 5pt; width: 68%; }
    footer { border-top: 1px solid #c9d6d3; margin-top: 20pt; padding-top: 5pt; color: #647572; font-size: 8pt; }
  </style></head><body>
    <header><p class="brand">SUTA</p><p class="jurisdiction">${cell(input.barangay)} · Sanitary Inspection</p><h1>Corrective Action Notice</h1><p class="generated">Generated ${escape(generatedAt)}</p></header>
    <h2>Place Information</h2><table><tbody>
      <tr><th>Place</th><td>${cell(input.place.name)}</td></tr>
      <tr><th>Representative</th><td>${cell(input.place.representativeName)}</td></tr>
      <tr><th>Address</th><td>${cell(input.place.address)}</td></tr>
      <tr><th>Purok</th><td>${cell(input.place.purok)}</td></tr>
      <tr><th>Inspection date</th><td>${escape(formatLocalDateTime(input.inspection.inspectionDate))}</td></tr>
      <tr><th>Barangay Sanitary Inspector</th><td>${cell(input.preparedBy)}</td></tr>
    </tbody></table>
    <h2>Inspection Result</h2><table><tbody>
      <tr><th>Compliance status</th><td>${cell(resultLabel(input.inspection.result))}</td></tr>
      <tr><th>Risk level</th><td>${cell(riskLabel)}</td></tr>
    </tbody></table>
    <h2>Recorded Findings and Corrective Details</h2>${corrections}
    ${input.scheduledDate ? `<h2>Follow-up</h2><p>Reinspection scheduled for ${escape(formatLocalDate(input.scheduledDate))}.</p>` : ''}
    <section class="ack"><p>Please review the recorded findings and corrective details with the place representative.</p><div class="signature">${cell(input.place.representativeName)} · Representative acknowledgment</div><p class="muted">Prepared by ${cell(input.preparedBy)}, Barangay Sanitary Inspector</p></section>
    <footer>Generated by SUTA from the inspection record dated ${escape(formatLocalDate(input.inspection.inspectionDate))}. This notice contains recorded inspection information.</footer>
  </body></html>`;
}

export async function shareComplianceNoticePdf(input: {
  place: Place;
  inspection: StoredInspection;
  barangay: string;
  preparedBy: string;
  scheduledDate?: string;
  correctiveStatuses?: Record<string, 'Unresolved' | 'Partially Corrected' | 'Corrected'>;
}) {
  const { uri } = await Print.printToFileAsync({ html: buildComplianceNoticeHtml(input) });
  if (!(await Sharing.isAvailableAsync())) throw new Error('File sharing is not available on this device.');
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: `Corrective Action Notice — ${input.place.name}` });
}
