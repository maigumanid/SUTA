import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import ScreenContainer from '@/components/common/ScreenContainer';
import { COLORS, SPACING, TYPOGRAPHY } from '@/constants/theme';

export default function AdminPage({ title, subtitle, children, refreshing, onRefresh }: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={onRefresh ? (
          <RefreshControl refreshing={refreshing ?? false} onRefresh={onRefresh} />
        ) : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {children}
      </ScrollView>
    </ScreenContainer>
  );
}

export const adminStyles = StyleSheet.create({
  card: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: SPACING.lg, gap: SPACING.xs },
  cardTitle: { ...TYPOGRAPHY.subheading, color: COLORS.text },
  body: { ...TYPOGRAPHY.body, color: COLORS.textSecondary },
  caption: { ...TYPOGRAPHY.caption, color: COLORS.textMuted },
  sectionTitle: { ...TYPOGRAPHY.heading, color: COLORS.text, marginTop: SPACING.md },
  row: { flexDirection: 'row', gap: SPACING.md },
  gridItem: { flex: 1 },
  error: { ...TYPOGRAPHY.body, color: COLORS.violation },
  empty: { ...TYPOGRAPHY.body, color: COLORS.textMuted, textAlign: 'center', paddingVertical: SPACING.xxl },
});

const styles = StyleSheet.create({
  content: { paddingVertical: SPACING.xxl, gap: SPACING.lg },
  header: { marginBottom: SPACING.sm },
  title: { ...TYPOGRAPHY.display, color: COLORS.text },
  subtitle: { ...TYPOGRAPHY.body, color: COLORS.textSecondary, marginTop: SPACING.xs },
});
