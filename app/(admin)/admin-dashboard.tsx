import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import AdminPage, { adminStyles } from '@/components/admin/AdminPage';
import EntranceTransition from '@/components/common/EntranceTransition';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { fetchAdminDashboard } from '@/services/adminService';
import type { AdminDashboardMetrics } from '@/types/admin';
import NotificationBell from '@/components/common/NotificationBell';
import { useNetwork } from '@/context/NetworkContext';
import { useAuth } from '@/context/AuthContext';
import SectionHeader from '@/components/common/SectionHeader';
import SanitationIllustration from '@/components/illustrations/SanitationIllustration';

type IconName = ComponentProps<typeof Ionicons>['name'];
const cards: { key: keyof AdminDashboardMetrics; label: string; icon: IconName; tone: 'teal' | 'blue' | 'green' | 'warning' | 'danger'; route?: { pathname: '/admin-bsis' | '/admin-inspections'; params?: Record<string, string> } }[] = [
  { key: 'activeBsis', label: 'Active BSIs', icon: 'people-outline', tone: 'blue', route: { pathname: '/admin-bsis', params: { status: 'active' } } },
  { key: 'registeredPlaces', label: 'Registered Places', icon: 'business-outline', tone: 'teal' },
  { key: 'inspections', label: 'Total Inspections', icon: 'clipboard-outline', tone: 'blue', route: { pathname: '/admin-inspections' } },
  { key: 'inspectionsThisMonth', label: 'This Month', icon: 'calendar-outline', tone: 'teal', route: { pathname: '/admin-inspections', params: { period: 'this_month' } } },
  { key: 'compliant', label: 'Compliant', icon: 'checkmark-circle-outline', tone: 'green', route: { pathname: '/admin-inspections', params: { result: 'compliant' } } },
  { key: 'nonCompliant', label: 'Non-Compliant', icon: 'alert-circle-outline', tone: 'danger', route: { pathname: '/admin-inspections', params: { result: 'non_compliant' } } },
  { key: 'forReinspection', label: 'For Reinspection', icon: 'refresh-outline', tone: 'warning', route: { pathname: '/admin-inspections', params: { result: 'for_reinspection' } } },
  { key: 'pendingReinspections', label: 'Pending Reinspections', icon: 'time-outline', tone: 'warning', route: { pathname: '/admin-inspections', params: { reinspection: 'pending' } } },
];

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

  return (
    <AdminPage title="Operations overview" subtitle="Municipality/city sanitation monitoring" headerAction={<NotificationBell />} refreshing={loading && Boolean(metrics)} onRefresh={() => void load()}>
      {loading && !metrics ? <ActivityIndicator color={COLORS.primary} /> : null}
      {error ? <Text style={adminStyles.error}>{error}</Text> : null}
      {metrics ? <>
        <EntranceTransition style={styles.hero}>
          <View style={styles.heroGlow} />
          <View style={styles.heroCopy}>
            <Text style={styles.heroEyebrow}>SANITATION OPERATIONS</Text>
            <Text style={styles.heroTitle}>{profile?.jurisdictionName ?? 'Municipal / City Overview'}</Text>
            <Text style={styles.heroBody}>Monitor inspection coverage, follow-up workload, and priority outcomes from one place.</Text>
          </View>
          <SanitationIllustration variant="reports" size="small" style={styles.heroArt} />
        </EntranceTransition>

        <SectionHeader title="At a glance" subtitle="Live operational totals" actionLabel="Reports" onAction={() => router.push('/(admin)/admin-reports')} />
        <View style={styles.grid}>{cards.map(({ key, label, route, icon, tone }) => {
          const palette = palettes[tone];
          return <Pressable key={key} disabled={!route} onPress={() => route && router.push(route)} style={({ pressed }) => [styles.metric, pressed && route && styles.pressed]}>
            <View style={[styles.metricIcon, { backgroundColor: palette.soft }]}><Ionicons name={icon} size={20} color={palette.strong} /></View>
            <Text style={styles.value}>{metrics[key]}</Text>
            <View style={styles.metricFooter}><Text style={styles.metricLabel}>{label}</Text>{route ? <Ionicons name="arrow-forward" size={14} color={COLORS.textMuted} /> : null}</View>
          </Pressable>;
        })}</View>
      </> : null}
    </AdminPage>
  );
}

const styles = StyleSheet.create({
  hero: { minHeight: 210, position: 'relative', overflow: 'hidden', flexDirection: 'row', alignItems: 'center', padding: SPACING.xl, backgroundColor: COLORS.primaryDeep, borderRadius: RADIUS.xxl, ...SHADOWS.card },
  heroGlow: { position: 'absolute', width: 210, height: 210, borderRadius: 105, right: -70, top: -62, backgroundColor: 'rgba(71,184,174,0.20)' },
  heroCopy: { flex: 1, zIndex: 2, paddingRight: 60 },
  heroEyebrow: { ...TYPOGRAPHY.tiny, color: '#BFE3DF', fontWeight: '800', letterSpacing: 1 },
  heroTitle: { ...TYPOGRAPHY.title, color: COLORS.white, marginTop: SPACING.sm },
  heroBody: { ...TYPOGRAPHY.caption, color: '#D8EBE8', marginTop: SPACING.sm, maxWidth: 250 },
  heroArt: { position: 'absolute', right: -38, bottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  metric: { width: '47.5%', minHeight: 142, justifyContent: 'space-between', padding: SPACING.lg, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.xl, ...SHADOWS.subtle },
  metricIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  value: { ...TYPOGRAPHY.metric, color: COLORS.text, marginTop: SPACING.sm },
  metricFooter: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  metricLabel: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, flex: 1 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
});

const palettes = {
  teal: { soft: COLORS.primarySoft, strong: COLORS.primary },
  blue: { soft: COLORS.blueSoft, strong: COLORS.blue },
  green: { soft: COLORS.compliantSoft, strong: COLORS.compliant },
  warning: { soft: COLORS.warningSoft, strong: COLORS.warning },
  danger: { soft: COLORS.violationSoft, strong: COLORS.violation },
};
