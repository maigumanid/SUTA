import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import InitialsAvatar from '@/components/admin/InitialsAvatar';
import OptionSelector from '@/components/admin/OptionSelector';
import AppButton from '@/components/common/AppButton';
import AppInput from '@/components/common/AppInput';
import KeyboardSafeView from '@/components/common/KeyboardSafeView';
import ScreenContainer from '@/components/common/ScreenContainer';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { fetchAdminBsis, fetchBarangays, reassignBsi, resetBsiPassword, setBsiActive } from '@/services/adminService';
import type { AdminBsiSummary, BarangayOption } from '@/types/admin';
import { formatLocalDateTime } from '@/utils/dateTime';

export default function BsiAccountDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<AdminBsiSummary | null>(null);
  const [barangayId, setBarangayId] = useState('');
  const [barangays, setBarangays] = useState<BarangayOption[]>([]);
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [showRecovery, setShowRecovery] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [accounts, directory] = await Promise.all([fetchAdminBsis(), fetchBarangays()]);
    const match = accounts.find((candidate) => candidate.id === id) ?? null;
    setItem(match);
    setBarangays(directory);
    setBarangayId(match?.barangayId ?? '');
  }, [id]);

  useEffect(() => {
    void load().catch((error) => Alert.alert('Unable to Load Account', error instanceof Error ? error.message : 'Please try again.'));
  }, [load]);

  if (!item) return <ScreenContainer><Text style={styles.empty}>Loading account…</Text></ScreenContainer>;

  const run = async (operation: () => Promise<unknown>, success: string) => {
    setSaving(true);
    try {
      await operation();
      await load();
      Alert.alert('Account Updated', success);
      return true;
    } catch (error) {
      Alert.alert('Unable to Update Account', error instanceof Error ? error.message : 'Please try again.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const barangayName = barangays.find((candidate) => candidate.id === barangayId)?.name ?? '';
  const assignmentOptions = barangays.some((candidate) => candidate.id === item.barangayId)
    ? barangays
    : [{ id: item.barangayId, name: `${item.barangayName} (current legacy assignment)` }, ...barangays];

  const issueTemporaryPassword = () => {
    Alert.alert('Issue Temporary Password?', 'Use this only for account recovery. The BSI must choose a new private password after signing in.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Issue',
        onPress: () => void (async () => {
          const updated = await run(
            () => resetBsiPassword(item.id, temporaryPassword),
            'Temporary credential issued. A password change is now required.'
          );
          if (updated) {
            setTemporaryPassword('');
            setShowRecovery(false);
          }
        })(),
      },
    ]);
  };

  return (
    <ScreenContainer>
      <KeyboardSafeView>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets showsVerticalScrollIndicator={false}>
          <View style={styles.identity}>
            <InitialsAvatar name={item.name} avatarPath={item.avatarPath} />
            <View style={styles.identityCopy}>
              <View style={styles.nameRow}>
                <Text style={styles.title}>{item.name}</Text>
                <View style={[styles.statusChip, item.active ? styles.statusActive : styles.statusInactive]}>
                  <Text style={[styles.statusText, { color: item.active ? COLORS.compliant : COLORS.violation }]}>{item.active ? 'Active' : 'Inactive'}</Text>
                </View>
              </View>
              <Text style={styles.body}>{item.email}</Text>
              <Text style={styles.assignment}>{item.barangayName}</Text>
            </View>
          </View>

          <View style={styles.metrics}>
            <View style={styles.metric}><Text style={styles.metricValue}>{item.inspectionCount}</Text><Text style={styles.metricLabel}>Inspections</Text></View>
            <View style={styles.metric}><Text style={styles.metricValue}>{item.pendingReinspections}</Text><Text style={styles.metricLabel}>Pending follow-ups</Text></View>
          </View>
          <View style={styles.activity}><Text style={styles.activityLabel}>LAST ACTIVITY</Text><Text style={styles.activityValue}>{formatLocalDateTime(item.lastInspectionDate, 'No inspections yet')}</Text></View>

          <View style={styles.sectionBlock}>
            <Text style={styles.section}>Assignment</Text>
            <Text style={styles.helper}>Controls the barangay records available to this BSI.</Text>
            <OptionSelector label="ASSIGNED BARANGAY" value={barangayId} options={assignmentOptions.map((candidate) => ({ value: candidate.id, label: candidate.name }))} onChange={setBarangayId} />
            <AppButton title="Save Assignment" loading={saving} disabled={!barangayId.trim() || !barangayName.trim()} onPress={() => void run(() => reassignBsi(item.id, barangayId.trim(), barangayName.trim()), 'Barangay assignment changed. Historical records were not modified.')} />
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.section}>Account Access</Text>
            <Text style={styles.helper}>{item.active ? 'This account can sign in and access its assigned barangay.' : 'This account is inactive and cannot access protected records.'}</Text>
            {!item.active ? (
              <AppButton title="Reactivate BSI" loading={saving} onPress={() => Alert.alert('Reactivate BSI?', 'The BSI will regain access to the assigned barangay.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Confirm', onPress: () => void run(() => setBsiActive(item.id, true), 'BSI reactivated.') }])} />
            ) : (
              <View style={styles.dangerZone}>
                <Text style={styles.dangerTitle}>Deactivate account</Text>
                <Text style={styles.helper}>Stops backend access while preserving historical records.</Text>
                <AppButton title="Deactivate BSI" variant="danger" loading={saving} onPress={() => Alert.alert('Deactivate BSI?', 'The BSI will lose backend access. Historical records remain.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Deactivate', style: 'destructive', onPress: () => void run(() => setBsiActive(item.id, false), 'BSI deactivated.') }])} />
              </View>
            )}
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.section}>Password Recovery &amp; Security</Text>
            <Text style={styles.helper}>SUTA never reveals the BSI&apos;s private password. Use recovery only when the BSI cannot access the account.</Text>
            {!showRecovery ? (
              <AppButton title="Issue Temporary Password" variant="outline" onPress={() => setShowRecovery(true)} />
            ) : (
              <View style={styles.recoveryPanel}>
                <Text style={styles.recoveryTitle}>Reset account access</Text>
                <Text style={styles.helper}>The temporary credential forces a private password change at the next successful sign-in.</Text>
                <AppInput label="TEMPORARY PASSWORD" value={temporaryPassword} onChangeText={setTemporaryPassword} password />
                <AppButton title="Confirm Temporary Password" loading={saving} disabled={temporaryPassword.length < 8} onPress={issueTemporaryPassword} />
                <AppButton title="Cancel Recovery" variant="outline" disabled={saving} onPress={() => { setTemporaryPassword(''); setShowRecovery(false); }} />
              </View>
            )}
          </View>
          <AppButton title="Back to BSI Accounts" variant="outline" onPress={() => router.back()} />
        </ScrollView>
      </KeyboardSafeView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingVertical: SPACING.xxl, gap: SPACING.lg },
  empty: { marginTop: SPACING.xxxl, textAlign: 'center', color: COLORS.textMuted },
  identity: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md, paddingBottom: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  identityCopy: { flex: 1, minWidth: 0, gap: SPACING.xs },
  nameRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SPACING.sm },
  title: { flexShrink: 1, ...TYPOGRAPHY.title, color: COLORS.text },
  body: { ...TYPOGRAPHY.bodySmall, color: COLORS.textSecondary },
  assignment: { ...TYPOGRAPHY.bodyMedium, color: COLORS.primary },
  statusChip: { minHeight: 26, justifyContent: 'center', paddingHorizontal: SPACING.sm, borderRadius: RADIUS.pill, borderWidth: 1 },
  statusActive: { backgroundColor: COLORS.compliantSoft, borderColor: COLORS.compliant },
  statusInactive: { backgroundColor: COLORS.violationSoft, borderColor: COLORS.violation },
  statusText: { ...TYPOGRAPHY.tiny, fontWeight: '700' },
  metrics: { flexDirection: 'row', gap: SPACING.sm },
  metric: { flex: 1, minWidth: 0, paddingVertical: SPACING.md, paddingHorizontal: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.primarySoft, alignItems: 'center' },
  metricValue: { ...TYPOGRAPHY.heading, color: COLORS.primary },
  metricLabel: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, textAlign: 'center' },
  activity: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: SPACING.sm, paddingHorizontal: SPACING.xs },
  activityLabel: { ...TYPOGRAPHY.label, color: COLORS.textMuted },
  activityValue: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary },
  sectionBlock: { gap: SPACING.md, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, backgroundColor: COLORS.surface },
  section: { ...TYPOGRAPHY.heading, color: COLORS.text },
  helper: { ...TYPOGRAPHY.bodySmall, color: COLORS.textSecondary },
  dangerZone: { gap: SPACING.md, marginTop: SPACING.xs, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.violationSoft },
  dangerTitle: { ...TYPOGRAPHY.bodyMedium, color: COLORS.violation },
  recoveryPanel: { gap: SPACING.md, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.divider },
  recoveryTitle: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text },
});
