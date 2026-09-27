import AsyncStorage from '@react-native-async-storage/async-storage';

import { InspectionScope } from '@/storage/inspectionStorage';

function reinspectionsKey(scope: InspectionScope) {
  return `suta_reinspections:${scope.bsiUid}:${scope.barangayId}`;
}

export type ReinspectionStatus = 'pending' | 'completed';

export type ReinspectionRecord = {
  id: string;
  bsiUid: string;
  barangayId: string;
  originalInspectionId: string;
  placeId: string;
  scheduledDate: string;
  status: ReinspectionStatus;
  createdAt: string;
  completedAt?: string;
  completedInspectionId?: string;
};

export async function getReinspections(scope: InspectionScope): Promise<
  ReinspectionRecord[]
> {
  try {
    const stored = await AsyncStorage.getItem(
      reinspectionsKey(scope)
    );
    const parsed = stored ? JSON.parse(stored) : [];

    return Array.isArray(parsed)
      ? (parsed as ReinspectionRecord[])
      : [];
  } catch (error) {
    console.error('Unable to load reinspections:', error);
    return [];
  }
}

export async function getReinspectionById(
  id: string,
  scope: InspectionScope
) {
  const records = await getReinspections(scope);
  return records.find((record) => record.id === id);
}

export async function getReinspectionForInspection(
  inspectionId: string,
  scope: InspectionScope
) {
  const records = await getReinspections(scope);
  return records.find(
    (record) =>
      record.originalInspectionId === inspectionId
  );
}

export async function saveReinspectionSchedule(input: {
  bsiUid: string;
  barangayId: string;
  originalInspectionId: string;
  placeId: string;
  scheduledDate: string;
}): Promise<ReinspectionRecord> {
  const records = await getReinspections(input);
  const existing = records.find(
    (record) =>
      record.originalInspectionId ===
      input.originalInspectionId
  );
  const record: ReinspectionRecord = existing
    ? {
        ...existing,
        scheduledDate: input.scheduledDate,
      }
    : {
        id: `reinspection_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 8)}`,
        ...input,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
  const next = existing
    ? records.map((item) =>
        item.id === record.id ? record : item
      )
    : [record, ...records];

  await AsyncStorage.setItem(
    reinspectionsKey(input),
    JSON.stringify(next)
  );
  return record;
}

export async function completeReinspection(
  reinspectionId: string,
  completedInspectionId: string,
  scope: InspectionScope
): Promise<ReinspectionRecord | undefined> {
  const records = await getReinspections(scope);
  const next = records.map((record) =>
    record.id === reinspectionId
      ? {
          ...record,
          status: 'completed' as const,
          completedAt: new Date().toISOString(),
          completedInspectionId,
        }
      : record
  );

  await AsyncStorage.setItem(
    reinspectionsKey(scope),
    JSON.stringify(next)
  );

  return next.find((record) => record.id === reinspectionId);
}
