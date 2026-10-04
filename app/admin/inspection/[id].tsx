import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import AppButton from '@/components/common/AppButton';
import EvidencePreviewGallery from '@/components/inspection/EvidencePreviewGallery';
import ScreenContainer from '@/components/common/ScreenContainer';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { createEvidenceSignedUrl, fetchAdminInspectionDetail } from '@/services/adminService';
import type { AdminInspectionDetail } from '@/types/admin';
import type { EvidenceAttachment } from '@/types/householdInspection';
import type { Json } from '@/types/supabase';
import { formatLocalDate, formatLocalDateTime } from '@/utils/dateTime';

type FindingView = { category: string; details: string; evidence: { storagePath: string; fileName?: string; mimeType?: string; source?: 'camera' | 'library'; createdAt?: string }[] };

function objectValue(value: Json): { [key: string]: Json | undefined } | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}
function textValue(record: ReturnType<typeof objectValue>, key: string) {
  const value = record?.[key]; return typeof value === 'string' ? value : undefined;
}
function numberValue(record: ReturnType<typeof objectValue>, key: string) {
  const value = record?.[key]; return typeof value === 'number' ? value : undefined;
}
function booleanValue(record: ReturnType<typeof objectValue>, key: string) {
  const value = record?.[key]; return typeof value === 'boolean' ? value : undefined;
}
function readable(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function yesNo(value: boolean | undefined) { return value === undefined ? 'Not recorded' : value ? 'Yes' : 'No'; }
function binary(value: number | undefined, yes = 'Yes', no = 'No') { return value === undefined ? 'Not applicable / not recorded' : value === 1 ? yes : no; }
function waterSourceLabel(value: string | undefined, other: string | undefined) {
  if (value === 'level_1') return 'Level I — Point source';
  if (value === 'level_2') return 'Level II — Communal faucet or stand post';
  if (value === 'level_3') return 'Level III — Waterworks or house connection';
  if (value === 'others') return other ? `Other — ${other}` : 'Other';
  return 'Not recorded';
}
function resultLabel(value: string) {
  if (value === 'non_compliant') return 'Non-Compliant';
  if (value === 'for_reinspection') return 'For Reinspection';
  if (value === 'compliant') return 'Compliant';
  return readable(value);
}
function readFindings(value: Json): FindingView[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const finding = objectValue(entry); if (!finding) return [];
    const evidenceValue = finding.evidence;
    const evidence = Array.isArray(evidenceValue) ? evidenceValue.flatMap((file) => {
      const item = objectValue(file); const storagePath = textValue(item, 'storagePath');
      if (!storagePath) return [];
      const source = textValue(item, 'source');
      const parsed: FindingView['evidence'][number] = {
        storagePath,
        ...(textValue(item, 'fileName') ? { fileName: textValue(item, 'fileName') } : {}),
        ...(textValue(item, 'mimeType') ? { mimeType: textValue(item, 'mimeType') } : {}),
        ...(source === 'camera' || source === 'library' ? { source } : {}),
        ...(textValue(item, 'createdAt') ? { createdAt: textValue(item, 'createdAt') } : {}),
      };
      return [parsed];
    }) : [];
    return [{ category: textValue(finding, 'category') ?? 'other', details: textValue(finding, 'details') ?? '', evidence }];
  });
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.row}><Text style={styles.caption}>{label}</Text><Text style={styles.body}>{value}</Text></View>;
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <View><Text style={styles.section}>{title}</Text><View style={styles.card}>{children}</View></View>;
}

export default function AdminInspectionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [detail, setDetail] = useState<AdminInspectionDetail | null>(null);
  const [evidence, setEvidence] = useState<Record<string, EvidenceAttachment[]>>({});
  const load = useCallback(async () => {
    if (!id) return;
    const next = await fetchAdminInspectionDetail(id); setDetail(next);
    const findings = readFindings(next.findings);
    const resolved = await Promise.all(findings.map(async (finding, findingIndex) => {
      const attachments = await Promise.all(finding.evidence.map(async (item, evidenceIndex) => {
        try {
          const uri = await createEvidenceSignedUrl(item.storagePath);
          return { id: `${findingIndex}-${evidenceIndex}`, uri, source: item.source ?? 'library', createdAt: item.createdAt ?? next.inspectionDate, ...(item.fileName ? { fileName: item.fileName } : {}), ...(item.mimeType ? { mimeType: item.mimeType } : {}) } satisfies EvidenceAttachment;
        } catch { return null; }
      }));
      return [String(findingIndex), attachments.filter((item): item is EvidenceAttachment => item !== null)] as const;
    }));
    setEvidence(Object.fromEntries(resolved));
  }, [id]);
  useEffect(() => { void load().catch((error) => Alert.alert('Unable to Load Inspection', error instanceof Error ? error.message : 'Please try again.')); }, [load]);
  if (!detail) return <ScreenContainer><Text style={styles.loading}>Loading inspection…</Text></ScreenContainer>;

  const water = objectValue(detail.safeWaterSupply);
  const microbial = objectValue(water?.microbialTest ?? null);
  const arsenic = objectValue(water?.arsenicTest ?? null);
  const sanitation = objectValue(detail.sanitationFacility);
  const location = objectValue(detail.location);
  const findings = readFindings(detail.findings);
  const waterSource = textValue(water, 'waterSourceType');
  const sanitaryFacility = textValue(sanitation, 'sanitaryFacilityType');
  const unsanitaryFacility = numberValue(sanitation, 'unsanitaryToiletType');

  return (
    <ScreenContainer><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Inspection Details</Text>
      <Section title="Inspection Summary">
        <DetailRow label="Inspection Type" value={detail.inspectionType === 'reinspection' ? 'Reinspection' : 'Inspection'} />
        <DetailRow label="Result" value={resultLabel(detail.result)} />
        <DetailRow label="Date and Time" value={formatLocalDateTime(detail.inspectionDate)} />
        <DetailRow label="Risk Level" value={detail.riskLevel === 'Unclassified' ? 'Not yet classified' : `${detail.riskLevel} Risk${detail.riskPercentage === null ? '' : ` (${Math.round(detail.riskPercentage)}%)`}`} />
        <DetailRow label="Risk Score" value={`${detail.riskEarnedPoints} of ${detail.riskMaximumPoints} weighted points across ${detail.riskEvaluatedItems} applicable items${detail.criticalFailure ? ' · Critical failure override' : ''}`} />
      </Section>
      <Section title="Place"><DetailRow label="Name" value={detail.placeName} /><DetailRow label="Address" value={`${detail.purok ? `${detail.purok}, ` : ''}${detail.address}`} /><DetailRow label="Barangay" value={detail.barangayName} /></Section>
      <Section title="Inspector"><DetailRow label="BSI" value={detail.bsiName} /></Section>
      <Section title="Checklist — Safe Water Supply">
        <DetailRow label="Water Source" value={waterSourceLabel(waterSource, textValue(water, 'otherWaterSource'))} />
        <DetailRow label="Within Premises" value={yesNo(booleanValue(water, 'locatedWithinPremises'))} />
        <DetailRow label="Available at Least 12 Hours" value={yesNo(booleanValue(water, 'availableAtLeast12Hours'))} />
        <DetailRow label="Microbial Test" value={booleanValue(microbial, 'recorded') ? 'Recorded' : 'Not applicable / not recorded'} />
        <DetailRow label="Microbial Test Date" value={formatLocalDate(textValue(microbial, 'dateValidationDone'), 'Not recorded')} />
        <DetailRow label="E. coli Result" value={binary(numberValue(microbial, 'eColiResult'), 'Presence detected', 'No presence detected')} />
        <DetailRow label="Arsenic Test" value={booleanValue(arsenic, 'conducted') ? 'Conducted' : 'Not applicable / not recorded'} />
        <DetailRow label="Arsenic Test Date" value={formatLocalDate(textValue(arsenic, 'dateTestingDone'), 'Not recorded')} />
        <DetailRow label="Arsenic Result" value={binary(numberValue(arsenic, 'result'), 'Within allowable limit', 'Failed')} />
      </Section>
      <Section title="Checklist — Sanitation Facility">
        <DetailRow label="Toilet Facility" value={sanitaryFacility ? readable(sanitaryFacility) : unsanitaryFacility === undefined ? 'Not recorded' : ['Without toilet', 'Open pit latrine', 'Overhung latrine', 'Water sealed connected to open drain'][unsanitaryFacility] ?? 'Unsanitary facility'} />
        <DetailRow label="Shared With Other Households" value={binary(numberValue(sanitation, 'sharedWithOtherHouseholds'))} />
        <DetailRow label="Disposal Method" value={textValue(sanitation, 'excretaDisposalMethod') ? readable(textValue(sanitation, 'excretaDisposalMethod') ?? '') : 'Not recorded'} />
      </Section>
      <Text style={styles.section}>Findings</Text>
      {findings.length === 0 ? <View style={styles.card}><Text style={styles.body}>No findings recorded.</Text></View> : findings.map((finding, index) => <View key={`${finding.category}-${index}`} style={styles.card}><Text style={styles.heading}>{readable(finding.category)}</Text><Text style={styles.body}>{finding.details || 'No description recorded.'}</Text>{evidence[String(index)]?.length ? <EvidencePreviewGallery evidence={evidence[String(index)]} /> : finding.evidence.length ? <Text style={styles.caption}>Private evidence could not be loaded.</Text> : null}</View>)}
      <Section title="Remarks"><Text style={styles.body}>{detail.remarks || 'No remarks recorded.'}</Text></Section>
      <Section title="Location">{location ? <><DetailRow label="Coordinates" value={`${numberValue(location, 'latitude')?.toFixed(6) ?? 'Not recorded'}, ${numberValue(location, 'longitude')?.toFixed(6) ?? 'Not recorded'}`} /><DetailRow label="Captured" value={formatLocalDateTime(textValue(location, 'capturedAt'), 'Not recorded')} /></> : <Text style={styles.body}>No location was recorded.</Text>}</Section>
      <Section title="Reinspection"><Text style={styles.body}>{detail.inspectionType === 'reinspection' ? 'This is a linked follow-up inspection.' : detail.reinspectionStatus ? `Reinspection status: ${readable(detail.reinspectionStatus)}` : 'No reinspection is linked to this record.'}</Text></Section>
      <AppButton title="Back to Inspections" variant="outline" onPress={() => router.back()} />
    </ScrollView></ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingVertical: SPACING.xxl, gap: SPACING.lg }, loading: { textAlign: 'center', marginTop: SPACING.xxxl, color: COLORS.textMuted },
  title: { ...TYPOGRAPHY.display, color: COLORS.text }, section: { ...TYPOGRAPHY.heading, color: COLORS.text, marginTop: SPACING.md, marginBottom: SPACING.sm },
  card: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, backgroundColor: COLORS.surface, padding: SPACING.lg, gap: SPACING.sm },
  heading: { ...TYPOGRAPHY.subheading, color: COLORS.text }, body: { ...TYPOGRAPHY.body, color: COLORS.textSecondary }, caption: { ...TYPOGRAPHY.caption, color: COLORS.textMuted },
  row: { borderBottomWidth: 1, borderBottomColor: COLORS.divider, paddingBottom: SPACING.sm, gap: SPACING.xs },
});
