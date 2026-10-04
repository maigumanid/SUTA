import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

type AdminAction =
  | 'create'
  | 'reassign'
  | 'deactivate'
  | 'reactivate'
  | 'reset_password';

type RequestPayload = {
  action?: AdminAction;
  assignedBarangayId?: string;
  assignedBarangayName?: string;
  contactNumber?: string;
  email?: string;
  name?: string;
  targetUserId?: string;
  temporaryPassword?: string;
};

class RequestValidationError extends Error {}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function requireText(value: unknown, label: string) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new RequestValidationError(`${label} is required.`);
  }
  return value.trim();
}

function requirePassword(value: unknown) {
  const password = requireText(value, 'Temporary password');
  if (password.length < 8) {
    throw new RequestValidationError('Temporary password must contain at least 8 characters.');
  }
  return password;
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ message: 'Method not allowed.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const secretKey =
    Deno.env.get('SUPABASE_SECRET_KEY') ??
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !secretKey) {
    return jsonResponse({ message: 'Server configuration is incomplete.' }, 500);
  }

  const authorization = request.headers.get('Authorization');
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : null;

  if (!token) {
    return jsonResponse({ message: 'Authentication is required.' }, 401);
  }

  const adminClient = createClient(supabaseUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: callerData, error: callerError } =
    await adminClient.auth.getUser(token);
  if (callerError || !callerData.user) {
    return jsonResponse({ message: 'The administrator session is invalid.' }, 401);
  }

  const { data: callerProfile, error: profileError } = await adminClient
    .from('bsi_profiles')
    .select('id, role, active')
    .eq('id', callerData.user.id)
    .maybeSingle();

  if (
    profileError ||
    !callerProfile ||
    callerProfile.role !== 'admin' ||
    callerProfile.active !== true
  ) {
    return jsonResponse({ message: 'Administrator authorization is required.' }, 403);
  }

  let payload: RequestPayload;
  try {
    payload = (await request.json()) as RequestPayload;
  } catch {
    return jsonResponse({ message: 'A valid JSON request body is required.' }, 400);
  }

  try {
    if (payload.action === 'create') {
      const email = requireText(payload.email, 'Email').toLowerCase();
      const password = requirePassword(payload.temporaryPassword);
      const name = requireText(payload.name, 'Full name');
      const contactNumber = requireText(payload.contactNumber, 'Contact number');
      const barangayId = requireText(payload.assignedBarangayId, 'Barangay ID');
      const barangayName = requireText(
        payload.assignedBarangayName,
        'Barangay name'
      );

      const { data: createdAuth, error: createAuthError } =
        await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            must_change_password: true,
            name,
          },
        });

      if (createAuthError || !createdAuth.user) {
        throw new Error(createAuthError?.message ?? 'Auth user creation failed.');
      }

      const { data: createdProfile, error: createProfileError } =
        await adminClient.rpc('admin_create_bsi_profile', {
          p_admin_user_id: callerData.user.id,
          p_target_user_id: createdAuth.user.id,
          p_name: name,
          p_email: email,
          p_contact_number: contactNumber,
          p_assigned_barangay_id: barangayId,
          p_assigned_barangay_name: barangayName,
        });

      if (createProfileError) {
        await adminClient.auth.admin.deleteUser(createdAuth.user.id);
        throw new Error(createProfileError.message);
      }

      return jsonResponse({ profile: createdProfile });
    }

    const targetUserId = requireText(payload.targetUserId, 'Target BSI');

    if (payload.action === 'reassign') {
      const { data, error } = await adminClient.rpc('admin_update_bsi_profile', {
        p_admin_user_id: callerData.user.id,
        p_target_user_id: targetUserId,
        p_action: 'reassign',
        p_assigned_barangay_id: requireText(
          payload.assignedBarangayId,
          'Barangay ID'
        ),
        p_assigned_barangay_name: requireText(
          payload.assignedBarangayName,
          'Barangay name'
        ),
      });
      if (error) throw new Error(error.message);
      return jsonResponse({ profile: data });
    }

    if (payload.action === 'deactivate') {
      const { data, error } = await adminClient.rpc('admin_update_bsi_profile', {
        p_admin_user_id: callerData.user.id,
        p_target_user_id: targetUserId,
        p_action: 'deactivate',
      });
      if (error) throw new Error(error.message);

      const { error: banError } = await adminClient.auth.admin.updateUserById(
        targetUserId,
        { ban_duration: '876000h' }
      );
      if (banError) throw new Error(banError.message);
      return jsonResponse({ profile: data });
    }

    if (payload.action === 'reactivate') {
      const { error: unbanError } = await adminClient.auth.admin.updateUserById(
        targetUserId,
        { ban_duration: 'none' }
      );
      if (unbanError) throw new Error(unbanError.message);

      const { data, error } = await adminClient.rpc('admin_update_bsi_profile', {
        p_admin_user_id: callerData.user.id,
        p_target_user_id: targetUserId,
        p_action: 'reactivate',
      });
      if (error) throw new Error(error.message);
      return jsonResponse({ profile: data });
    }

    if (payload.action === 'reset_password') {
      const password = requirePassword(payload.temporaryPassword);
      const { data: targetAuth, error: targetAuthError } =
        await adminClient.auth.admin.getUserById(targetUserId);
      if (targetAuthError || !targetAuth.user) {
        throw new Error(targetAuthError?.message ?? 'Target Auth user was not found.');
      }

      const { data, error } = await adminClient.rpc('admin_update_bsi_profile', {
        p_admin_user_id: callerData.user.id,
        p_target_user_id: targetUserId,
        p_action: 'password_reset',
      });
      if (error) throw new Error(error.message);

      const { error: resetError } = await adminClient.auth.admin.updateUserById(
        targetUserId,
        {
          password,
          user_metadata: {
            ...targetAuth.user.user_metadata,
            must_change_password: true,
          },
        }
      );
      if (resetError) throw new Error(resetError.message);
      return jsonResponse({ profile: data });
    }

    return jsonResponse({ message: 'Unsupported administrator action.' }, 400);
  } catch (error) {
    return jsonResponse(
      { message: error instanceof RequestValidationError
        ? error.message
        : 'The account-management operation could not be completed.' },
      400
    );
  }
});
