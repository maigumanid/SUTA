import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';

type Tone = 'default' | 'teal' | 'aqua' | 'blue' | 'warning' | 'danger';

export default function SurfaceCard({
  children,
  tone = 'default',
  elevated = false,
  style,
}: {
  children: ReactNode;
  tone?: Tone;
  elevated?: boolean;
  style?: ViewStyle | ViewStyle[];
}) {
  return (
    <View style={[styles.card, tones[tone], elevated && styles.elevated, style]}>
      {children}
    </View>
  );
}

const tones = StyleSheet.create({
  default: { backgroundColor: COLORS.surface, borderColor: COLORS.border },
  teal: { backgroundColor: COLORS.primarySoft, borderColor: COLORS.primaryLight },
  aqua: { backgroundColor: COLORS.aquaSoft, borderColor: '#BDE7E0' },
  blue: { backgroundColor: COLORS.blueSoft, borderColor: '#CCDFEA' },
  warning: { backgroundColor: COLORS.warningSoft, borderColor: '#EBD8A7' },
  danger: { backgroundColor: COLORS.violationSoft, borderColor: '#F0C8C4' },
});

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
  },
  elevated: {
    ...SHADOWS.card,
  },
});
