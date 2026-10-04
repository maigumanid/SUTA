import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';

import AppButton from '@/components/common/AppButton';
import AppInput from '@/components/common/AppInput';
import OptionSelector from '@/components/admin/OptionSelector';
import ScreenContainer from '@/components/common/ScreenContainer';
import { COLORS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { createBsiAccount, fetchBarangays } from '@/services/adminService';
import type { BarangayOption } from '@/types/admin';

export default function AddBsiScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [barangayId, setBarangayId] = useState('');
  const [barangays, setBarangays] = useState<BarangayOption[]>([]);
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    void fetchBarangays().then(setBarangays).catch((error) => {
      Alert.alert('Unable to Load Barangays', error instanceof Error ? error.message : 'Please try again.');
    });
  }, []);
  const barangayName = useMemo(
    () => barangays.find((item) => item.id === barangayId)?.name ?? '',
    [barangayId, barangays]
  );
  const submit = async () => {
    if (![name, email, contactNumber, barangayId, barangayName].every((value) => value.trim()) || temporaryPassword.length < 8) {
      Alert.alert('Complete Required Fields', 'Complete every field and use a temporary password of at least 8 characters.');
      return;
    }
    setSaving(true);
    try {
      await createBsiAccount({ name: name.trim(), email: email.trim(), contactNumber: contactNumber.trim(), barangayId: barangayId.trim(), barangayName: barangayName.trim(), temporaryPassword });
      Alert.alert('BSI Created', 'The BSI can sign in with the temporary credential and must change it on first login.', [{ text: 'Done', onPress: () => router.back() }]);
    } catch (error) {
      Alert.alert('Unable to Create BSI', error instanceof Error ? error.message : 'Please try again.');
    } finally { setSaving(false); }
  };
  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Add BSI</Text>
        <Text style={styles.body}>Provision an authorized inspector. Account creation requires an internet connection.</Text>
        <AppInput label="FULL NAME" value={name} onChangeText={setName} />
        <AppInput label="EMAIL" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <AppInput label="CONTACT NUMBER" value={contactNumber} onChangeText={setContactNumber} keyboardType="phone-pad" />
        <OptionSelector
          label="ASSIGNED BARANGAY"
          value={barangayId}
          options={barangays.map((item) => ({ value: item.id, label: item.name }))}
          onChange={setBarangayId}
          placeholder="Select a barangay"
        />
        <AppInput label="TEMPORARY PASSWORD" value={temporaryPassword} onChangeText={setTemporaryPassword} password />
        <Text style={styles.note}>Share the temporary credential through an approved private channel. It is never stored by the app.</Text>
        <AppButton title="Create BSI" loading={saving} onPress={() => void submit()} />
        <AppButton title="Cancel" variant="outline" disabled={saving} onPress={() => router.back()} />
      </ScrollView>
    </ScreenContainer>
  );
}
const styles = StyleSheet.create({
  content: { paddingVertical: SPACING.xxl, gap: SPACING.lg },
  title: { ...TYPOGRAPHY.display, color: COLORS.text },
  body: { ...TYPOGRAPHY.body, color: COLORS.textSecondary },
  note: { ...TYPOGRAPHY.caption, color: COLORS.textMuted },
});
