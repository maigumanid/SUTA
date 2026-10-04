import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import AppButton from '@/components/common/AppButton';
import AppInput from '@/components/common/AppInput';
import ScreenContainer from '@/components/common/ScreenContainer';
import { COLORS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { completeSupabasePasswordChange } from '@/services/supabaseProfileService';

export default function ChangePasswordScreen() {
  const { profile, refreshProfile } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (password.length < 8) {
      Alert.alert('Password Required', 'Use at least 8 characters.');
      return;
    }
    if (password !== confirmation) {
      Alert.alert('Passwords Do Not Match', 'Enter the same password twice.');
      return;
    }
    setSaving(true);
    try {
      await completeSupabasePasswordChange(password);
      await refreshProfile();
      router.replace(profile?.role === 'admin' ? '/(admin)/admin-dashboard' : '/(tabs)/dashboard');
    } catch (error) {
      Alert.alert('Unable to Change Password', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Create a new password</Text>
        <Text style={styles.body}>Your administrator issued a temporary credential. Choose a private password before continuing.</Text>
        <View style={styles.form}>
          <AppInput label="NEW PASSWORD" password value={password} onChangeText={setPassword} />
          <AppInput label="CONFIRM PASSWORD" password value={confirmation} onChangeText={setConfirmation} />
          <AppButton title="Save Password" loading={saving} onPress={() => void submit()} />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', paddingVertical: SPACING.xxxl },
  title: { ...TYPOGRAPHY.display, color: COLORS.text },
  body: { ...TYPOGRAPHY.body, color: COLORS.textSecondary, marginTop: SPACING.sm },
  form: { gap: SPACING.lg, marginTop: SPACING.xxl },
});
