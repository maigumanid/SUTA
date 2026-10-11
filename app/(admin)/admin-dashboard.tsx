import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { type Href, router, useFocusEffect } from 'expo-router';
import type { ComponentProps } from 'react';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import AdminPage, { adminStyles } from '@/components/admin/AdminPage';
import EntranceTransition from '@/components/common/EntranceTransition';
import SectionHeader from '@/components/common/SectionHeader';
import NotificationBell from '@/components/common/NotificationBell';
import { SUTA_ASSETS } from '@/constants/sutaAssets';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useNetwork } from '@/context/NetworkContext';
import { fetchAdminDashboard } from '@/services/adminService';
import type { AdminDashboardMetrics } from '@/types/admin';

type IconName = ComponentProps<typeof Ionicons>['name'];

export default function AdminDashboardScreen() {
  const { isOnline } = useNetwork();
  const { profile } = useAuth();
  const [metrics, setMetrics] = useState<AdminDashboardMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (isOnline === false) { setLoading(false); setError(null); return; }
    setLoading(true); setError(null);
    try { setMetrics(await fetchAdminDashboard()); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to load dashboard.'); }
    finally { setLoading(false); }
  }, [isOnline]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const firstName = profile?.name?.trim().split(/\s+/)[0];

  return (
    <AdminPage
      title={firstName ? `Good day, ${firstName}` : 'Operations overview'}
      subtitle={profile?.jurisdictionName ?? 'Municipality/city sanitation monitoring'}
      headerAction={<NotificationBell />}
      refreshing={loading && Boolean(metrics)}
      onRefresh={() => void load()}
    >
      {loading && !metrics ? <ActivityIndicator color={COLORS.primary} /> : null}
      {error ? <Text style={adminStyles.error}>{error}</Text> : null}
      {metrics ? <>
        <EntranceTransition style={styles.hero}>
          <View style={styles.heroGlow} />
          <View style={styles.heroCopy}>
            <Text style={styles.heroEyebrow}>MUNICIPAL SANITATION OVERSIGHT</Text>
            <Text style={styles.heroTitle}>See coverage, activity, and follow-up work clearly.</Text>
            <Text style={styles.heroBody}>Current operational totals from authorized inspection records across your jurisdiction.</Text>
          </View>
          <Image accessibilityLabel="Municipal sanitation oversight" source={SUTA_ASSETS.dashboardAdmin} contentFit="contain" transition={140} style={styles.heroArt} />
        </EntranceTransition>

        <EntranceTransition delay={45} style={styles.section}>
          <SectionHeader title="Coverage" subtitle="Inspector capacity and registered places" />
          <View style={styles.coverageBand}>
            <OverviewMetric icon="people-outline" value={metrics.activeBsis} label="Active BSIs" onPress={() => router.push({ pathname: '/admin-bsis', params: { status: 'active' } })} />
            <View style={styles.coverageDivider} />
            <OverviewMetric icon="business-outline" value={metrics.registeredPlaces} label="Registered places" />
          </View>
        </EntranceTransition>

        <EntranceTransition delay={75} style={styles.section}>
          <SectionHeader title="Inspection activity" subtitle="Real recorded inspection totals" actionLabel="View inspections" onAction={() => router.push('/admin-inspections')} />
          <View style={styles.activityPanel}>
            <Pressable onPress={() => router.push({ pathname: '/admin-inspections', params: { period: 'this_month' } })} style={({ pressed }) => [styles.activityFeature, pressed && styles.pressed]}>
              <Text style={styles.activityValue}>{metrics.inspectionsThisMonth}</Text>
              <Text style={styles.activityTitle}>Inspections this month</Text>
              <Text style={styles.activityMeta}>Open this month&apos;s inspection records</Text>
              <Ionicons name="arrow-forward" size={18} color={COLORS.primary} style={styles.activityArrow} />
            </Pressable>
            <View style={styles.activitySide}>
              <SmallMetric value={metrics.inspections} label="All inspections" onPress={() => router.push('/admin-inspections')} />
              <SmallMetric value={metrics.compliant} label="Compliant" tone="green" onPress={() => router.push({ pathname: '/admin-inspections', params: { result: 'compliant' } })} />
            </View>
          </View>
        </EntranceTransition>

        <EntranceTransition delay={105} style={styles.section}>
          <SectionHeader title="Needs attention" subtitle="Current supported follow-up indicators" />
          <View style={styles.attentionPanel}>
            <AttentionRow icon="alert-circle-outline" label="Non-compliant" value={metrics.nonCompliant} tone="danger" onPress={() => router.push({ pathname: '/admin-inspections', params: { result: 'non_compliant' } })} />
            <AttentionRow icon="refresh-outline" label="For reinspection" value={metrics.forReinspection} tone="warning" onPress={() => router.push({ pathname: '/admin-inspections', params: { result: 'for_reinspection' } })} />
            <AttentionRow icon="time-outline" label="Pending reinspections" value={metrics.pendingReinspections} tone="warning" onPress={() => router.push({ pathname: '/admin-inspections', params: { reinspection: 'pending' } })} />
          </View>
        </EntranceTransition>

        <EntranceTransition delay={130} style={styles.section}>
          <SectionHeader title="Management" subtitle="Open an existing Admin workspace" />
          <View style={styles.management}>
            <ManagementLink icon="navigate-circle-outline" title="Field Plan" subtitle="Municipal coverage, priority queue, and map" onPress={() => router.push('/field-planning' as Href)} />
            <ManagementLink icon="people-outline" title="BSI Management" subtitle="Accounts and barangay assignments" onPress={() => router.push('/admin-bsis')} />
            <ManagementLink icon="clipboard-outline" title="Inspections" subtitle="Review authorized inspection records" onPress={() => router.push('/admin-inspections')} />
            <ManagementLink icon="document-text-outline" title="Reports" subtitle="Registers, history, and municipal summary" onPress={() => router.push('/(admin)/admin-reports')} />
          </View>
        </EntranceTransition>
      </> : null}
    </AdminPage>
  );
}

function OverviewMetric({ icon, value, label, onPress }: { icon: IconName; value: number; label: string; onPress?: () => void }) {
  return <Pressable accessibilityRole={onPress ? 'button' : undefined} disabled={!onPress} onPress={onPress} style={({ pressed }) => [styles.overviewMetric, pressed && onPress && styles.pressed]}>
    <View style={styles.overviewIcon}><Ionicons name={icon} size={20} color={COLORS.primary} /></View>
    <Text style={styles.overviewValue}>{value}</Text>
    <Text style={styles.overviewLabel}>{label}</Text>
  </Pressable>;
}

function SmallMetric({ value, label, tone = 'teal', onPress }: { value: number; label: string; tone?: 'teal' | 'green'; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.smallMetric, tone === 'green' && styles.smallMetricGreen, pressed && styles.pressed]}>
    <Text style={styles.smallValue}>{value}</Text><Text style={styles.smallLabel}>{label}</Text>
  </Pressable>;
}

function AttentionRow({ icon, label, value, tone, onPress }: { icon: IconName; label: string; value: number; tone: 'warning' | 'danger'; onPress: () => void }) {
  const danger = tone === 'danger';
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.attentionRow, pressed && styles.pressed]}>
    <View style={[styles.attentionIcon, danger ? styles.dangerSoft : styles.warningSoft]}><Ionicons name={icon} size={20} color={danger ? COLORS.violation : COLORS.warning} /></View>
    <Text style={styles.attentionLabel}>{label}</Text><Text style={[styles.attentionValue, danger && styles.dangerText]}>{value}</Text><Ionicons name="chevron-forward" size={17} color={COLORS.textMuted} />
  </Pressable>;
}

function ManagementLink({ icon, title, subtitle, onPress }: { icon: IconName; title: string; subtitle: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.managementRow, pressed && styles.pressed]}>
    <View style={styles.managementIcon}><Ionicons name={icon} size={21} color={COLORS.primary} /></View>
    <View style={styles.managementCopy}><Text style={styles.managementTitle}>{title}</Text><Text style={styles.managementSubtitle}>{subtitle}</Text></View>
    <Ionicons name="arrow-forward" size={17} color={COLORS.primary} />
  </Pressable>;
}

const styles = StyleSheet.create({
  hero: { minHeight: 390, position: 'relative', overflow: 'hidden', padding: SPACING.xl, backgroundColor: COLORS.primarySoft, borderRadius: RADIUS.xxl, borderWidth: 1, borderColor: COLORS.primaryLight, ...SHADOWS.card },
  heroGlow: { position: 'absolute', width: 270, height: 270, borderRadius: 135, right: -90, top: -100, backgroundColor: 'rgba(71,184,174,0.18)' },
  heroCopy: { zIndex: 2 },
  heroEyebrow: { ...TYPOGRAPHY.tiny, color: COLORS.primary, fontWeight: '800', letterSpacing: 1 },
  heroTitle: { ...TYPOGRAPHY.title, color: COLORS.primaryDeep, marginTop: SPACING.sm, maxWidth: 480 },
  heroBody: { ...TYPOGRAPHY.bodySmall, color: COLORS.textSecondary, marginTop: SPACING.sm, maxWidth: 500 },
  heroArt: { width: '100%', height: 220, marginTop: SPACING.sm },
  section: { gap: SPACING.md },
  coverageBand: { minHeight: 138, flexDirection: 'row', alignItems: 'stretch', backgroundColor: COLORS.primaryDeep, borderRadius: RADIUS.xxl, overflow: 'hidden', ...SHADOWS.subtle },
  overviewMetric: { flex: 1, justifyContent: 'center', padding: SPACING.lg },
  overviewIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.aquaSoft },
  overviewValue: { ...TYPOGRAPHY.metric, color: COLORS.white, marginTop: SPACING.sm },
  overviewLabel: { ...TYPOGRAPHY.caption, color: '#D8EBE8', marginTop: SPACING.xs },
  coverageDivider: { width: 1, marginVertical: SPACING.lg, backgroundColor: 'rgba(255,255,255,0.20)' },
  activityPanel: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  activityFeature: { flex: 1.25, minWidth: 180, minHeight: 184, justifyContent: 'center', padding: SPACING.xl, borderRadius: RADIUS.xxl, backgroundColor: COLORS.aquaSoft, borderWidth: 1, borderColor: COLORS.primaryLight },
  activityValue: { ...TYPOGRAPHY.metric, fontSize: 40, lineHeight: 44, color: COLORS.primaryDeep },
  activityTitle: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text, marginTop: SPACING.sm },
  activityMeta: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginTop: SPACING.xs, paddingRight: SPACING.lg },
  activityArrow: { position: 'absolute', right: SPACING.lg, bottom: SPACING.lg },
  activitySide: { flex: 0.85, minWidth: 124, gap: SPACING.sm },
  smallMetric: { flex: 1, justifyContent: 'center', padding: SPACING.md, borderRadius: RADIUS.xl, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  smallMetricGreen: { backgroundColor: COLORS.compliantSoft, borderColor: '#CDE4D5' },
  smallValue: { ...TYPOGRAPHY.metric, fontSize: 26, lineHeight: 30, color: COLORS.text },
  smallLabel: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginTop: SPACING.xs },
  attentionPanel: { overflow: 'hidden', borderRadius: RADIUS.xxl, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.subtle },
  attentionRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingHorizontal: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  attentionIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  warningSoft: { backgroundColor: COLORS.warningSoft },
  dangerSoft: { backgroundColor: COLORS.violationSoft },
  attentionLabel: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text, flex: 1 },
  attentionValue: { ...TYPOGRAPHY.title, fontSize: 21, lineHeight: 26, color: COLORS.warning },
  dangerText: { color: COLORS.violation },
  management: { gap: SPACING.sm },
  managementRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md, borderRadius: RADIUS.xl, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.subtle },
  managementIcon: { width: 44, height: 44, borderRadius: RADIUS.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primarySoft },
  managementCopy: { flex: 1, minWidth: 0 },
  managementTitle: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text },
  managementSubtitle: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginTop: 2 },
  pressed: { opacity: 0.74, transform: [{ scale: 0.99 }] },
});
