import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const STORAGE_KEYS = {
  INSPECTOR_ID: 'inspector_id',
  DEVICE_AUTHENTICATED: 'suta_device_authenticated',
} as const;

export type OnboardingState = 'completed' | 'skipped';

function onboardingKey(uid: string, role: 'bsi' | 'admin') {
  return `suta_onboarding_v2_${role}_${uid}`;
}

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(key, value);
    return;
  }

  await SecureStore.setItemAsync(key, value);
}

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return await AsyncStorage.getItem(key);
  }

  return await SecureStore.getItemAsync(key);
}

async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(key);
    return;
  }

  await SecureStore.deleteItemAsync(key);
}

/**
 * Save that the inspector has completed the first-login onboarding.
 */
export async function setOnboardingState(
  uid: string,
  role: 'bsi' | 'admin',
  state: OnboardingState
): Promise<void> {
  await setItem(onboardingKey(uid, role), state);
}

/**
 * Check whether the inspector has already completed onboarding.
 */
export async function hasCompletedOnboarding(
  uid: string,
  role: 'bsi' | 'admin'
): Promise<boolean> {
  const value = await getItem(onboardingKey(uid, role));
  return value === 'completed' || value === 'skipped';
}

/**
 * Save the currently logged-in inspector ID.
 * This will be useful once authentication is connected.
 */
export async function saveInspectorId(
  inspectorId: string
): Promise<void> {
  await setItem(STORAGE_KEYS.INSPECTOR_ID, inspectorId);
}

/**
 * Get the saved inspector ID.
 */
export async function getInspectorId(): Promise<string | null> {
  return await getItem(STORAGE_KEYS.INSPECTOR_ID);
}

/**
 * Clear locally stored inspector information.
 * Useful later for logout/testing.
 */
export async function clearSecureStorage(): Promise<void> {
  await deleteItem(STORAGE_KEYS.INSPECTOR_ID);
}

export async function markDeviceAuthenticated(): Promise<void> {
  await setItem(STORAGE_KEYS.DEVICE_AUTHENTICATED, 'true');
}

export async function hasAuthenticatedOnDevice(): Promise<boolean> {
  return (await getItem(STORAGE_KEYS.DEVICE_AUTHENTICATED)) === 'true';
}
