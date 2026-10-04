import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import AdminPage, { adminStyles } from '@/components/admin/AdminPage';
import InitialsAvatar from '@/components/admin/InitialsAvatar';
import OptionSelector from '@/components/admin/OptionSelector';
import AppButton from '@/components/common/AppButton';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { fetchAdminBsis, fetchBarangays } from '@/services/adminService';
import type { AdminBsiSummary, BarangayOption } from '@/types/admin';
import { formatLocalDateTime } from '@/utils/dateTime';

export default function AdminBsisScreen() {
  const params = useLocalSearchParams<{ status?: string }>();
  const [items, setItems] = useState<AdminBsiSummary[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>(params.status === 'active' ? 'active' : 'all');
  const [barangayId, setBarangayId] = useState('all');
  const [barangays, setBarangays] = useState<BarangayOption[]>([]);
  const [sort, setSort] = useState<'name' | 'barangay' | 'recent'>('name');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (params.status === 'active' || params.status === 'inactive') {
      setStatus(params.status);
    }
  }, [params.status]);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [accounts, directory] = await Promise.all([fetchAdminBsis(), fetchBarangays()]);
      setItems(accounts); setBarangays(directory);
    }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to load BSI accounts.'); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesQuery = !needle || `${item.name} ${item.email} ${item.barangayName}`.toLowerCase().includes(needle);
      const matchesStatus = status === 'all' || item.active === (status === 'active');
      return matchesQuery && matchesStatus && (barangayId === 'all' || item.barangayId === barangayId);
    }).sort((left, right) => {
      if (sort === 'barangay') return left.barangayName.localeCompare(right.barangayName) || left.name.localeCompare(right.name);
      if (sort === 'recent') return (right.lastInspectionDate ?? '').localeCompare(left.lastInspectionDate ?? '');
      return left.name.localeCompare(right.name);
    });
  }, [barangayId, items, query, sort, status]);

  return (
    <AdminPage title="BSI Accounts" subtitle="Provision and manage authorized inspectors" refreshing={loading} onRefresh={() => void load()}>
      <AppButton title="Add BSI" onPress={() => router.push('/admin/bsi/new')} />
      <TextInput style={styles.search} placeholder="Search name, email, or barangay" placeholderTextColor={COLORS.textMuted} value={query} onChangeText={setQuery} />
      <View style={styles.filters}>{(['all', 'active', 'inactive'] as const).map((value) => <Pressable key={value} style={[styles.chip, status === value && styles.chipActive]} onPress={() => setStatus(value)}><Text style={[styles.chipText, status === value && styles.chipTextActive]}>{value.charAt(0).toUpperCase() + value.slice(1)}</Text></Pressable>)}</View>
      <OptionSelector label="BARANGAY" value={barangayId} options={[{ value: 'all', label: 'All barangays' }, ...barangays.map((item) => ({ value: item.id, label: item.name }))]} onChange={setBarangayId} />
      <View style={styles.filters}>{(['name', 'barangay', 'recent'] as const).map((value) => <Pressable key={value} style={[styles.chip, sort === value && styles.chipActive]} onPress={() => setSort(value)}><Text style={[styles.chipText, sort === value && styles.chipTextActive]}>{value === 'recent' ? 'Recent Activity' : value.charAt(0).toUpperCase() + value.slice(1)}</Text></Pressable>)}</View>
      {error ? <Text style={adminStyles.error}>{error}</Text> : null}
      {!loading && filtered.length === 0 ? <Text style={adminStyles.empty}>No BSI accounts found.</Text> : null}
      {filtered.map((item) => (
        <Pressable key={item.id} style={[adminStyles.card, styles.accountCard]} onPress={() => router.push({ pathname: '/admin/bsi/[id]', params: { id: item.id } })}>
          <InitialsAvatar name={item.name} />
          <View style={styles.accountBody}><Text style={adminStyles.cardTitle}>{item.name}</Text>
          <Text style={adminStyles.body}>{item.email}</Text>
          <Text style={adminStyles.body}>{item.barangayName}</Text>
          <Text style={[styles.status, { color: item.active ? COLORS.compliant : COLORS.violation }]}>{item.active ? 'Active' : 'Inactive'}</Text>
          <Text style={adminStyles.caption}>{item.inspectionCount} inspections · {item.pendingReinspections} pending reinspections</Text>
          <Text style={adminStyles.caption}>Last activity: {formatLocalDateTime(item.lastInspectionDate, 'No inspections yet')}</Text></View>
        </Pressable>
      ))}
    </AdminPage>
  );
}

const styles = StyleSheet.create({
  search: { ...TYPOGRAPHY.body, minHeight: 48, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.lg, color: COLORS.text, backgroundColor: COLORS.surface },
  status: { ...TYPOGRAPHY.label, marginTop: SPACING.xs },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  chip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.xl, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, backgroundColor: COLORS.surface },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary },
  chipTextActive: { color: COLORS.white },
  accountCard: { flexDirection: 'row', alignItems: 'flex-start' },
  accountBody: { flex: 1 },
});
