import { StyleSheet, Text, View } from 'react-native';

import { COLORS, RADIUS } from '@/constants/theme';
import type { RiskLevel } from '@/types/place';
import { getRiskClassification } from '@/utils/riskClassification';

type RiskBadgeProps = { level: RiskLevel };

const riskColors: Record<
  RiskLevel,
  { backgroundColor: string; color: string }
> = {
  Low: { backgroundColor: COLORS.riskLowSoft, color: COLORS.riskLow },
  Moderate: {
    backgroundColor: COLORS.riskMediumSoft,
    color: COLORS.riskMedium,
  },
  High: { backgroundColor: COLORS.riskHighSoft, color: COLORS.riskHigh },
  Unclassified: {
    backgroundColor: COLORS.neutralSoft,
    color: COLORS.neutral,
  },
};

export default function RiskBadge({ level }: RiskBadgeProps) {
  const classification = getRiskClassification(level);
  const colors = riskColors[level];

  return (
    <View style={[styles.badge, { backgroundColor: colors.backgroundColor }]}>
      <Text style={[styles.text, { color: colors.color }]}>
        {classification.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.neutralSoft,
  },

  text: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.neutral,
  },
});
