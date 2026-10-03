import { requireSupabase } from '@/services/supabase';
import { mapSupabaseProfile } from '@/services/supabaseMappers';
import {
  SupabaseServiceError,
  throwSupabaseServiceError,
} from '@/services/supabaseServiceError';

export async function loadSupabaseBsiProfile() {
  const client = requireSupabase();
  const { data: userData, error: userError } = await client.auth.getUser();

  if (userError) {
    throwSupabaseServiceError('Load authenticated Supabase user', userError);
  }

  if (!userData.user) {
    throw new SupabaseServiceError(
      'Load BSI profile',
      'An authenticated Supabase user is required.',
      { code: 'AUTH_REQUIRED' }
    );
  }

  const { data, error } = await client
    .from('bsi_profiles')
    .select('*')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (error) {
    throwSupabaseServiceError('Load BSI profile', error);
  }

  if (!data) {
    throw new SupabaseServiceError(
      'Load BSI profile',
      'The authenticated account has no BSI profile.',
      { code: 'PROFILE_NOT_FOUND' }
    );
  }

  try {
    return mapSupabaseProfile(data);
  } catch (error) {
    throw new SupabaseServiceError(
      'Validate BSI profile',
      error instanceof Error
        ? error.message
        : 'The authenticated BSI profile is incomplete.',
      { cause: error, code: 'PROFILE_INVALID' }
    );
  }
}
