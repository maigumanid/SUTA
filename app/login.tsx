import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import AppButton from '@/components/common/AppButton';
import AppInput from '@/components/common/AppInput';
import EntranceTransition from '@/components/common/EntranceTransition';
import KeyboardSafeView from '@/components/common/KeyboardSafeView';
import ScreenContainer from '@/components/common/ScreenContainer';
import SanitationIllustration from '@/components/illustrations/SanitationIllustration';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useNetwork } from '@/context/NetworkContext';
import { SupabaseServiceError } from '@/services/supabaseServiceError';
import { hasAuthenticatedOnDevice, hasCompletedOnboarding } from '@/storage/secureStorage';
import { LoginFormData, loginSchema } from '@/utils/validation';

export default function LoginScreen() {
  const { signIn, configurationReady } = useAuth();
  const { isOnline } = useNetwork();
  const [previouslyAuthenticated, setPreviouslyAuthenticated] = useState(false);

  useEffect(() => { void hasAuthenticatedOnDevice().then(setPreviouslyAuthenticated); }, []);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const handleLogin = async (data: LoginFormData) => {
    if (isOnline === false) {
      Alert.alert(
        previouslyAuthenticated ? "You're offline and signed out" : 'Internet connection required for first sign-in',
        previouslyAuthenticated
          ? 'Sign-in requires an internet connection. Connect to the internet to continue.'
          : 'You need to connect to the internet the first time you sign in on this device. After a successful sign-in, supported BSI features can be used offline.'
      );
      return;
    }

    try {
      const profile = await signIn(data.email, data.password);
      if (profile.mustChangePassword) {
        router.replace('/change-password');
        return;
      }

      const onboardingComplete = await hasCompletedOnboarding(profile.uid, profile.role);
      router.replace(
        onboardingComplete
          ? profile.role === 'admin'
            ? '/(admin)/admin-dashboard'
            : '/(tabs)/dashboard'
          : '/onboarding'
      );
    } catch (error) {
      Alert.alert('Unable to Sign In', getLoginErrorMessage(error));
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
          showsVerticalScrollIndicator={false}
        >
          <View pointerEvents="none" style={styles.backgroundArt}>
            <View style={styles.backgroundGlowOne} />
            <View style={styles.backgroundGlowTwo} />
            <View style={styles.backgroundLine} />
          </View>

          <EntranceTransition style={styles.brandBlock}>
            <Text accessibilityRole="header" style={styles.brand}>SUTA</Text>
            <View style={styles.brandRule} />
            <Text style={styles.brandPurpose}>Community sanitation, clearly recorded.</Text>
          </EntranceTransition>

          <EntranceTransition delay={45} style={styles.hero}>
            <View style={styles.heroCopy}>
              <SanitationIllustration
                variant="inspection"
                size="small"
                style={styles.illustration}
              />
              <View style={styles.heroText}>
                <Text style={styles.heroTitle}>Field inspections you can trust.</Text>
                <Text style={styles.heroDescription}>Secure sanitation records, follow-up work, and practical reporting for authorized local health teams.</Text>
              </View>
            </View>
          </EntranceTransition>

          <EntranceTransition delay={90} style={styles.formCard}>
            <View style={styles.heading}>
              <Text style={styles.title}>Welcome back</Text>
              <Text style={styles.description}>Sign in with your authorized sanitation account.</Text>
            </View>

            <View style={styles.form}>
              {isOnline === false ? (
                <View style={styles.offlineNotice}>
                  <View style={styles.offlineIcon}><Ionicons name="cloud-offline-outline" size={20} color={COLORS.offline} /></View>
                  <View style={styles.offlineCopy}>
                    <Text style={styles.offlineTitle}>No internet connection</Text>
                    <Text style={styles.offlineText}>{previouslyAuthenticated ? "You're offline and signed out. Connect to sign in." : 'First sign-in and signed-out login require internet.'}</Text>
                  </View>
                </View>
              ) : null}

              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <AppInput label="EMAIL ADDRESS" placeholder="inspector@example.com" value={value} onChangeText={onChange} onBlur={onBlur} autoCapitalize="none" keyboardType="email-address" autoCorrect={false} error={errors.email?.message} />
                )}
              />

              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <AppInput label="PASSWORD" placeholder="Enter your password" value={value} onChangeText={onChange} onBlur={onBlur} password autoCapitalize="none" error={errors.password?.message} />
                )}
              />

              <AppButton title="Sign In" onPress={handleSubmit(handleLogin)} loading={isSubmitting} disabled={!configurationReady} />

              {!configurationReady ? <Text style={styles.configurationError}>Supabase configuration is missing. Add the public project values to .env.local and restart Expo.</Text> : null}
            </View>

            <View style={styles.securityNotice}>
              <Ionicons name="shield-checkmark-outline" size={19} color={COLORS.primary} />
              <View style={styles.securityCopy}>
                <Text style={styles.securityTitle}>AUTHORIZED SANITATION PERSONNEL</Text>
                <Text style={styles.securityText}>Need access? Contact your municipal or city sanitation administrator.</Text>
              </View>
            </View>
          </EntranceTransition>
        </ScrollView>
      </KeyboardSafeView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingTop: SPACING.xl, paddingBottom: SPACING.xxxl, position: 'relative' },
  backgroundArt: { ...StyleSheet.absoluteFillObject, left: -SPACING.xl, right: -SPACING.xl, overflow: 'hidden' },
  backgroundGlowOne: { position: 'absolute', width: 260, height: 260, borderRadius: 130, right: -112, top: -76, backgroundColor: COLORS.primaryMist, opacity: 0.9 },
  backgroundGlowTwo: { position: 'absolute', width: 190, height: 190, borderRadius: 95, left: -110, top: 170, backgroundColor: COLORS.blueSoft, opacity: 0.72 },
  backgroundLine: { position: 'absolute', width: 210, height: 210, borderRadius: 105, right: -124, top: 260, borderWidth: 1, borderColor: COLORS.primaryLight },
  brandBlock: { alignItems: 'flex-start' },
  brand: { fontSize: 38, lineHeight: 42, letterSpacing: 5.5, fontWeight: '900', color: COLORS.primaryDeep },
  brandRule: { width: 112, height: 4, borderRadius: 2, marginTop: SPACING.sm, backgroundColor: COLORS.aqua },
  brandPurpose: { ...TYPOGRAPHY.caption, marginTop: SPACING.sm, color: COLORS.textSecondary },
  hero: { marginTop: SPACING.md },
  heroCopy: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, minHeight: 126 },
  heroText: { flex: 1, minWidth: 0 },
  heroTitle: { fontSize: 25, lineHeight: 30, letterSpacing: -0.45, fontWeight: '800', color: COLORS.text },
  heroDescription: { ...TYPOGRAPHY.bodySmall, color: COLORS.textSecondary, marginTop: SPACING.sm },
  illustration: { flexShrink: 0, overflow: 'visible' },
  formCard: { marginTop: SPACING.md, padding: SPACING.xl, backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: RADIUS.xxl, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.card },
  heading: { marginBottom: SPACING.xl },
  title: { ...TYPOGRAPHY.title, color: COLORS.text },
  description: { ...TYPOGRAPHY.bodySmall, color: COLORS.textSecondary, marginTop: SPACING.xs },
  form: { gap: SPACING.lg },
  offlineNotice: { flexDirection: 'row', gap: SPACING.sm, padding: SPACING.md, borderRadius: RADIUS.lg, backgroundColor: COLORS.offlineSoft, borderWidth: 1, borderColor: COLORS.border },
  offlineIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface },
  offlineCopy: { flex: 1 },
  offlineTitle: { ...TYPOGRAPHY.label, color: COLORS.offline },
  offlineText: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginTop: SPACING.xs },
  configurationError: { ...TYPOGRAPHY.caption, color: COLORS.violation },
  securityNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, marginTop: SPACING.xl, paddingTop: SPACING.lg, borderTopWidth: 1, borderTopColor: COLORS.divider },
  securityCopy: { flex: 1 },
  securityTitle: { ...TYPOGRAPHY.label, fontSize: 11, color: COLORS.primary },
  securityText: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, marginTop: SPACING.xs },
});

function getLoginErrorMessage(error: unknown) {
  if (error instanceof SupabaseServiceError) {
    if (error.code === 'invalid_credentials') return 'The email address or password is incorrect.';
    if (error.retryable) return 'A network connection is required for this sign-in attempt.';
  }
  return error instanceof Error ? error.message : 'Sign-in failed. Please try again.';
}
