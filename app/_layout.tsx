import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import {
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';

import { InspectionProvider } from '@/context/InspectionContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { PlacesProvider } from '@/context/PlacesContext';
import { InspectionSyncProvider } from '@/context/InspectionSyncContext';
import { COLORS } from '@/constants/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SafeAreaView
        edges={['top', 'left', 'right']}
        style={styles.safeArea}
      >
        <AuthProvider>
          <PlacesProvider>
            <InspectionSyncProvider>
              <InspectionProvider>
                <StatusBar style="dark" />
                <RootNavigator />
              </InspectionProvider>
            </InspectionSyncProvider>
          </PlacesProvider>
        </AuthProvider>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { user, profile, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.primary} />
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

      <Stack.Protected guard={isAuthenticated && mustChangePassword}>
        <Stack.Screen name="change-password" />
      </Stack.Protected>

      <Stack.Protected guard={isBsi}>
        <Stack.Screen name="onboarding" />
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
        <Stack.Screen name="reports" />
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
  },
});
