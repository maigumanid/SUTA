import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppButton from '@/components/common/AppButton';
import EntranceTransition from '@/components/common/EntranceTransition';
import { COLORS, SPACING, TYPOGRAPHY } from '@/constants/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export default function EmptyState({
  icon = 'leaf-outline',
  title,
  description,
  actionLabel,
  onAction,
  compact = false,
}: {
  icon?: IconName;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}) {
  return (
    <EntranceTransition style={[styles.container, compact && styles.compact]}>
      <View style={styles.art}>
        <View style={styles.artBack} />
        <View style={styles.iconWrap}><Ionicons name={icon} size={30} color={COLORS.primary} /></View>
        <View style={styles.dot} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {actionLabel && onAction ? <AppButton title={actionLabel} onPress={onAction} style={styles.button} /> : null}
    </EntranceTransition>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: SPACING.section, paddingHorizontal: SPACING.xl },
  compact: { paddingVertical: SPACING.xxl },
  art: { width: 88, height: 76, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md },
  artBack: { position: 'absolute', width: 72, height: 54, borderRadius: 24, backgroundColor: COLORS.primaryMist, transform: [{ rotate: '-8deg' }] },
  iconWrap: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.primaryLight },
  dot: { position: 'absolute', right: 4, top: 4, width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.aqua },
  title: { ...TYPOGRAPHY.subheading, color: COLORS.text, textAlign: 'center' },
  description: { ...TYPOGRAPHY.bodySmall, color: COLORS.textSecondary, textAlign: 'center', marginTop: SPACING.xs, maxWidth: 320 },
  button: { alignSelf: 'stretch', marginTop: SPACING.lg },
});
