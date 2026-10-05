import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import EvidencePreviewGallery from '@/components/inspection/EvidencePreviewGallery';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { createInspectionEvidenceSignedUrl } from '@/services/inspectionRecordService';
import type { EvidenceAttachment } from '@/types/householdInspection';
import type { InspectionRecord } from '@/types/inspectionRecord';
import { evidenceGroupLabel } from '@/utils/reportMatrix';

export default function ReportEvidencePreview({ record }: { record: InspectionRecord }) {
  const [expanded, setExpanded] = useState(false);
  const [evidence, setEvidence] = useState<Record<number, EvidenceAttachment[]>>({});
  const [loading, setLoading] = useState(false);
  const evidenceCount = record.findings.reduce((total, finding) => total + finding.evidence.length, 0);

  useEffect(() => {
    if (!expanded || !evidenceCount) return;
    let active = true; setLoading(true);
    void Promise.all(record.findings.map(async (finding, findingIndex) => {
      const items = await Promise.all(finding.evidence.map(async (item) => {
        try { const attachment: EvidenceAttachment = { id: item.id, uri: await createInspectionEvidenceSignedUrl(item.storagePath), source: 'library', createdAt: record.inspectionDate, mimeType: item.mimeType }; return attachment; } catch { return null; }
      }));
      return [findingIndex, items.filter((item): item is EvidenceAttachment => item !== null)] as const;
    })).then((entries) => { if (active) setEvidence(Object.fromEntries(entries)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [evidenceCount, expanded, record]);

  if (!evidenceCount) return null;
  return <View style={styles.card}><Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded((value) => !value)} style={styles.header}><View style={styles.text}><Text style={styles.title}>{evidenceGroupLabel(record)}</Text><Text style={styles.caption}>{evidenceCount} private evidence image{evidenceCount === 1 ? '' : 's'}</Text></View><Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={21} color={COLORS.primary} /></Pressable>{expanded ? <View style={styles.body}>{loading ? <Text style={styles.caption}>Loading private evidence…</Text> : record.findings.map((finding, index) => finding.evidence.length ? <View key={`${finding.category}-${index}`} style={styles.finding}><Text style={styles.findingTitle}>Finding {index + 1} — {finding.category}</Text>{evidence[index]?.length ? <EvidencePreviewGallery evidence={evidence[index]} /> : <Text style={styles.caption}>Evidence image unavailable.</Text>}</View> : null)}</View> : null}</View>;
}

const styles = StyleSheet.create({ card: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, backgroundColor: COLORS.surface }, header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.md }, text: { flex: 1, gap: 2 }, title: { ...TYPOGRAPHY.subheading, color: COLORS.text }, caption: { ...TYPOGRAPHY.caption, color: COLORS.textMuted }, body: { gap: SPACING.md, padding: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.border }, finding: { gap: SPACING.xs }, findingTitle: { ...TYPOGRAPHY.body, fontWeight: '700', color: COLORS.text } });
