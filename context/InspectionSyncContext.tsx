import NetInfo from '@react-native-community/netinfo';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useAuth } from '@/context/AuthContext';
import { usePlaces } from '@/context/PlacesContext';
import {
  retryPendingInspections,
  syncStoredInspection,
  type InspectionSyncPassResult,
} from '@/services/inspectionSyncService';
import type { InspectionScope } from '@/storage/inspectionStorage';
import { isNetworkStateOnline } from '@/utils/networkState';

type InspectionSyncContextValue = {
  isOnline: boolean | null;
  isSyncing: boolean;
  retryAllInspections: () => Promise<InspectionSyncPassResult>;
  retryInspection: (inspectionId: string) => Promise<void>;
  syncRevision: number;
  syncingInspectionIds: ReadonlySet<string>;
};

const InspectionSyncContext =
  createContext<InspectionSyncContextValue | null>(null);

function getScopeKey(scope: InspectionScope) {
  return `${scope.bsiUid}:${scope.barangayId}`;
}

export function InspectionSyncProvider({ children }: PropsWithChildren) {
  const { profile } = useAuth();
  const { refreshPlaces } = usePlaces();
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncRevision, setSyncRevision] = useState(0);
  const [syncingInspectionIds, setSyncingInspectionIds] = useState(
    () => new Set<string>()
  );
  const activeScopeKey = useRef<string | null>(null);

  const bsiUid = profile?.role === 'bsi' ? profile.uid : undefined;
  const barangayId = profile?.role === 'bsi'
    ? profile.assignedBarangayId
    : undefined;

  const getActiveScope = useCallback((): InspectionScope => {
    if (!bsiUid || !barangayId) {
      throw new Error('An authenticated BSI profile is required to sync.');
    }

    return { bsiUid, barangayId };
  }, [barangayId, bsiUid]);

  const markInspectionSyncing = useCallback(
    (inspectionId: string, syncing: boolean) => {
      setSyncingInspectionIds((current) => {
        const next = new Set(current);
        if (syncing) {
          next.add(inspectionId);
        } else {
          next.delete(inspectionId);
        }
        return next;
      });
    },
    []
  );

  const refreshPlacesAfterSync = useCallback(async () => {
    try {
      await refreshPlaces();
    } catch {
      // Synchronization already succeeded. A later place refresh can recover.
    }
  }, [refreshPlaces]);

  const retryInspection = useCallback(
    async (inspectionId: string) => {
      const scope = getActiveScope();
      const key = getScopeKey(scope);
      markInspectionSyncing(inspectionId, true);

      try {
        await syncStoredInspection(inspectionId, scope);

        if (activeScopeKey.current === key) {
          setSyncRevision((current) => current + 1);
          await refreshPlacesAfterSync();
        }
      } finally {
        if (activeScopeKey.current === key) {
          markInspectionSyncing(inspectionId, false);
        }
      }
    },
    [getActiveScope, markInspectionSyncing, refreshPlacesAfterSync]
  );

  const retryAllInspections = useCallback(async () => {
    const scope = getActiveScope();
    const key = getScopeKey(scope);
    setIsSyncing(true);

    try {
      const result = await retryPendingInspections(scope, {
        shouldContinue: () => activeScopeKey.current === key,
        onInspectionStart: (inspection) => {
          if (activeScopeKey.current === key) {
            markInspectionSyncing(inspection.id, true);
          }
        },
        onInspectionFinish: (inspection) => {
          if (activeScopeKey.current === key) {
            markInspectionSyncing(inspection.id, false);
            setSyncRevision((current) => current + 1);
          }
        },
      });

      if (
        activeScopeKey.current === key &&
        result.succeeded > 0
      ) {
        await refreshPlacesAfterSync();
      }

      return result;
    } finally {
      if (activeScopeKey.current === key) {
        setIsSyncing(false);
      }
    }
  }, [getActiveScope, markInspectionSyncing, refreshPlacesAfterSync]);

  useEffect(() => {
    if (!bsiUid || !barangayId) {
      activeScopeKey.current = null;
      setIsOnline(null);
      setIsSyncing(false);
      setSyncingInspectionIds(new Set());
      return;
    }

    const scope = { bsiUid, barangayId };
    const key = getScopeKey(scope);
    activeScopeKey.current = key;
    let previousOnline: boolean | null = null;

    const unsubscribe = NetInfo.addEventListener((state) => {
      if (activeScopeKey.current !== key) {
        return;
      }

      const online = isNetworkStateOnline(state);
      const shouldRetry =
        online &&
        (previousOnline === false || previousOnline === null);

      previousOnline = online;
      setIsOnline(online);

      if (shouldRetry) {
        // Automatic retry is intentionally quiet. Per-record status remains
        // retryable and visible on Sync Status if a pass cannot complete.
        void retryAllInspections().catch(() => undefined);
      }
    });

    return () => {
      unsubscribe();
      if (activeScopeKey.current === key) {
        activeScopeKey.current = null;
        setIsOnline(null);
        setIsSyncing(false);
        setSyncingInspectionIds(new Set());
      }
    };
  }, [barangayId, bsiUid, retryAllInspections]);

  const value = useMemo<InspectionSyncContextValue>(
    () => ({
      isOnline,
      isSyncing,
      retryAllInspections,
      retryInspection,
      syncRevision,
      syncingInspectionIds,
    }),
    [
      isSyncing,
      isOnline,
      retryAllInspections,
      retryInspection,
      syncRevision,
      syncingInspectionIds,
    ]
  );

  return (
    <InspectionSyncContext.Provider value={value}>
      {children}
    </InspectionSyncContext.Provider>
  );
}

export function useInspectionSync() {
  const value = useContext(InspectionSyncContext);
  if (!value) {
    throw new Error(
      'useInspectionSync must be used inside InspectionSyncProvider.'
    );
  }
  return value;
}
