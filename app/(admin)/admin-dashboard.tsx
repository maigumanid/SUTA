import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import AdminPage, { adminStyles } from '@/components/admin/AdminPage';
import { COLORS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { fetchAdminDashboard } from '@/services/adminService';
import type { AdminDashboardMetrics } from '@/types/admin';

const cards: { key: keyof AdminDashboardMetrics; label: string; route?: { pathname: '/admin-bsis' | '/admin-inspections'; params?: Record<string, string> } }[] = [
  { key: 'activeBsis', label: 'Active BSIs', route: { pathname: '/admin-bsis', params: { status: 'active' } } },
  { key: 'registeredPlaces', label: 'Registered Places' },
  { key: 'inspections', label: 'Total Inspections', route: { pathname: '/admin-inspections' } },
  { key: 'inspectionsThisMonth', label: 'This Month', route: { pathname: '/admin-inspections', params: { period: 'this_month' } } },
  { key: 'compliant', label: 'Compliant', route: { pathname: '/admin-inspections', params: { result: 'compliant' } } },
  { key: 'nonCompliant', label: 'Non-Compliant', route: { pathname: '/admin-inspections', params: { result: 'non_compliant' } } },
  { key: 'forReinspection', label: 'For Reinspection', route: { pathname: '/admin-inspections', params: { result: 'for_reinspection' } } },
  { key: 'pendingReinspections', label: 'Pending Reinspections', route: { pathname: '/admin-inspections', params: { reinspection: 'pending' } } },
];

export default function AdminDashboardScreen() {
  const [metrics, setMetrics] = useState<AdminDashboardMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setMetrics(await fetchAdminDashboard()); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to load dashboard.'); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return (
    <AdminPage title="Sanitation Dashboard" subtitle="Municipality/city-wide operational overview" refreshing={loading && Boolean(metrics)} onRefresh={() => void load()}>
      {loading && !metrics ? <ActivityIndicator color={COLORS.primary} /> : null}
      {error ? <Text style={adminStyles.error}>{error}</Text> : null}
      {metrics ? <View style={styles.grid}>{cards.map(({ key, label, route }) => (
        <Pressable key={key} disabled={!route} onPress={() => route && router.push(route)} style={({ pressed }) => [adminStyles.card, styles.metric, pressed && route && styles.pressed]}>
          <Text style={styles.value}>{metrics[key]}</Text><Text style={adminStyles.caption}>{label}</Text>
        </Pressable>
      ))}</View> : null}
    </AdminPage>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  metric: { width: '47%', minHeight: 100, justifyContent: 'center' },
  value: { ...TYPOGRAPHY.display, color: COLORS.primary },
  pressed: { opacity: 0.7 },
});
