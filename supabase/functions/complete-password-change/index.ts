import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

function respond(message: string, status: number) {
  return new Response(JSON.stringify({ message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return respond('Method not allowed.', 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const secretKey = Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('Authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
  if (!supabaseUrl || !secretKey) return respond('Server configuration is incomplete.', 500);
  if (!token) return respond('Authentication is required.', 401);

  let password: string;
  try {
    const body = await request.json() as { password?: unknown };
    if (typeof body.password !== 'string' || body.password.length < 8) {
      return respond('The new password must contain at least 8 characters.', 400);
    }
    password = body.password;
  } catch {
    return respond('A valid request body is required.', 400);
  }

  const client = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: caller, error: callerError } = await client.auth.getUser(token);
  if (callerError || !caller.user) return respond('The session is invalid.', 401);

  const { data: profile, error: profileError } = await client
    .from('bsi_profiles')
    .select('active, must_change_password')
    .eq('id', caller.user.id)
    .maybeSingle();
  if (profileError || !profile || !profile.active) return respond('An active authorized account is required.', 403);

  const { error: updateError } = await client.auth.admin.updateUserById(
    caller.user.id,
    {
      password,
      user_metadata: {
        ...caller.user.user_metadata,
        must_change_password: false,
      },
    }
  );
  if (updateError) return respond('The password could not be changed.', 400);

  const { error: completionError } = await client.rpc('complete_password_change', {
    p_user_id: caller.user.id,
  });
  if (completionError) return respond('The password change could not be finalized.', 500);

  return respond('Password changed.', 200);
});
