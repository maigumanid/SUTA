import { StyleSheet, Text, View } from 'react-native';

import { COLORS, RADIUS, SPACING } from '@/constants/theme';

const STEPS = ['Start', 'Water', 'Sanitation', 'Findings', 'Review'] as const;

export default function InspectionProgress({
  currentStep,
  placeName,
}: {
  currentStep: 1 | 2 | 3 | 4 | 5;
  placeName?: string;
}) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`Inspection progress. Step ${currentStep} of ${STEPS.length}: ${STEPS[currentStep - 1]}`}
      accessibilityValue={{ min: 1, max: STEPS.length, now: currentStep }}
      style={styles.container}
    >
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>INSPECTION</Text>
          <Text style={styles.stepLabel}>Step {currentStep} of {STEPS.length} · {STEPS[currentStep - 1]}</Text>
        </View>
        {placeName ? <Text numberOfLines={2} style={styles.placeName}>{placeName}</Text> : null}
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${(currentStep / STEPS.length) * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.primaryLight,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primarySoft,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  headingCopy: { flexShrink: 0 },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: COLORS.primary,
  },
  stepLabel: {
    marginTop: 1,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },
  placeName: {
    flex: 1,
    textAlign: 'right',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  track: {
    height: 5,
    overflow: 'hidden',
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primaryLight,
  },
  fill: {
    height: '100%',
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primary,
  },
});
