import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  createSupabasePlace,
  createSupabasePlaces,
  fetchSupabasePlaces,
  updateSupabasePlace,
} from '@/services/supabasePlaceService';
import type { Place } from '@/types/place';
import { UNCLASSIFIED_RISK_STORAGE_VALUE } from '@/utils/riskClassification';

type RegisterPlaceInput = Pick<
  Place,
  'name' | 'representativeName' | 'purok' | 'address' | 'placeType'
>;

export type ImportPlaceInput = Pick<
  Place,
  'name' | 'representativeName' | 'contactNumber' | 'purok' | 'address' | 'placeType' | 'notes'
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
      contactNumber: place.contactNumber,
      address: place.address,
      purok: place.purok,
      notes: place.notes,
      placeType: place.placeType,
      status: place.status,
      riskLevel: place.riskLevel,
      profileStatus: place.profileStatus,
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
    contactNumber: '',
    notes: '',
    id,
    barangayId,
    barangay,
    createdByUid: uid,
    status: 'Not Inspected',
    riskLevel: UNCLASSIFIED_RISK_STORAGE_VALUE,
    profileStatus: 'complete',
    sourceKind: 'manual',
  });

  return id;
}

export async function importPlaces(
  rows: ImportPlaceInput[],
  uid: string,
  barangayId: string,
  barangay: string,
  batchId: string
) {
  const places: Place[] = rows.map((row, index) => ({
    ...row,
    id: `${batchId}_${index + 1}_${Math.random().toString(36).slice(2, 7)}`,
    barangayId,
    barangay,
    createdByUid: uid,
    status: 'Not Inspected',
    riskLevel: UNCLASSIFIED_RISK_STORAGE_VALUE,
    profileStatus:
      row.representativeName.trim() && row.purok.trim() && row.placeType
        ? 'complete'
        : 'starter',
    sourceKind: 'bulk_import',
    importBatchId: batchId,
  }));

  return createSupabasePlaces(places);
}

export async function updatePlaceProfile(
  placeId: string,
  changes: Pick<
    Place,
    'name' | 'address' | 'representativeName' | 'contactNumber' | 'purok' | 'placeType' | 'notes'
  >
) {
  return updateSupabasePlace(placeId, {
    ...changes,
    profileStatus:
      changes.representativeName.trim() && changes.purok.trim()
        ? 'complete'
        : 'starter',
  });
}
