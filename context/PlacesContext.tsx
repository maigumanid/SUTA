import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useAuth } from '@/context/AuthContext';
import {
  getCachedPlaces,
  subscribeToBarangayPlaces,
} from '@/services/placeService';
import { Place } from '@/types/place';

type PlacesContextValue = {
  places: Place[];
  isLoading: boolean;
  error: string | null;
  getPlaceById: (id: string | undefined) => Place | undefined;
};

const PlacesContext = createContext<PlacesContextValue | null>(null);

export function PlacesProvider({ children }: PropsWithChildren) {
  const { profile } = useAuth();
  const [places, setPlaces] = useState<Place[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) {
      setPlaces([]);
      setIsLoading(false);
      return;
    }

    let active = true;
    setIsLoading(true);
    setError(null);

    void getCachedPlaces(profile.uid, profile.assignedBarangayId).then(
      (cached) => {
        if (active && cached.length > 0) {
          setPlaces(cached);
          setIsLoading(false);
        }
      }
    );

    const unsubscribe = subscribeToBarangayPlaces(
      profile.uid,
      profile.assignedBarangayId,
      (nextPlaces) => {
        if (!active) return;
        setPlaces(nextPlaces);
        setIsLoading(false);
        setError(null);
      },
      (subscriptionError) => {
        if (!active) return;
        setError(subscriptionError.message);
        setIsLoading(false);
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [profile]);

  const value = useMemo<PlacesContextValue>(
    () => ({
      places,
      isLoading,
      error,
      getPlaceById: (id) => places.find((place) => place.id === id),
    }),
    [error, isLoading, places]
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
