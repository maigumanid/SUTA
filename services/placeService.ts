import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
  where,
} from 'firebase/firestore';

import { firestoreDb, requireFirebase } from '@/services/firebase';
import { Place } from '@/types/place';

function cacheKey(uid: string, barangayId: string) {
  return `suta_places:${uid}:${barangayId}`;
}

export async function getCachedPlaces(uid: string, barangayId: string) {
  const raw = await AsyncStorage.getItem(cacheKey(uid, barangayId));
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Place[]) : [];
  } catch {
    return [];
  }
}

export function subscribeToBarangayPlaces(
  uid: string,
  barangayId: string,
  onPlaces: (places: Place[]) => void,
  onError: (error: Error) => void
) {
  if (!firestoreDb) {
    onError(new Error('Firebase is not configured.'));
    return () => undefined;
  }

  const placesQuery = query(
    collection(firestoreDb, 'places'),
    where('barangayId', '==', barangayId)
  );

  return onSnapshot(
    placesQuery,
    (snapshot) => {
      const places = snapshot.docs.map(
        (placeDoc) =>
          ({ ...placeDoc.data(), id: placeDoc.id }) as Place
      );
      onPlaces(places);
      void AsyncStorage.setItem(
        cacheKey(uid, barangayId),
        JSON.stringify(places)
      );
    },
    (error) => onError(error)
  );
}

export async function savePlace(
  place: Omit<Place, 'id' | 'barangayId' | 'createdByUid'> & {
    id?: string;
  },
  uid: string,
  barangayId: string
) {
  const { db } = requireFirebase();
  const reference = place.id
    ? doc(db, 'places', place.id)
    : doc(collection(db, 'places'));

  await setDoc(
    reference,
    {
      ...place,
      id: reference.id,
      barangayId,
      createdByUid: uid,
      updatedByUid: uid,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  return reference.id;
}
