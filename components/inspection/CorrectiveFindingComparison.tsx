import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import EvidencePreviewGallery from '@/components/inspection/EvidencePreviewGallery';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import type {
  CorrectiveActionStatus,
  EvidenceAttachment,
} from '@/types/householdInspection';

type CorrectiveFindingComparisonProps = {
  findingNumber: number;
  category: string;
  originalDescription: string;
  status: CorrectiveActionStatus;
  verificationNote?: string;
  beforeEvidence: EvidenceAttachment[];
  afterEvidence: EvidenceAttachment[];
  beforeLoading?: boolean;
  beforeUnavailable?: boolean;
  divided?: boolean;
};

const STATUS_TONES: Record<
  CorrectiveActionStatus,
  { backgroundColor: string; color: string }
> = {
  Unresolved: {
    backgroundColor: COLORS.violationSoft,
    color: COLORS.violationDark,
  },
  'Partially Corrected': {
    backgroundColor: COLORS.warningSoft,
    color: COLORS.warningDark,
  },
  Corrected: {
    backgroundColor: COLORS.compliantSoft,
    color: COLORS.compliantDark,
  },
};

export default function CorrectiveFindingComparison({
  findingNumber,
  category,
  originalDescription,
  status,
  verificationNote,
  beforeEvidence,
  afterEvidence,
  beforeLoading = false,
  beforeUnavailable = false,
  divided = false,
}: CorrectiveFindingComparisonProps) {
  const { width } = useWindowDimensions();
  const statusTone = STATUS_TONES[status];
  const isWide = width >= 620;

  return (
    <View style={[styles.container, divided && styles.divided]}>
      <View style={styles.header}>
        <View style={styles.headingCopy}>
          <Text style={styles.findingNumber}>Finding {findingNumber}</Text>
          <Text style={styles.category}>{category}</Text>
        </View>
        <View
          accessibilityLabel={`Corrective status: ${status}`}
          style={[styles.statusChip, { backgroundColor: statusTone.backgroundColor }]}
        >
          <Text style={[styles.statusText, { color: statusTone.color }]}>
            {status}
          </Text>
        </View>
      </View>

      <View style={styles.issueBlock}>
        <Text style={styles.overline}>Original issue</Text>
        <Text style={styles.description}>{originalDescription}</Text>
      </View>

      {verificationNote?.trim() ? (
        <View style={styles.noteBlock}>
          <Text style={styles.overline}>Verification note</Text>
          <Text style={styles.note}>{verificationNote.trim()}</Text>
        </View>
      ) : null}

      <View style={[styles.comparison, isWide && styles.comparisonWide]}>
        <EvidenceColumn
          evidence={beforeEvidence}
          emptyText={beforeUnavailable ? 'Original evidence unavailable' : 'No original evidence'}
          label="Before"
          loading={beforeLoading}
          supportingLabel="Original inspection"
        />
        <View style={isWide ? styles.verticalRule : styles.horizontalRule} />
        <EvidenceColumn
          evidence={afterEvidence}
          emptyText="No follow-up evidence"
          label="After"
          supportingLabel="Current follow-up"
        />
      </View>
    </View>
  );
}

function EvidenceColumn({
  label,
  supportingLabel,
  evidence,
  emptyText,
  loading = false,
}: {
  label: string;
  supportingLabel: string;
  evidence: EvidenceAttachment[];
  emptyText: string;
  loading?: boolean;
}) {
  return (
    <View style={styles.evidenceColumn}>
      <View style={styles.evidenceHeader}>
        <View style={styles.evidenceHeadingCopy}>
          <Text style={styles.evidenceLabel}>{label}</Text>
          <Text style={styles.evidenceSupport}>{supportingLabel}</Text>
        </View>
        {evidence.length > 0 ? (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{evidence.length}</Text>
          </View>
        ) : null}
      </View>
      {loading ? (
        <Text style={styles.loadingEvidence}>Loading evidence…</Text>
      ) : evidence.length > 0 ? (
        <EvidencePreviewGallery evidence={evidence} showCount={false} />
      ) : (
        <Text style={styles.emptyEvidence}>{emptyText}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: SPACING.lg,
    gap: SPACING.md,
  },
  divided: {
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  headingCopy: {
    flex: 1,
    minWidth: 0,
  },
  findingNumber: {
    ...TYPOGRAPHY.bodyMedium,
    fontSize: 14,
    color: COLORS.text,
  },
  category: {
    ...TYPOGRAPHY.tiny,
    marginTop: SPACING.xxs,
    color: COLORS.primary,
  },
  statusChip: {
    maxWidth: '48%',
    minHeight: 28,
    justifyContent: 'center',
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  statusText: {
    ...TYPOGRAPHY.tiny,
    textAlign: 'center',
    fontSize: 10,
    lineHeight: 14,
  },
  issueBlock: {
    gap: SPACING.xs,
  },
  overline: {
    ...TYPOGRAPHY.tiny,
    fontSize: 10,
    letterSpacing: 0.65,
    textTransform: 'uppercase',
    color: COLORS.textMuted,
  },
  description: {
    ...TYPOGRAPHY.caption,
    lineHeight: 19,
    color: COLORS.text,
  },
  noteBlock: {
    gap: SPACING.xs,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.aqua,
    paddingLeft: SPACING.sm,
  },
  note: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textSecondary,
  },
  comparison: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceElevated,
  },
  comparisonWide: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  evidenceColumn: {
    flex: 1,
    minWidth: 0,
    padding: SPACING.md,
  },
  evidenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  evidenceHeadingCopy: {
    flex: 1,
  },
  evidenceLabel: {
    ...TYPOGRAPHY.label,
    color: COLORS.text,
  },
  evidenceSupport: {
    ...TYPOGRAPHY.tiny,
    marginTop: SPACING.xxs,
    fontSize: 10,
    color: COLORS.textMuted,
  },
  countBadge: {
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primarySoft,
  },
  countText: {
    ...TYPOGRAPHY.tiny,
    fontSize: 10,
    color: COLORS.primary,
  },
  horizontalRule: {
    height: 1,
    backgroundColor: COLORS.divider,
  },
  verticalRule: {
    width: 1,
    backgroundColor: COLORS.divider,
  },
  emptyEvidence: {
    marginTop: SPACING.sm,
    fontSize: 11,
    fontStyle: 'italic',
    color: COLORS.textMuted,
  },
  loadingEvidence: {
    marginTop: SPACING.sm,
    fontSize: 11,
    color: COLORS.textSecondary,
  },
});
