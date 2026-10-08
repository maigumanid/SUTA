import { router } from 'expo-router';
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { useNetwork } from '@/context/NetworkContext';
import {
  fetchAlerts,
  loadCachedAlerts,
  markAlertRead,
  markAllAlertsRead,
  type AppAlert,
} from '@/services/alertService';

type NotificationContextValue = {
  items: AppAlert[]; unreadCount: number; loading: boolean; error: string | null;
  refresh: () => Promise<void>;
  open: (item: AppAlert) => Promise<void>; markAllRead: () => Promise<void>;
};
const Context = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: PropsWithChildren) {
  const { user, profile } = useAuth();
  const { isOnline } = useNetwork();
  const [items, setItems] = useState<AppAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    if (!user || !profile || profile.mustChangePassword) { setItems([]); return; }
    if (isOnline === false) {
      const cached = await loadCachedAlerts(user.uid);
      setItems(cached);
      setError('You’re offline. Showing alerts saved on this device; refresh will resume when you reconnect.');
      return;
    }
    setLoading(true);
    setError(null);
    try { setItems(await fetchAlerts(user.uid)); }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Alerts could not be loaded.'); }
    finally { setLoading(false); }
  }, [isOnline, profile, user]);

  const navigate = useCallback((routeKind: string, entityId: string | null) => {
    if (!profile) return;
    if (routeKind === 'profile') {
      router.push(profile.role === 'admin' ? '/(admin)/admin-profile' : '/(tabs)/profile');
      return;
    }
    if (!entityId || !/^[A-Za-z0-9_-]+$/.test(entityId)) {
      router.replace(profile.role === 'admin' ? '/(admin)/admin-dashboard' : '/(tabs)/dashboard');
      return;
    }
    if (profile.role === 'admin' && routeKind === 'admin_inspection') router.push({ pathname: '/admin/inspection/[id]', params: { id: entityId } });
    else if (profile.role === 'admin' && routeKind === 'admin_bsi') router.push({ pathname: '/admin/bsi/[id]', params: { id: entityId } });
    else if (profile.role === 'bsi' && routeKind === 'bsi_place') router.push({ pathname: '/place/[id]', params: { id: entityId } });
    else if (profile.role === 'bsi' && routeKind === 'bsi_reinspection') router.push({ pathname: '/reinspection/[id]', params: { id: entityId } });
    else router.replace(profile.role === 'admin' ? '/(admin)/admin-dashboard' : '/(tabs)/dashboard');
  }, [profile]);

  useEffect(() => { void refresh().catch(() => undefined); }, [refresh]);
  useEffect(() => {
    if (!user || !profile || profile.mustChangePassword) return;
    const state = AppState.addEventListener('change', (next) => { if (next === 'active') void refresh().catch(() => undefined); });
    return () => state.remove();
  }, [profile, refresh, user]);

  const value = useMemo<NotificationContextValue>(() => ({
    items, unreadCount: items.filter((item) => !item.read_at).length, loading, error, refresh,
    open: async (item) => { if (!item.read_at && isOnline !== false) { await markAlertRead(item.id); await refresh(); } navigate(item.route_kind, item.route_entity_id); },
    markAllRead: async () => { if (isOnline === false) return; await markAllAlertsRead(); await refresh(); },
  }), [error, isOnline, items, loading, navigate, refresh]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useNotifications() {
  const value = useContext(Context);
  if (!value) throw new Error('useNotifications must be used inside NotificationProvider.');
  return value;
}
