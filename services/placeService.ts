import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  createSupabasePlace,
  fetchSupabasePlaces,
  updateSupabasePlace,
} from '@/services/supabasePlaceService';
import type { Place } from '@/types/place';
import { UNCLASSIFIED_RISK_STORAGE_VALUE } from '@/utils/riskClassification';

type RegisterPlaceInput = Pick<
  Place,
  'name' | 'representativeName' | 'purok' | 'address' | 'placeType'
>;

function cacheKey(uid: string, barangayId: string) {
  return `suta_places:${uid}:${barangayId}`;
}

function createPlaceId() {
  return `place_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export async function getCachedPlaces(uid: string, barangayId: string) {
  const raw = await AsyncStorage.getItem(cacheKey(uid, barangayId));
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Place[]) : [];
  } catch {
    return [];
  }
}

export async function fetchAndCachePlaces(
  uid: string,
  barangayId: string
) {
  const places = await fetchSupabasePlaces();
  await AsyncStorage.setItem(
    cacheKey(uid, barangayId),
    JSON.stringify(places)
  );
  return places;
}

export async function savePlace(
  place: Omit<Place, 'id' | 'barangayId' | 'createdByUid'> & {
    id?: string;
  },
  uid: string,
  barangayId: string
) {
  if (place.id) {
    await updateSupabasePlace(place.id, {
      name: place.name,
      representativeName: place.representativeName,
      address: place.address,
      purok: place.purok,
      placeType: place.placeType,
      status: place.status,
      riskLevel: place.riskLevel,
      ...(place.lastInspectionDate
        ? { lastInspectionDate: place.lastInspectionDate }
        : {}),
    });
    return place.id;
  }

  const id = createPlaceId();
  await createSupabasePlace({
    ...place,
    id,
    barangayId,
    createdByUid: uid,
  });
  return id;
}

export async function registerPlace(
  place: RegisterPlaceInput,
  uid: string,
  barangayId: string,
  barangay: string
) {
  const id = createPlaceId();

  await createSupabasePlace({
    ...place,
    id,
    barangayId,
    barangay,
    createdByUid: uid,
    status: 'Not Inspected',
    riskLevel: UNCLASSIFIED_RISK_STORAGE_VALUE,
  });

  return id;
}
