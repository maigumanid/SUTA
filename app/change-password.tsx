import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import AppButton from '@/components/common/AppButton';
import AppInput from '@/components/common/AppInput';
import KeyboardSafeView from '@/components/common/KeyboardSafeView';
import ScreenContainer from '@/components/common/ScreenContainer';
import { COLORS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { completeSupabasePasswordChange } from '@/services/supabaseProfileService';
import { SupabaseServiceError } from '@/services/supabaseServiceError';
import { hasCompletedOnboarding } from '@/storage/secureStorage';

export default function ChangePasswordScreen() {
  const { profile, refreshProfile } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [saving, setSaving] = useState(false);
  const isForcedChange = Boolean(profile?.mustChangePassword);

  const returnToProfile = () => {
    router.replace(
      profile?.role === 'admin'
        ? '/(admin)/admin-profile'
        : '/(tabs)/profile'
    );
  };

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
      if (!profile) return;

      if (!isForcedChange) {
        Alert.alert(
          'Password Changed',
          'Your account password was updated successfully.',
          [{ text: 'Done', onPress: returnToProfile }]
        );
        return;
      }

      const onboarded = await hasCompletedOnboarding(profile.uid, profile.role);
      router.replace(onboarded
        ? profile.role === 'admin' ? '/(admin)/admin-dashboard' : '/(tabs)/dashboard'
        : '/onboarding');
    } catch (error) {
      if (
        error instanceof SupabaseServiceError &&
        error.code === 'PASSWORD_CHANGED_REAUTH_REQUIRED'
      ) {
        Alert.alert(
          'Password Changed',
          'Your new password was saved. Sign in once more with the new password to continue.',
          [{ text: 'Continue to Sign In', onPress: () => router.replace('/login') }]
        );
        return;
      }
      Alert.alert('Unable to Change Password', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer>
      <KeyboardSafeView>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
        <Text style={styles.title}>{isForcedChange ? 'Create a new password' : 'Change your password'}</Text>
        <Text style={styles.body}>
          {isForcedChange
            ? 'Your administrator issued a temporary credential. Choose a private password before continuing.'
            : 'Choose a new private password for your SUTA account.'}
        </Text>
        <View style={styles.form}>
          <AppInput label="NEW PASSWORD" password value={password} onChangeText={setPassword} />
          <AppInput label="CONFIRM PASSWORD" password value={confirmation} onChangeText={setConfirmation} />
          <AppButton title="Save Password" loading={saving} onPress={() => void submit()} />
          {!isForcedChange ? <AppButton title="Cancel" variant="outline" disabled={saving} onPress={returnToProfile} /> : null}
        </View>
      </ScrollView>
      </KeyboardSafeView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', paddingVertical: SPACING.xxxl },
  title: { ...TYPOGRAPHY.display, color: COLORS.text },
  body: { ...TYPOGRAPHY.body, color: COLORS.textSecondary, marginTop: SPACING.sm },
  form: { gap: SPACING.lg, marginTop: SPACING.xxl },
});
