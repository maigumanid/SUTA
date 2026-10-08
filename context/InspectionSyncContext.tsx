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
import { useNetwork } from '@/context/NetworkContext';
import {
  retryPendingInspections,
  syncStoredInspection,
  type InspectionSyncPassResult,
} from '@/services/inspectionSyncService';
import type { InspectionScope } from '@/storage/inspectionStorage';
type InspectionSyncContextValue = {
  isOnline: boolean | null;
  isSyncing: boolean;
  syncFeedback: 'syncing' | 'complete' | 'attention' | null;
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
  const { profile, isProfileValidated } = useAuth();
  const { refreshPlaces } = usePlaces();
  const { isOnline } = useNetwork();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<'syncing' | 'complete' | 'attention' | null>(null);
  const [syncRevision, setSyncRevision] = useState(0);
  const [syncingInspectionIds, setSyncingInspectionIds] = useState(
    () => new Set<string>()
  );
  const activeScopeKey = useRef<string | null>(null);
  const lastScopeKey = useRef<string | null>(null);
  const previousOnline = useRef<boolean | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bsiUid = profile?.role === 'bsi' ? profile.uid : undefined;
  const barangayId = profile?.role === 'bsi'
    ? profile.assignedBarangayId
    : undefined;

  const getActiveScope = useCallback((): InspectionScope => {
    if (!bsiUid || !barangayId || !isProfileValidated) {
      throw new Error('An authenticated BSI profile is required to sync.');
    }

    return { bsiUid, barangayId };
  }, [barangayId, bsiUid, isProfileValidated]);

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
    if (!bsiUid || !barangayId || !isProfileValidated) {
      activeScopeKey.current = null;
      lastScopeKey.current = null;
      previousOnline.current = null;
      setIsSyncing(false);
      setSyncFeedback(null);
      setSyncingInspectionIds(new Set());
      return;
    }

    const scope = { bsiUid, barangayId };
    const key = getScopeKey(scope);
    if (lastScopeKey.current !== key) {
      previousOnline.current = null;
      lastScopeKey.current = key;
    }
    activeScopeKey.current = key;
    const wasOffline = previousOnline.current === false;
    const shouldRetry = isOnline === true && previousOnline.current !== true;
    previousOnline.current = isOnline;
    if (shouldRetry) {
      if (wasOffline) setSyncFeedback('syncing');
      void retryAllInspections().then((result) => {
        if (activeScopeKey.current !== key) return;
        if (!wasOffline) return;
        setSyncFeedback(result.failed > 0 ? 'attention' : 'complete');
        if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
        feedbackTimer.current = setTimeout(() => setSyncFeedback(null), 3500);
      }).catch(() => {
        if (wasOffline && activeScopeKey.current === key) setSyncFeedback('attention');
      });
    }

    return () => {
      if (activeScopeKey.current === key) {
        activeScopeKey.current = null;
        setIsSyncing(false);
        setSyncingInspectionIds(new Set());
      }
    };
  }, [barangayId, bsiUid, isOnline, isProfileValidated, retryAllInspections]);

  useEffect(() => () => { if (feedbackTimer.current) clearTimeout(feedbackTimer.current); }, []);

  const value = useMemo<InspectionSyncContextValue>(
    () => ({
      isOnline,
      isSyncing,
      syncFeedback,
      retryAllInspections,
      retryInspection,
      syncRevision,
      syncingInspectionIds,
    }),
    [
      isSyncing,
      isOnline,
      syncFeedback,
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
