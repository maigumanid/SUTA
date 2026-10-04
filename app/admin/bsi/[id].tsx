import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';

import AppButton from '@/components/common/AppButton';
import AppInput from '@/components/common/AppInput';
import InitialsAvatar from '@/components/admin/InitialsAvatar';
import OptionSelector from '@/components/admin/OptionSelector';
import ScreenContainer from '@/components/common/ScreenContainer';
import { COLORS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { fetchAdminBsis, fetchBarangays, reassignBsi, resetBsiPassword, setBsiActive } from '@/services/adminService';
import type { AdminBsiSummary, BarangayOption } from '@/types/admin';
import { formatLocalDateTime } from '@/utils/dateTime';

export default function BsiAccountDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<AdminBsiSummary | null>(null);
  const [barangayId, setBarangayId] = useState('');
  const [barangays, setBarangays] = useState<BarangayOption[]>([]);
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    const [accounts, directory] = await Promise.all([fetchAdminBsis(), fetchBarangays()]);
    const match = accounts.find((candidate) => candidate.id === id) ?? null;
    setItem(match); setBarangays(directory); setBarangayId(match?.barangayId ?? '');
  }, [id]);
  useEffect(() => { void load().catch((error) => Alert.alert('Unable to Load Account', error instanceof Error ? error.message : 'Please try again.')); }, [load]);
  if (!item) return <ScreenContainer><Text style={styles.empty}>Loading account…</Text></ScreenContainer>;

  const run = async (operation: () => Promise<unknown>, success: string) => {
    setSaving(true);
    try { await operation(); await load(); Alert.alert('Account Updated', success); }
    catch (error) { Alert.alert('Unable to Update Account', error instanceof Error ? error.message : 'Please try again.'); }
    finally { setSaving(false); }
  };
  const barangayName = barangays.find((candidate) => candidate.id === barangayId)?.name ?? '';
  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <InitialsAvatar name={item.name} />
        <Text style={styles.title}>{item.name}</Text><Text style={styles.body}>{item.email}</Text>
        <Text style={[styles.status, { color: item.active ? COLORS.compliant : COLORS.violation }]}>{item.active ? 'Active' : 'Inactive'}</Text>
        <Text style={styles.body}>{item.inspectionCount} inspections · {item.pendingReinspections} pending reinspections</Text>
        <Text style={styles.caption}>Last activity: {formatLocalDateTime(item.lastInspectionDate, 'No inspections yet')}</Text>
        <Text style={styles.section}>Barangay assignment</Text>
        <OptionSelector label="ASSIGNED BARANGAY" value={barangayId} options={barangays.map((candidate) => ({ value: candidate.id, label: candidate.name }))} onChange={setBarangayId} />
        <AppButton title="Save Barangay Assignment" loading={saving} disabled={!barangayId.trim() || !barangayName.trim()} onPress={() => void run(() => reassignBsi(item.id, barangayId.trim(), barangayName.trim()), 'Barangay assignment changed. Historical records were not modified.')} />
        <Text style={styles.section}>Account access</Text>
        <AppButton title={item.active ? 'Deactivate BSI' : 'Reactivate BSI'} variant={item.active ? 'danger' : 'primary'} loading={saving} onPress={() => Alert.alert(item.active ? 'Deactivate BSI?' : 'Reactivate BSI?', item.active ? 'The BSI will lose backend access. Historical records remain.' : 'The BSI will regain access to the assigned barangay.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Confirm', style: item.active ? 'destructive' : 'default', onPress: () => void run(() => setBsiActive(item.id, !item.active), item.active ? 'BSI deactivated.' : 'BSI reactivated.') }])} />
        <Text style={styles.section}>Temporary credential</Text>
        <AppInput label="NEW TEMPORARY PASSWORD" value={temporaryPassword} onChangeText={setTemporaryPassword} password />
        <AppButton title="Reset Password" variant="outline" loading={saving} disabled={temporaryPassword.length < 8} onPress={() => Alert.alert('Reset Password?', 'The BSI will be required to change this temporary password after signing in.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Reset', onPress: () => void run(async () => { await resetBsiPassword(item.id, temporaryPassword); setTemporaryPassword(''); }, 'Temporary credential set.') }])} />
        <AppButton title="Back to BSI Accounts" variant="outline" onPress={() => router.back()} />
      </ScrollView>
    </ScreenContainer>
  );
}
const styles = StyleSheet.create({
  content: { paddingVertical: SPACING.xxl, gap: SPACING.lg }, empty: { marginTop: SPACING.xxxl, textAlign: 'center', color: COLORS.textMuted },
  title: { ...TYPOGRAPHY.display, color: COLORS.text }, body: { ...TYPOGRAPHY.body, color: COLORS.textSecondary }, caption: { ...TYPOGRAPHY.caption, color: COLORS.textMuted },
  status: { ...TYPOGRAPHY.label }, section: { ...TYPOGRAPHY.heading, color: COLORS.text, marginTop: SPACING.md },
});
