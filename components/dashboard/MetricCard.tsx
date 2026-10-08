import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

type MetricCardProps = {
  label: string;
  value: number | string;
  icon?: IconName;
  tone?: 'teal' | 'blue' | 'warning' | 'danger';
};

export default function MetricCard({
  label,
  value,
  icon,
  tone = 'teal',
}: MetricCardProps) {
  const palette = palettes[tone];
  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.value}>{value}</Text>
        {icon ? <View style={[styles.icon, { backgroundColor: palette.soft }]}><Ionicons name={icon} size={19} color={palette.strong} /></View> : null}
      </View>
      <Text numberOfLines={2} style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    ...SHADOWS.subtle,
  },

  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm },
  icon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  value: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },

  label: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
});

const palettes = {
  teal: { soft: COLORS.primarySoft, strong: COLORS.primary },
  blue: { soft: COLORS.blueSoft, strong: COLORS.blue },
  warning: { soft: COLORS.warningSoft, strong: COLORS.warning },
  danger: { soft: COLORS.violationSoft, strong: COLORS.violation },
};
