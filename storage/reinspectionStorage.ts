import AsyncStorage from '@react-native-async-storage/async-storage';

const REINSPECTIONS_KEY = 'suta_reinspections';

export type ReinspectionStatus = 'pending' | 'completed';

export type ReinspectionRecord = {
  id: string;
  originalInspectionId: string;
  placeId: string;
  scheduledDate: string;
  status: ReinspectionStatus;
  createdAt: string;
  completedAt?: string;
  completedInspectionId?: string;
};

export async function getReinspections(): Promise<
  ReinspectionRecord[]
> {
  try {
    const stored = await AsyncStorage.getItem(
      REINSPECTIONS_KEY
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
  id: string
) {
  const records = await getReinspections();
  return records.find((record) => record.id === id);
}

export async function getReinspectionForInspection(
  inspectionId: string
) {
  const records = await getReinspections();
  return records.find(
    (record) =>
      record.originalInspectionId === inspectionId
  );
}

export async function saveReinspectionSchedule(input: {
  originalInspectionId: string;
  placeId: string;
  scheduledDate: string;
}): Promise<ReinspectionRecord> {
  const records = await getReinspections();
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
    REINSPECTIONS_KEY,
    JSON.stringify(next)
  );
  return record;
}

export async function completeReinspection(
  reinspectionId: string,
  completedInspectionId: string
) {
  const records = await getReinspections();
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
    REINSPECTIONS_KEY,
    JSON.stringify(next)
  );
}
