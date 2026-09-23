import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { InspectionProvider } from '@/context/InspectionContext';

export default function RootLayout() {
  return (
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
  );
}
