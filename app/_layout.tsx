import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import {
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';

import { InspectionProvider } from '@/context/InspectionContext';
import { COLORS } from '@/constants/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SafeAreaView
        edges={['top', 'left', 'right']}
        style={styles.safeArea}
      >
        <InspectionProvider>
          <StatusBar style="dark" />

      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" />

        <Stack.Screen name="login" />

        <Stack.Screen name="onboarding" />

        <Stack.Screen name="(tabs)" />

        <Stack.Screen name="place/[id]" />

        <Stack.Screen name="inspection/new" />

        <Stack.Screen name="inspection/checklist" />

        <Stack.Screen name="inspection/summary" />

        <Stack.Screen name="inspection/violations" />

        <Stack.Screen name="inspection/evidence" />

        <Stack.Screen name="reinspection/[id]" />

        <Stack.Screen name="sync" />
          </Stack>
        </InspectionProvider>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
});
