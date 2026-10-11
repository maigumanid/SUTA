import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import ScreenContainer from '@/components/common/ScreenContainer';
import { COLORS, LAYOUT, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useNetwork } from '@/context/NetworkContext';

export default function AdminPage({ title, subtitle, children, refreshing, onRefresh, headerAction, allowOfflineContent = false }: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  headerAction?: ReactNode;
  allowOfflineContent?: boolean;
}) {
  const { isOnline } = useNetwork();
  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={onRefresh && isOnline !== false ? (
          <RefreshControl refreshing={refreshing ?? false} onRefresh={onRefresh} />
        ) : undefined}
      >
        <View style={styles.headerRow}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {headerAction ? <View style={styles.headerAction}>{headerAction}</View> : null}
        </View>
        {isOnline === false ? <View style={styles.offlineCard}>
          <Text style={styles.offlineTitle}>Admin tools require an internet connection</Text>
          <Text style={styles.offlineBody}>Municipality-wide data, reports, BSI management, and account changes are server-authoritative. Connect to continue; no offline Admin changes will be queued.</Text>
        </View> : null}
        {isOnline !== false || allowOfflineContent ? children : null}
      </ScrollView>
    </ScreenContainer>
  );
}

export const adminStyles = StyleSheet.create({
  card: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.xl, padding: SPACING.lg, gap: SPACING.xs, ...SHADOWS.subtle },
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
  content: { width: '100%', maxWidth: LAYOUT.contentMaxWidth, alignSelf: 'center', paddingTop: SPACING.xxl, paddingBottom: SPACING.section, gap: SPACING.xl },
  header: { flex: 1, minWidth: 0, marginBottom: SPACING.sm },
  headerRow: { width: '100%', flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md },
  headerAction: { flexShrink: 0, paddingRight: SPACING.xs },
  title: { ...TYPOGRAPHY.display, fontSize: 29, lineHeight: 39, color: COLORS.text },
  subtitle: { ...TYPOGRAPHY.body, color: COLORS.textSecondary, marginTop: SPACING.xs },
  offlineCard: { padding: SPACING.lg, gap: SPACING.sm, backgroundColor: COLORS.offlineSoft, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.border },
  offlineTitle: { ...TYPOGRAPHY.subheading, color: COLORS.offline },
  offlineBody: { ...TYPOGRAPHY.body, color: COLORS.textSecondary },
});
