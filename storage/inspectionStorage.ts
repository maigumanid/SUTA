import AsyncStorage from '@react-native-async-storage/async-storage';

import { HouseholdInspection } from '@/types/householdInspection';

export type InspectionScope = {
  bsiUid: string;
  barangayId: string;
};

function inspectionsKey(scope: InspectionScope) {
  return `suta_household_inspections:${scope.bsiUid}:${scope.barangayId}`;
}

export type InspectionSyncStatus =
  | 'pending'
  | 'synced'
  | 'failed';

export type StoredInspection =
  HouseholdInspection & {
    id: string;
    bsiUid: string;
    barangayId: string;
    savedAt: string;
    syncStatus: InspectionSyncStatus;
  };

function createInspectionId() {
  return `inspection_${Date.now()}_${Math.random()
    .toString(36)
    .substring(2, 8)}`;
}

export async function getStoredInspections(scope: InspectionScope): Promise<
  StoredInspection[]
> {
  try {
    const data =
      await AsyncStorage.getItem(
        inspectionsKey(scope)
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
  inspection: HouseholdInspection & InspectionScope
): Promise<StoredInspection> {
  try {
    const inspections =
      await getStoredInspections(inspection);

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
      inspectionsKey(inspection),
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
  inspectionId: string,
  scope: InspectionScope
): Promise<StoredInspection | null> {
  const inspections =
    await getStoredInspections(scope);

  return (
    inspections.find(
      (inspection) =>
        inspection.id === inspectionId
    ) ?? null
  );
}

export async function getPendingInspections(scope: InspectionScope): Promise<
  StoredInspection[]
> {
  const inspections =
    await getStoredInspections(scope);

  return inspections.filter(
    (inspection) =>
      inspection.syncStatus === 'pending' ||
      inspection.syncStatus === 'failed'
  );
}

export async function updateInspectionSyncStatus(
  inspectionId: string,
  status: InspectionSyncStatus,
  scope: InspectionScope
): Promise<void> {
  const inspections =
    await getStoredInspections(scope);

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
    inspectionsKey(scope),
    JSON.stringify(updatedInspections)
  );
}

export async function deleteStoredInspection(
  inspectionId: string,
  scope: InspectionScope
): Promise<void> {
  const inspections =
    await getStoredInspections(scope);

  const updatedInspections =
    inspections.filter(
      (inspection) =>
        inspection.id !== inspectionId
    );

  await AsyncStorage.setItem(
    inspectionsKey(scope),
    JSON.stringify(updatedInspections)
  );
}

export async function clearStoredInspections(scope: InspectionScope): Promise<void> {
  await AsyncStorage.removeItem(
    inspectionsKey(scope)
  );
}
