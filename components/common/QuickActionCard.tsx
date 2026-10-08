import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '@/constants/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export default function QuickActionCard({
  icon,
  title,
  description,
  onPress,
  tone = 'teal',
}: {
  icon: IconName;
  title: string;
  description?: string;
  onPress: () => void;
  tone?: 'teal' | 'blue' | 'aqua' | 'warning';
}) {
  const palette = palettes[tone];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={[styles.icon, { backgroundColor: palette.soft }]}>
        <Ionicons name={icon} size={23} color={palette.strong} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        {description ? <Text numberOfLines={2} style={styles.description}>{description}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
    </Pressable>
  );
}

const palettes = {
  teal: { soft: COLORS.primarySoft, strong: COLORS.primary },
  blue: { soft: COLORS.blueSoft, strong: COLORS.blue },
  aqua: { soft: COLORS.aquaSoft, strong: COLORS.primary },
  warning: { soft: COLORS.warningSoft, strong: COLORS.warning },
};

const styles = StyleSheet.create({
  card: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.xl,
    ...SHADOWS.subtle,
  },
  icon: { width: 46, height: 46, borderRadius: RADIUS.lg, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1 },
  title: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text },
  description: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginTop: 2 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
});
