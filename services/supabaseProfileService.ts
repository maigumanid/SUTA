import { requireSupabase } from '@/services/supabase';
import { mapSupabaseProfile } from '@/services/supabaseMappers';
import {
  SupabaseServiceError,
  throwSupabaseServiceError,
} from '@/services/supabaseServiceError';

export async function loadSupabaseProfile() {
  const client = requireSupabase();
  const { data: userData, error: userError } = await client.auth.getUser();

  if (userError) {
    throwSupabaseServiceError('Load authenticated Supabase user', userError);
  }

  if (!userData.user) {
    throw new SupabaseServiceError(
      'Load profile',
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
      'The authenticated account has no authorized profile.',
      { code: 'PROFILE_NOT_FOUND' }
    );
  }

  try {
    const profile = mapSupabaseProfile(data);
    if (!profile.active) {
      throw new SupabaseServiceError(
        'Load profile',
        'This account is inactive. Contact your administrator.',
        { code: 'ACCOUNT_INACTIVE' }
      );
    }
    return profile;
  } catch (error) {
    if (error instanceof SupabaseServiceError) {
      throw error;
    }
    throw new SupabaseServiceError(
      'Validate profile',
      error instanceof Error
        ? error.message
        : 'The authenticated profile is incomplete.',
      { cause: error, code: 'PROFILE_INVALID' }
    );
  }
}

export async function loadSupabaseBsiProfile() {
  const profile = await loadSupabaseProfile();
  if (profile.role !== 'bsi') {
    throw new SupabaseServiceError(
      'Load BSI profile',
      'A BSI account is required for this operation.',
      { code: 'BSI_ROLE_REQUIRED' }
    );
  }
  return profile;
}

export async function completeSupabasePasswordChange(password: string) {
  const client = requireSupabase();
  const { error } = await client.functions.invoke('complete-password-change', {
    body: { password },
  });
  if (error) {
    throwSupabaseServiceError('Change password', error);
  }
}
