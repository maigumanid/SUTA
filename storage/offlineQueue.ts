import AsyncStorage from '@react-native-async-storage/async-storage';

const OFFLINE_QUEUE_KEY = '@sanitary_inspection_queue';

export interface QueueItem<T = unknown> {
  id: string;
  type: string;
  createdAt: string;
  data: T;
}

export async function getOfflineQueue(): Promise<QueueItem[]> {
  try {
    const value = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);

    if (!value) {
      return [];
    }

    return JSON.parse(value) as QueueItem[];
  } catch (error) {
    console.error('Failed to read offline queue:', error);
    return [];
  }
}

export async function addToOfflineQueue<T>(
  item: QueueItem<T>
): Promise<void> {
  const queue = await getOfflineQueue();

  queue.push(item);

  await AsyncStorage.setItem(
    OFFLINE_QUEUE_KEY,
    JSON.stringify(queue)
  );
}

export async function removeFromOfflineQueue(
  id: string
): Promise<void> {
  const queue = await getOfflineQueue();

  const updatedQueue = queue.filter(
    (item) => item.id !== id
  );

  await AsyncStorage.setItem(
    OFFLINE_QUEUE_KEY,
    JSON.stringify(updatedQueue)
  );
}

export async function clearOfflineQueue(): Promise<void> {
  await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
}
