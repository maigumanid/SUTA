import * as SecureStore from 'expo-secure-store';

const STORAGE_KEYS = {
  ONBOARDING_COMPLETE: 'onboarding_complete',
  INSPECTOR_ID: 'inspector_id',
} as const;

/**
 * Save that the inspector has completed the first-login onboarding.
 */
export async function setOnboardingComplete(): Promise<void> {
  await SecureStore.setItemAsync(
    STORAGE_KEYS.ONBOARDING_COMPLETE,
    'true'
  );
}

/**
 * Check whether the inspector has already completed onboarding.
 */
export async function hasCompletedOnboarding(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(
    STORAGE_KEYS.ONBOARDING_COMPLETE
  );

  return value === 'true';
}

/**
 * Save the currently logged-in inspector ID.
 * This will be useful once authentication is connected.
 */
export async function saveInspectorId(
  inspectorId: string
): Promise<void> {
  await SecureStore.setItemAsync(
    STORAGE_KEYS.INSPECTOR_ID,
    inspectorId
  );
}

/**
 * Get the saved inspector ID.
 */
export async function getInspectorId(): Promise<string | null> {
  return await SecureStore.getItemAsync(
    STORAGE_KEYS.INSPECTOR_ID
  );
}

/**
 * Clear locally stored inspector information.
 * Useful later for logout/testing.
 */
export async function clearSecureStorage(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(
      STORAGE_KEYS.ONBOARDING_COMPLETE
    ),
    SecureStore.deleteItemAsync(
      STORAGE_KEYS.INSPECTOR_ID
    ),
  ]);
}
