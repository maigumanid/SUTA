import AsyncStorage from '@react-native-async-storage/async-storage';

import { requireSupabase } from '@/services/supabase';
import type { Tables } from '@/types/supabase';

export type AppAlert = Tables<'notifications'>;

const inboxKey = (uid: string) => `suta_alert_inbox:${uid}`;
const legacyInboxKey = (uid: string) => `suta_notification_inbox:${uid}`;

export async function fetchAlerts(uid: string) {
  const { data, error } = await requireSupabase()
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    throw new Error('Alerts could not be loaded.');
  }

  await AsyncStorage.setItem(inboxKey(uid), JSON.stringify(data));
  await AsyncStorage.removeItem(legacyInboxKey(uid));
  return data;
}

export async function loadCachedAlerts(
  uid: string
): Promise<AppAlert[]> {
  const raw =
    (await AsyncStorage.getItem(inboxKey(uid))) ??
    (await AsyncStorage.getItem(legacyInboxKey(uid)));

  if (!raw) return [];

  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? (value as AppAlert[]) : [];
  } catch {
    return [];
  }
}

export async function markAlertRead(id: string) {
  const { error } = await requireSupabase().rpc(
    'mark_notification_read',
    { p_notification_id: id }
  );

  if (error) {
    throw new Error('The alert could not be marked as read.');
  }
}

export async function markAllAlertsRead() {
  const { error } = await requireSupabase().rpc(
    'mark_all_notifications_read'
  );

  if (error) {
    throw new Error('Alerts could not be marked as read.');
  }
}
