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

export async function updateOwnSupabaseProfile(input: {
  name: string;
  contactNumber: string;
  avatarPath?: string;
}) {
  const { data, error } = await requireSupabase()
    .rpc('update_own_profile', {
      p_name: input.name.trim(),
      p_contact_number: input.contactNumber.trim(),
      p_avatar_path: input.avatarPath ?? null,
    })
    .single();
  if (error) throwSupabaseServiceError('Update profile', error);
  try {
    return mapSupabaseProfile(data);
  } catch (mappingError) {
    throwSupabaseServiceError('Validate updated profile', mappingError);
  }
}

export async function completeSupabasePasswordChange(password: string) {
  const client = requireSupabase();
  const { data: currentUser, error: currentUserError } = await client.auth.getUser();
  if (currentUserError || !currentUser.user?.email) {
    throw new SupabaseServiceError(
      'Change password',
      'Your authenticated session is unavailable. Sign in again before changing your password.',
      { cause: currentUserError, code: 'AUTH_REQUIRED' }
    );
  }
  const email = currentUser.user.email;
  const { error } = await client.functions.invoke('complete-password-change', {
    body: { password },
  });
  if (error) {
    throwSupabaseServiceError('Change password', error);
  }

  // The server completes this privileged flow with auth.admin.updateUserById.
  // Some GoTrue configurations invalidate the caller's previous token after a
  // password update, so validate it and transparently establish a fresh session.
  const { data: validatedUser, error: validationError } = await client.auth.getUser();
  if (!validationError && validatedUser.user) return;

  const { data: refreshed, error: refreshError } =
    await client.auth.signInWithPassword({ email, password });
  if (refreshError || !refreshed.user || !refreshed.session) {
    throw new SupabaseServiceError(
      'Finish password change',
      'Your password was changed, but this device could not refresh the session. Sign in with your new password.',
      {
        cause: refreshError ?? validationError,
        code: 'PASSWORD_CHANGED_REAUTH_REQUIRED',
      }
    );
  }
}
