import * as Location from 'expo-location';

import {
  InspectionLocation,
  LocationCaptureStatus,
} from '@/types/householdInspection';

export type InspectionLocationResult = {
  status: Exclude<LocationCaptureStatus, 'not_attempted'>;
  attemptedAt: string;
  location?: InspectionLocation;
  errorMessage?: string;
  canAskAgain?: boolean;
};

const LOCATION_TIMEOUT_MS = 20000;
const LAST_KNOWN_MAX_AGE_MS = 60000;
const LAST_KNOWN_REQUIRED_ACCURACY_METERS = 100;

async function getCurrentPositionWithTimeout() {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(
            new Error('Location request timed out.')
          );
        }, LOCATION_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function toInspectionLocation(
  position: Location.LocationObject,
  fallbackTimestamp: string
): InspectionLocation {
  const capturedAt = Number.isFinite(
    position.timestamp
  )
    ? new Date(position.timestamp).toISOString()
    : fallbackTimestamp;

  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    ...(position.coords.accuracy !== null
      ? { accuracy: position.coords.accuracy }
      : {}),
    capturedAt,
  };
}

export async function captureInspectionLocation(): Promise<InspectionLocationResult> {
  const attemptedAt = new Date().toISOString();

  try {
    const permission =
      await Location.requestForegroundPermissionsAsync();

    if (permission.status !== 'granted') {
      return {
        status: 'permission_denied',
        attemptedAt,
        canAskAgain: permission.canAskAgain,
      };
    }

    const servicesEnabled =
      await Location.hasServicesEnabledAsync();

    if (!servicesEnabled) {
      return {
        status: 'services_disabled',
        attemptedAt,
      };
    }

    let position: Location.LocationObject | null = null;

    try {
      position =
        await getCurrentPositionWithTimeout();
    } catch (currentError) {
      console.warn(
        'Fresh location fix unavailable; checking for a recent device location:',
        currentError
      );

      position =
        await Location.getLastKnownPositionAsync({
          maxAge: LAST_KNOWN_MAX_AGE_MS,
          requiredAccuracy:
            LAST_KNOWN_REQUIRED_ACCURACY_METERS,
        });
    }

    if (!position) {
      return {
        status: 'unavailable',
        attemptedAt,
        errorMessage:
          'No current or recent accurate device location was available.',
      };
    }

    return {
      status: 'captured',
      attemptedAt,
      location: toInspectionLocation(
        position,
        attemptedAt
      ),
    };
  } catch (error) {
    console.error(
      'Unable to capture inspection location:',
      error
    );

    return {
      status: 'unavailable',
      attemptedAt,
      errorMessage:
        error instanceof Error
          ? error.message
          : 'Unknown location error',
    };
  }
}
