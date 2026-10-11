import { Stack } from 'expo-router';
import { Image } from 'expo-image';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Manrope_600SemiBold } from '@expo-google-fonts/manrope/600SemiBold';
import { Manrope_700Bold } from '@expo-google-fonts/manrope/700Bold';
import { Manrope_800ExtraBold } from '@expo-google-fonts/manrope/800ExtraBold';
import { ActivityIndicator, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import {
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';

import { InspectionProvider } from '@/context/InspectionContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { PlacesProvider } from '@/context/PlacesContext';
import { InspectionSyncProvider } from '@/context/InspectionSyncContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { NetworkProvider } from '@/context/NetworkContext';
import ConnectivityBanner from '@/components/common/ConnectivityBanner';
import { COLORS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { SUTA_ASSETS } from '@/constants/sutaAssets';

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  if (!fontsLoaded && !fontError) {
    return <View style={styles.fontLoading}><ActivityIndicator color={COLORS.primary} /></View>;
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView
        edges={['top', 'left', 'right']}
        style={styles.safeArea}
      >
        <NetworkProvider>
          <AuthProvider>
            <PlacesProvider>
              <InspectionSyncProvider>
                <InspectionProvider>
                  <NotificationProvider>
                    <StatusBar style="dark" />
                    <ConnectivityBanner />
                    <RootNavigator />
                  </NotificationProvider>
                </InspectionProvider>
              </InspectionSyncProvider>
            </PlacesProvider>
          </AuthProvider>
        </NetworkProvider>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { user, profile, isLoading } = useAuth();
  const { height, width } = useWindowDimensions();

  if (isLoading) {
    const compact = height < 680;
    return (
      <View style={styles.loading}>
        <View pointerEvents="none" style={styles.loadingDecor}>
          <View style={styles.loadingOrbTop} />
          <View style={styles.loadingOrbBottom} />
          <View style={styles.loadingWave} />
        </View>
        <View style={styles.loadingContent}>
          <Image accessibilityLabel="SUTA" source={SUTA_ASSETS.wordmark} contentFit="contain" style={styles.loadingWordmark} />
          <View style={[styles.loadingArtStage, compact && styles.loadingArtStageCompact]}>
            <Image
              accessibilityLabel="Community sanitation fieldwork"
              source={SUTA_ASSETS.splashCommunity}
              contentFit="contain"
              transition={140}
              style={[styles.loadingArt, { width: Math.min(width - 24, 430), height: compact ? 276 : 356 }]}
            />
          </View>
          <View style={styles.loadingStatus}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <View>
              <Text style={styles.loadingTitle}>Preparing your workspace</Text>
              <Text style={styles.loadingText}>Restoring your session</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  const isAuthenticated = Boolean(user && profile);
  const mustChangePassword = Boolean(profile?.mustChangePassword);
  const isBsi = profile?.role === 'bsi' && !mustChangePassword;
  const isAdmin = profile?.role === 'admin' && !mustChangePassword;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />

      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="login" />
      </Stack.Protected>

      <Stack.Protected guard={isAuthenticated}>
        <Stack.Screen name="change-password" />
      </Stack.Protected>

      <Stack.Protected guard={isAuthenticated && !mustChangePassword}>
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="edit-profile" />
        <Stack.Screen name="field-planning" />
        <Stack.Screen name="field-map" />
      </Stack.Protected>

      <Stack.Protected guard={isBsi}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="place/new" />
        <Stack.Screen name="place/import" />
        <Stack.Screen name="place/edit/[id]" />
        <Stack.Screen name="place/[id]" />
        <Stack.Screen name="inspection/new" />
        <Stack.Screen name="inspection/[id]" />
        <Stack.Screen name="inspection/checklist" />
        <Stack.Screen name="inspection/summary" />
        <Stack.Screen name="inspection/violations" />
        <Stack.Screen name="inspection/evidence" />
        <Stack.Screen name="reinspection/[id]" />
        <Stack.Screen name="sync" />
      </Stack.Protected>

      <Stack.Protected guard={isAdmin}>
        <Stack.Screen name="(admin)" />
        <Stack.Screen name="admin/bsi/new" />
        <Stack.Screen name="admin/bsi/[id]" />
        <Stack.Screen name="admin/inspection/[id]" />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  fontLoading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    overflow: 'hidden',
  },
  loadingContent: { width: '100%', maxWidth: 460, alignItems: 'center' },
  loadingDecor: { ...StyleSheet.absoluteFillObject },
  loadingOrbTop: {
    position: 'absolute',
    width: 290,
    height: 290,
    borderRadius: 145,
    top: -150,
    right: -90,
    backgroundColor: COLORS.aquaSoft,
  },
  loadingOrbBottom: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    bottom: -150,
    left: -90,
    backgroundColor: COLORS.primaryMist,
  },
  loadingWave: {
    position: 'absolute',
    width: 420,
    height: 190,
    borderRadius: 210,
    left: -90,
    bottom: -118,
    borderWidth: 22,
    borderColor: 'rgba(71,184,174,0.16)',
  },
  loadingWordmark: { width: 166, height: 58 },
  loadingArtStage: { width: '100%', height: 350, alignItems: 'center', justifyContent: 'center', marginTop: -SPACING.xs, borderRadius: 180, backgroundColor: 'rgba(227,243,240,0.54)' },
  loadingArtStageCompact: { height: 270 },
  loadingArt: { maxWidth: '100%' },
  loadingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.78)',
  },
  loadingTitle: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text },
  loadingText: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginTop: 1 },
});
