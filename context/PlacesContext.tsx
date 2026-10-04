import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useAuth } from '@/context/AuthContext';
import {
  fetchAndCachePlaces,
  getCachedPlaces,
} from '@/services/placeService';
import { Place } from '@/types/place';

type PlacesContextValue = {
  places: Place[];
  isLoading: boolean;
  error: string | null;
  refreshPlaces: () => Promise<void>;
  getPlaceById: (id: string | undefined) => Place | undefined;
};

const PlacesContext = createContext<PlacesContextValue | null>(null);

export function PlacesProvider({ children }: PropsWithChildren) {
  const { profile } = useAuth();
  const [places, setPlaces] = useState<Place[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const activeScopeKey = useRef<string | null>(null);
  activeScopeKey.current = profile
    ? `${profile.uid}:${profile.assignedBarangayId}`
    : null;

  const refreshPlaces = useCallback(async () => {
    if (!profile) {
      setPlaces([]);
      setIsLoading(false);
      return;
    }

    const requestScopeKey = `${profile.uid}:${profile.assignedBarangayId}`;
    setIsLoading(true);
    setError(null);

    try {
      const nextPlaces = await fetchAndCachePlaces(
        profile.uid,
        profile.assignedBarangayId
      );
      if (activeScopeKey.current !== requestScopeKey) return;
      setPlaces(nextPlaces);
    } catch (refreshError) {
      if (activeScopeKey.current !== requestScopeKey) return;
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : 'Unable to refresh places.'
      );
    } finally {
      if (activeScopeKey.current === requestScopeKey) {
        setIsLoading(false);
      }
    }
  }, [profile]);

  useEffect(() => {
    if (!profile) {
      setPlaces([]);
      setIsLoading(false);
      return;
    }

    let active = true;
    setIsLoading(true);
    setError(null);

    void (async () => {
      const cached = await getCachedPlaces(
        profile.uid,
        profile.assignedBarangayId
      );
      if (!active) return;

      if (cached.length > 0) {
        setPlaces(cached);
        setIsLoading(false);
      }

      try {
        const nextPlaces = await fetchAndCachePlaces(
          profile.uid,
          profile.assignedBarangayId
        );
        if (!active) return;
        setPlaces(nextPlaces);
        setError(null);
      } catch (refreshError) {
        if (!active) return;
        setError(
          refreshError instanceof Error
            ? refreshError.message
            : 'Unable to refresh places.'
        );
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [profile]);

  const value = useMemo<PlacesContextValue>(
    () => ({
      places,
      isLoading,
      error,
      refreshPlaces,
      getPlaceById: (id) => places.find((place) => place.id === id),
    }),
    [error, isLoading, places, refreshPlaces]
  );

  return (
    <PlacesContext.Provider value={value}>{children}</PlacesContext.Provider>
  );
}

export function usePlaces() {
  const value = useContext(PlacesContext);
  if (!value) {
    throw new Error('usePlaces must be used inside PlacesProvider.');
  }
  return value;
}
