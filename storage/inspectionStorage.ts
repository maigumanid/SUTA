import AsyncStorage from '@react-native-async-storage/async-storage';

import { HouseholdInspection } from '@/types/householdInspection';

const INSPECTIONS_KEY =
  'suta_household_inspections';

export type InspectionSyncStatus =
  | 'pending'
  | 'synced'
  | 'failed';

export type StoredInspection =
  HouseholdInspection & {
    id: string;
    savedAt: string;
    syncStatus: InspectionSyncStatus;
  };

function createInspectionId() {
  return `inspection_${Date.now()}_${Math.random()
    .toString(36)
    .substring(2, 8)}`;
}

export async function getStoredInspections(): Promise<
  StoredInspection[]
> {
  try {
    const data =
      await AsyncStorage.getItem(
        INSPECTIONS_KEY
      );

    if (!data) {
      return [];
    }

    const parsed = JSON.parse(data);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed as StoredInspection[];
  } catch (error) {
    console.error(
      'getStoredInspections error:',
      error
    );

    return [];
  }
}

export async function saveInspectionLocally(
  inspection: HouseholdInspection
): Promise<StoredInspection> {
  try {
    const inspections =
      await getStoredInspections();

    const now = new Date();

    const savedInspection: StoredInspection =
      {
        ...inspection,

        id:
          inspection.id ||
          createInspectionId(),

        savedAt: now.toISOString(),

        syncStatus: 'pending',
      };

    const updatedInspections = [
      savedInspection,
      ...inspections,
    ];

    await AsyncStorage.setItem(
      INSPECTIONS_KEY,
      JSON.stringify(updatedInspections)
    );

    return savedInspection;
  } catch (error) {
    console.error(
      'saveInspectionLocally error:',
      error
    );

    throw error;
  }
}

export async function getStoredInspectionById(
  inspectionId: string
): Promise<StoredInspection | null> {
  const inspections =
    await getStoredInspections();

  return (
    inspections.find(
      (inspection) =>
        inspection.id === inspectionId
    ) ?? null
  );
}

export async function getPendingInspections(): Promise<
  StoredInspection[]
> {
  const inspections =
    await getStoredInspections();

  return inspections.filter(
    (inspection) =>
      inspection.syncStatus === 'pending' ||
      inspection.syncStatus === 'failed'
  );
}

export async function updateInspectionSyncStatus(
  inspectionId: string,
  status: InspectionSyncStatus
): Promise<void> {
  const inspections =
    await getStoredInspections();

  const updatedInspections =
    inspections.map((inspection) => {
      if (
        inspection.id !== inspectionId
      ) {
        return inspection;
      }

      return {
        ...inspection,
        syncStatus: status,
      };
    });

  await AsyncStorage.setItem(
    INSPECTIONS_KEY,
    JSON.stringify(updatedInspections)
  );
}

export async function deleteStoredInspection(
  inspectionId: string
): Promise<void> {
  const inspections =
    await getStoredInspections();

  const updatedInspections =
    inspections.filter(
      (inspection) =>
        inspection.id !== inspectionId
    );

  await AsyncStorage.setItem(
    INSPECTIONS_KEY,
    JSON.stringify(updatedInspections)
  );
}

export async function clearStoredInspections(): Promise<void> {
  await AsyncStorage.removeItem(
    INSPECTIONS_KEY
  );
}
