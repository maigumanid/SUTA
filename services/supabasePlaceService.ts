import { requireSupabase } from '@/services/supabase';
import {
  mapPlaceToInsert,
  mapSupabasePlace,
} from '@/services/supabaseMappers';
import { loadSupabaseBsiProfile } from '@/services/supabaseProfileService';
import { throwSupabaseServiceError } from '@/services/supabaseServiceError';
import type { Place } from '@/types/place';
import type { TablesInsert, TablesUpdate } from '@/types/supabase';

export type SupabasePlaceUpdate = Partial<
  Pick<
    Place,
    | 'name'
    | 'representativeName'
    | 'address'
    | 'purok'
    | 'placeType'
    | 'status'
    | 'riskLevel'
    | 'lastInspectionDate'
  >
>;

export async function fetchSupabasePlaces(): Promise<Place[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('places')
    .select('*')
    .order('name');

  if (error) {
    throwSupabaseServiceError('Fetch places', error);
  }

  try {
    return data.map(mapSupabasePlace);
  } catch (error) {
    throwSupabaseServiceError('Map places', error);
  }
}

export async function createSupabasePlace(place: Place): Promise<Place> {
  const client = requireSupabase();
  const profile = await loadSupabaseBsiProfile();
  let payload: TablesInsert<'places'>;

  try {
    payload = mapPlaceToInsert(place, profile);
  } catch (error) {
    throwSupabaseServiceError('Validate place', error);
  }

  const { data, error } = await client
    .from('places')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    throwSupabaseServiceError('Create place', error);
  }

  try {
    return mapSupabasePlace(data);
  } catch (mappingError) {
    throwSupabaseServiceError('Map created place', mappingError);
  }
}

export async function updateSupabasePlace(
  placeId: string,
  changes: SupabasePlaceUpdate
): Promise<Place> {
  const client = requireSupabase();
  const profile = await loadSupabaseBsiProfile();
  const payload: TablesUpdate<'places'> = {
    updated_by_uid: profile.uid,
    ...(changes.name !== undefined ? { name: changes.name } : {}),
    ...(changes.representativeName !== undefined
      ? { representative_name: changes.representativeName }
      : {}),
    ...(changes.address !== undefined ? { address: changes.address } : {}),
    ...(changes.purok !== undefined ? { purok: changes.purok } : {}),
    ...(changes.placeType !== undefined
      ? { place_type: changes.placeType }
      : {}),
    ...(changes.status !== undefined ? { status: changes.status } : {}),
    ...(changes.riskLevel !== undefined
      ? { risk_level: changes.riskLevel }
      : {}),
    ...(changes.lastInspectionDate !== undefined
      ? { last_inspection_date: changes.lastInspectionDate }
      : {}),
  };

  const { data, error } = await client
    .from('places')
    .update(payload)
    .eq('id', placeId)
    .select('*')
    .single();

  if (error) {
    throwSupabaseServiceError('Update place', error);
  }

  try {
    return mapSupabasePlace(data);
  } catch (mappingError) {
    throwSupabaseServiceError('Map updated place', mappingError);
  }
}
