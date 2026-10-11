import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import AppButton from '@/components/common/AppButton';
import AppInput from '@/components/common/AppInput';
import EntranceTransition from '@/components/common/EntranceTransition';
import KeyboardSafeView from '@/components/common/KeyboardSafeView';
import ScreenContainer from '@/components/common/ScreenContainer';
import { SUTA_ASSETS } from '@/constants/sutaAssets';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useNetwork } from '@/context/NetworkContext';
import { SupabaseServiceError } from '@/services/supabaseServiceError';
import { hasAuthenticatedOnDevice, hasCompletedOnboarding } from '@/storage/secureStorage';
import { LoginFormData, loginSchema } from '@/utils/validation';

export default function LoginScreen() {
  const { signIn, configurationReady } = useAuth();
  const { isOnline } = useNetwork();
  const { height, width } = useWindowDimensions();
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

  const compact = height < 720;
  const narrow = width < 360;

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
            <View style={styles.backgroundBase} />
            <View style={styles.topWash} />
            <View style={styles.topWashInner} />
            <View style={styles.middleWash} />
            <View style={styles.bottomWash} />
            <View style={[styles.leaf, styles.leafTopOne]} />
            <View style={[styles.leaf, styles.leafTopTwo]} />
            <View style={[styles.leaf, styles.leafBottomOne]} />
            <View style={[styles.leaf, styles.leafBottomTwo]} />
            <View style={styles.cornerRing} />
          </View>

          <View style={styles.page}>
            <EntranceTransition style={styles.brandBlock}>
              <Image
                accessibilityLabel="SUTA"
                source={SUTA_ASSETS.wordmark}
                contentFit="contain"
                style={[styles.wordmark, narrow && styles.wordmarkNarrow]}
              />
              <Text style={styles.brandLine}>SANITATION FIELD OPERATIONS</Text>
            </EntranceTransition>

            <EntranceTransition delay={45} style={[styles.hero, compact && styles.heroCompact]}>
              <View pointerEvents="none" style={styles.heroArt}>
                <View style={styles.heroBlobLarge} />
                <View style={styles.heroBlobSmall} />
                <View style={styles.waterMark}>
                  <Ionicons name="water" size={22} color={COLORS.primary} />
                </View>
                <View style={styles.checkMark}>
                  <Ionicons name="checkmark" size={18} color={COLORS.white} />
                </View>
              </View>
              <Image
                accessibilityLabel="Sanitary inspector checking a household water and sanitation site"
                source={SUTA_ASSETS.loginFieldInspector}
                contentFit="contain"
                transition={140}
                style={styles.illustration}
              />
              <Text style={styles.heroMessage}>Cleaner places. Safer communities.</Text>
            </EntranceTransition>

            <EntranceTransition delay={90} style={styles.formCard}>
              <View style={styles.heading}>
                <Text accessibilityRole="header" style={styles.title}>Welcome</Text>
                <Text style={styles.description}>Sign in with your authorized account.</Text>
              </View>

              <View style={styles.formFields}>
                {isOnline === false ? (
                  <View style={styles.offlineNotice}>
                    <View style={styles.offlineIcon}>
                      <Ionicons name="cloud-offline-outline" size={19} color={COLORS.offline} />
                    </View>
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
            </EntranceTransition>
          </View>
        </ScrollView>
      </KeyboardSafeView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, width: '100%', alignSelf: 'center', paddingTop: SPACING.md, paddingBottom: SPACING.xxxl, position: 'relative' },
  backgroundArt: { ...StyleSheet.absoluteFillObject, left: -SPACING.xl, right: -SPACING.xl, overflow: 'hidden' },
  backgroundBase: { ...StyleSheet.absoluteFillObject, backgroundColor: '#F7F5EE' },
  topWash: { position: 'absolute', width: 440, height: 330, borderRadius: 220, top: -220, left: '50%', marginLeft: -220, backgroundColor: COLORS.aquaSoft, opacity: 0.92 },
  topWashInner: { position: 'absolute', width: 280, height: 240, borderRadius: 140, top: -170, left: '50%', marginLeft: -140, backgroundColor: COLORS.primaryLight, opacity: 0.82 },
  middleWash: { position: 'absolute', width: 640, height: 430, borderRadius: 220, top: 390, left: '50%', marginLeft: -320, backgroundColor: COLORS.primarySoft, opacity: 0.68, transform: [{ rotate: '-4deg' }] },
  bottomWash: { position: 'absolute', width: 390, height: 390, borderRadius: 195, right: -245, bottom: -155, backgroundColor: COLORS.primaryMist, opacity: 0.82 },
  leaf: { position: 'absolute', width: 18, height: 58, borderRadius: 18, backgroundColor: COLORS.aqua, opacity: 0.18 },
  leafTopOne: { top: 58, left: -4, transform: [{ rotate: '-38deg' }] },
  leafTopTwo: { top: 26, left: 21, height: 42, transform: [{ rotate: '22deg' }] },
  leafBottomOne: { right: 10, bottom: 88, transform: [{ rotate: '45deg' }] },
  leafBottomTwo: { right: 43, bottom: 56, height: 44, backgroundColor: COLORS.primary, transform: [{ rotate: '-22deg' }] },
  cornerRing: { position: 'absolute', width: 116, height: 116, borderRadius: 58, left: -78, bottom: 112, borderWidth: 16, borderColor: 'rgba(71,184,174,0.10)' },
  page: { width: '100%', maxWidth: 520, alignSelf: 'center' },
  brandBlock: { alignItems: 'center', zIndex: 2 },
  wordmark: { width: 174, height: 61 },
  wordmarkNarrow: { width: 154, height: 54 },
  brandLine: { ...TYPOGRAPHY.tiny, marginTop: SPACING.xs, color: COLORS.primary, letterSpacing: 1.7 },
  hero: { height: 264, alignItems: 'center', justifyContent: 'flex-end', marginTop: SPACING.sm, position: 'relative' },
  heroCompact: { height: 202 },
  heroArt: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  heroBlobLarge: { position: 'absolute', width: 286, height: 202, borderRadius: 110, backgroundColor: COLORS.aquaSoft, transform: [{ rotate: '-5deg' }] },
  heroBlobSmall: { position: 'absolute', width: 190, height: 172, right: 34, top: 32, borderRadius: 88, backgroundColor: COLORS.primaryLight, opacity: 0.76, transform: [{ rotate: '18deg' }] },
  waterMark: { position: 'absolute', width: 46, height: 46, left: 28, top: 58, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.92)', borderWidth: 1, borderColor: COLORS.primaryLight, ...SHADOWS.subtle },
  checkMark: { position: 'absolute', width: 38, height: 38, right: 30, top: 34, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary },
  illustration: { width: '86%', height: '94%', zIndex: 2 },
  heroMessage: { ...TYPOGRAPHY.subheading, position: 'absolute', bottom: 0, zIndex: 3, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.pill, color: COLORS.primaryDeep, backgroundColor: 'rgba(255,255,255,0.92)', overflow: 'hidden', ...SHADOWS.subtle },
  formCard: { gap: SPACING.md, marginTop: SPACING.lg, padding: SPACING.lg, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.primaryLight, backgroundColor: 'rgba(255,255,255,0.94)', ...SHADOWS.subtle },
  heading: { width: '100%', alignItems: 'center', paddingBottom: SPACING.xs },
  title: { ...TYPOGRAPHY.title, width: '100%', color: COLORS.text, textAlign: 'center' },
  description: { ...TYPOGRAPHY.bodySmall, width: '100%', color: COLORS.textSecondary, marginTop: SPACING.xs, textAlign: 'center' },
  formFields: { gap: SPACING.md },
  offlineNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, padding: SPACING.md, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: '#DDD2C2', backgroundColor: COLORS.offlineSoft },
  offlineIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface },
  offlineCopy: { flex: 1 },
  offlineTitle: { ...TYPOGRAPHY.label, color: COLORS.offline },
  offlineText: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginTop: SPACING.xs },
  configurationError: { ...TYPOGRAPHY.caption, color: COLORS.violation },
});

function getLoginErrorMessage(error: unknown) {
  if (error instanceof SupabaseServiceError) {
    if (error.code === 'invalid_credentials') return 'The email address or password is incorrect.';
    if (error.retryable) return 'A network connection is required for this sign-in attempt.';
  }
  return error instanceof Error ? error.message : 'Sign-in failed. Please try again.';
}
