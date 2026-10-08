import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
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
import SanitationIllustration from '@/components/illustrations/SanitationIllustration';

export default function RootLayout() {
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

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <SanitationIllustration variant="inspection" size="medium" style={styles.loadingArt} />
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingTitle}>Preparing SUTA</Text>
        <Text style={styles.loadingText}>Restoring your secure workspace</Text>
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
      </Stack.Protected>

      <Stack.Protected guard={isBsi}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="place/new" />
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
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    padding: SPACING.xl,
  },
  loadingArt: { marginBottom: SPACING.sm },
  loadingTitle: { ...TYPOGRAPHY.subheading, color: COLORS.text, marginTop: SPACING.md },
  loadingText: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginTop: SPACING.xs },
});
