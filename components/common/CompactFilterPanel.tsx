import { Ionicons } from '@expo/vector-icons';
import { type PropsWithChildren, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';

type CompactFilterPanelProps = PropsWithChildren<{
  activeCount: number;
  summary?: string;
  onClear?: () => void;
  initiallyExpanded?: boolean;
}>;

export default function CompactFilterPanel({
  activeCount,
  summary,
  onClear,
  initiallyExpanded = false,
  children,
}: CompactFilterPanelProps) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const hasActiveFilters = activeCount > 0;

  return (
    <View style={styles.shell}>
      <View style={styles.toolbar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Hide filters' : 'Show filters'}
          accessibilityState={{ expanded }}
          onPress={() => setExpanded((current) => !current)}
          style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}
        >
          <View style={styles.icon}><Ionicons name="options-outline" size={18} color={COLORS.primary} /></View>
          <View style={styles.copy}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Filters</Text>
              {hasActiveFilters ? <View style={styles.count}><Text style={styles.countText}>{activeCount}</Text></View> : null}
            </View>
            <Text numberOfLines={1} style={styles.summary}>{summary || (hasActiveFilters ? `${activeCount} active` : 'All records')}</Text>
          </View>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={19} color={COLORS.textSecondary} />
        </Pressable>
        {hasActiveFilters && onClear ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Clear all filters" onPress={onClear} style={({ pressed }) => [styles.clear, pressed && styles.pressed]}>
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        ) : null}
      </View>
      {expanded ? <View style={styles.content}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, backgroundColor: COLORS.surface, overflow: 'hidden' },
  toolbar: { minHeight: 52, flexDirection: 'row', alignItems: 'stretch' },
  toggle: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  icon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.md, backgroundColor: COLORS.primarySoft },
  copy: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  title: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text },
  summary: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary },
  count: { minWidth: 21, height: 21, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill, backgroundColor: COLORS.primary },
  countText: { ...TYPOGRAPHY.tiny, color: COLORS.white, fontWeight: '700' },
  clear: { minWidth: 58, alignItems: 'center', justifyContent: 'center', borderLeftWidth: 1, borderLeftColor: COLORS.divider, paddingHorizontal: SPACING.md },
  clearText: { ...TYPOGRAPHY.label, color: COLORS.primary },
  content: { gap: SPACING.md, padding: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.divider, backgroundColor: COLORS.surfaceElevated },
  pressed: { opacity: 0.68 },
});
