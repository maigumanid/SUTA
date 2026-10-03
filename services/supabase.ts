import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import type { Database } from '@/types/supabase';

type SupabaseConfig = {
  publishableKey: string;
  url: string;
};

function loadSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey =
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url && !publishableKey) {
    return null;
  }

  if (!url || !publishableKey) {
    throw new Error(
      'Supabase configuration is incomplete. Add both EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local and restart Expo.'
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error(
      'EXPO_PUBLIC_SUPABASE_URL must be a valid HTTPS URL.'
    );
  }

  if (parsedUrl.protocol !== 'https:') {
    throw new Error(
      'EXPO_PUBLIC_SUPABASE_URL must be a valid HTTPS URL.'
    );
  }

  return { publishableKey, url };
}

const supabaseConfig = loadSupabaseConfig();

export const isSupabaseConfigured = supabaseConfig !== null;

export const supabaseClient: SupabaseClient<Database> | null =
  supabaseConfig
    ? createClient<Database>(
        supabaseConfig.url,
        supabaseConfig.publishableKey,
        {
          auth: {
            ...(Platform.OS === 'web' ? {} : { storage: AsyncStorage }),
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: false,
          },
        }
      )
    : null;

export function requireSupabase(): SupabaseClient<Database> {
  if (!supabaseClient) {
    throw new Error(
      'Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local and restart Expo.'
    );
  }

  return supabaseClient;
}
