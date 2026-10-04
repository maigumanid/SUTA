import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import AdminPage, { adminStyles } from '@/components/admin/AdminPage';
import OptionSelector from '@/components/admin/OptionSelector';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { fetchAdminBsis, fetchAdminInspections, fetchBarangays } from '@/services/adminService';
import type { AdminBsiSummary, AdminInspectionSummary } from '@/types/admin';
import { formatLocalDateTime } from '@/utils/dateTime';

type ResultFilter = 'all' | 'compliant' | 'non_compliant' | 'for_reinspection';
const filters: ResultFilter[] = ['all', 'compliant', 'non_compliant', 'for_reinspection'];
const resultLabel = (value: string) => value === 'non_compliant'
  ? 'Non-Compliant'
  : value === 'for_reinspection'
    ? 'For Reinspection'
    : value === 'compliant' ? 'Compliant' : value;

export default function AdminInspectionsScreen() {
  const params = useLocalSearchParams<{ result?: string; period?: string; reinspection?: string }>();
  const [items, setItems] = useState<AdminInspectionSummary[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ResultFilter>(filters.includes(params.result as ResultFilter) ? params.result as ResultFilter : 'all');
  const [barangayId, setBarangayId] = useState('all');
  const [bsiId, setBsiId] = useState('all');
  const [inspectionType, setInspectionType] = useState<'all' | 'inspection' | 'reinspection'>('all');
  const [period, setPeriod] = useState<'all' | 'this_month'>(params.period === 'this_month' ? 'this_month' : 'all');
  const [barangayOptions, setBarangayOptions] = useState<{ value: string; label: string }[]>([]);
  const [bsis, setBsis] = useState<AdminBsiSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (filters.includes(params.result as ResultFilter)) {
      setFilter(params.result as ResultFilter);
    }
    if (params.period === 'this_month') setPeriod('this_month');
  }, [params.period, params.result]);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [records, barangays, bsis] = await Promise.all([fetchAdminInspections(), fetchBarangays(), fetchAdminBsis()]);
      setItems(records);
      setBarangayOptions(barangays.map((item) => ({ value: item.id, label: item.name })));
      setBsis(bsis);
    }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to load inspections.'); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const bsiOptions = useMemo(
    () => bsis
      .filter((bsi) => barangayId === 'all' || bsi.barangayId === barangayId)
      .map((bsi) => ({
        value: bsi.id,
        label: `${bsi.name}${bsi.active ? '' : ' (Inactive)'}`,
      })),
    [barangayId, bsis]
  );
  useEffect(() => {
    if (bsiId !== 'all' && !bsiOptions.some((option) => option.value === bsiId)) {
      setBsiId('all');
    }
  }, [bsiId, bsiOptions]);
  const visible = useMemo(() => items.filter((item) => {
    const matchesFilter = filter === 'all' || item.result === filter;
    const needle = query.trim().toLowerCase();
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    return matchesFilter &&
      (barangayId === 'all' || item.barangayId === barangayId) &&
      (bsiId === 'all' || item.bsiId === bsiId) &&
      (inspectionType === 'all' || item.inspectionType === inspectionType) &&
      (period === 'all' || new Date(item.inspectionDate) >= monthStart) &&
      (params.reinspection !== 'pending' || item.reinspectionStatus === 'pending') &&
      (!needle || `${item.placeName} ${item.barangayName} ${item.bsiName}`.toLowerCase().includes(needle));
  }), [barangayId, bsiId, filter, inspectionType, items, params.reinspection, period, query]);

  return (
    <AdminPage title="Inspection Oversight" subtitle="Read-only records across all barangays" refreshing={loading} onRefresh={() => void load()}>
      <TextInput style={styles.search} placeholder="Search place, barangay, or BSI" placeholderTextColor={COLORS.textMuted} value={query} onChangeText={setQuery} />
      <View style={styles.filters}>{filters.map((value) => <Pressable key={value} style={[styles.chip, filter === value && styles.chipActive]} onPress={() => setFilter(value)}><Text style={[styles.chipText, filter === value && styles.chipTextActive]}>{value === 'all' ? 'All' : resultLabel(value)}</Text></Pressable>)}</View>
      <OptionSelector label="BARANGAY" value={barangayId} options={[{ value: 'all', label: 'All barangays' }, ...barangayOptions]} onChange={setBarangayId} />
      <OptionSelector label="INSPECTOR" value={bsiId} options={[{ value: 'all', label: 'All BSIs' }, ...bsiOptions]} onChange={setBsiId} />
      <View style={styles.filters}>{(['all', 'inspection', 'reinspection'] as const).map((value) => <Pressable key={value} style={[styles.chip, inspectionType === value && styles.chipActive]} onPress={() => setInspectionType(value)}><Text style={[styles.chipText, inspectionType === value && styles.chipTextActive]}>{value === 'all' ? 'All types' : value === 'reinspection' ? 'Reinspection' : 'Inspection'}</Text></Pressable>)}</View>
      <View style={styles.filters}>{(['all', 'this_month'] as const).map((value) => <Pressable key={value} style={[styles.chip, period === value && styles.chipActive]} onPress={() => setPeriod(value)}><Text style={[styles.chipText, period === value && styles.chipTextActive]}>{value === 'all' ? 'All dates' : 'This month'}</Text></Pressable>)}</View>
      {error ? <Text style={adminStyles.error}>{error}</Text> : null}
      {!loading && visible.length === 0 ? <Text style={adminStyles.empty}>No inspections found.</Text> : null}
      {visible.map((item) => <Pressable key={item.id} style={adminStyles.card} onPress={() => router.push({ pathname: '/admin/inspection/[id]', params: { id: item.id } })}>
        <Text style={adminStyles.cardTitle}>{item.placeName}</Text>
        <Text style={adminStyles.body}>{item.barangayName} · {item.bsiName}</Text>
        <Text style={adminStyles.body}>{item.inspectionType === 'reinspection' ? 'Reinspection' : 'Inspection'} · {resultLabel(item.result)}</Text>
        <Text style={adminStyles.caption}>{formatLocalDateTime(item.inspectionDate)}</Text>
        <Text style={adminStyles.caption}>Risk: {item.riskLevel === 'Unclassified' ? 'Not yet classified' : `${item.riskLevel} Risk${item.riskPercentage === null ? '' : ` (${Math.round(item.riskPercentage)}%)`}`}</Text>
        {item.reinspectionStatus ? <Text style={adminStyles.caption}>Reinspection: {item.reinspectionStatus}</Text> : null}
      </Pressable>)}
    </AdminPage>
  );
}

const styles = StyleSheet.create({
  search: { ...TYPOGRAPHY.body, minHeight: 48, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.lg, color: COLORS.text, backgroundColor: COLORS.surface },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  chip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.xl, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, backgroundColor: COLORS.surface },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary },
  chipTextActive: { color: COLORS.white },
});
