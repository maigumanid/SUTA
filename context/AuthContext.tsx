import type { User } from '@supabase/supabase-js';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, Platform } from 'react-native';

import {
  isSupabaseConfigured,
  requireSupabase,
  supabaseClient,
} from '@/services/supabase';
import { loadSupabaseBsiProfile } from '@/services/supabaseProfileService';
import {
  SupabaseServiceError,
  throwSupabaseServiceError,
} from '@/services/supabaseServiceError';
import {
  cacheBsiProfile,
  getCachedBsiProfile,
} from '@/storage/profileStorage';
import type { BsiProfile } from '@/types/inspector';

export type AuthUser = {
  email?: string;
  uid: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  profile: BsiProfile | null;
  isLoading: boolean;
  configurationReady: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function mapAuthUser(user: User): AuthUser {
  return {
    uid: user.id,
    ...(user.email ? { email: user.email } : {}),
  };
}

function isInvalidProfileError(error: unknown) {
  return (
    error instanceof SupabaseServiceError &&
    (error.code === 'PROFILE_NOT_FOUND' ||
      error.code === 'PROFILE_INVALID' ||
      error.code === 'AUTH_REQUIRED')
  );
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<BsiProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const hydrationId = useRef(0);

  const hydrateUser = useCallback(async (
    nextUser: User | null,
    allowCachedProfile = true
  ) => {
    const currentHydration = ++hydrationId.current;

    if (!nextUser) {
      setUser(null);
      setProfile(null);
      setIsLoading(false);
      return;
    }

    setUser(mapAuthUser(nextUser));
    setIsLoading(true);

    const cachedProfile = allowCachedProfile
      ? await getCachedBsiProfile(nextUser.id)
      : null;
    if (currentHydration !== hydrationId.current) return;

    if (cachedProfile) {
      setProfile(cachedProfile);
      setIsLoading(false);
    }

    try {
      const liveProfile = await loadSupabaseBsiProfile();
      if (currentHydration !== hydrationId.current) return;

      await cacheBsiProfile(liveProfile);
      if (currentHydration !== hydrationId.current) return;

      setProfile(liveProfile);
    } catch (error) {
      if (currentHydration !== hydrationId.current) return;

      if (isInvalidProfileError(error)) {
        setUser(null);
        setProfile(null);
        await supabaseClient?.auth.signOut();
      } else {
        console.error('Unable to refresh the BSI profile:', error);
        if (!cachedProfile) {
          setProfile(null);
        }
      }
    } finally {
      if (currentHydration === hydrationId.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!supabaseClient) {
      setIsLoading(false);
      return;
    }

    const client = supabaseClient;
    let active = true;

    void client.auth.getSession().then(({ data, error }) => {
      if (!active) return;

      if (error) {
        console.error('Unable to restore the Supabase session:', error);
        setIsLoading(false);
        return;
      }

      void hydrateUser(data.session?.user ?? null);
    });

    const { data: authListener } = client.auth.onAuthStateChange(
      (event, session) => {
        if (!active || event === 'INITIAL_SESSION') return;
        void hydrateUser(
          session?.user ?? null,
          event !== 'SIGNED_IN'
        );
      }
    );

    const appStateSubscription =
      Platform.OS === 'web'
        ? null
        : AppState.addEventListener('change', (state) => {
            if (state === 'active') {
              client.auth.startAutoRefresh();
            } else {
              client.auth.stopAutoRefresh();
            }
          });

    if (Platform.OS !== 'web') {
      client.auth.startAutoRefresh();
    }

    return () => {
      active = false;
      hydrationId.current += 1;
      authListener.subscription.unsubscribe();
      appStateSubscription?.remove();
      if (Platform.OS !== 'web') {
        client.auth.stopAutoRefresh();
      }
    };
  }, [hydrateUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      isLoading,
      configurationReady: isSupabaseConfigured,
      signIn: async (email, password) => {
        const client = requireSupabase();
        const { data, error } = await client.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          throwSupabaseServiceError('Sign in', error);
        }

        if (!data.user || !data.session) {
          throw new SupabaseServiceError(
            'Sign in',
            'Supabase did not return an authenticated session.',
            { code: 'AUTH_SESSION_MISSING' }
          );
        }

        try {
          const nextProfile = await loadSupabaseBsiProfile();
          await cacheBsiProfile(nextProfile);
          setUser(mapAuthUser(data.user));
          setProfile(nextProfile);
        } catch (profileError) {
          await client.auth.signOut();
          setUser(null);
          setProfile(null);
          throw profileError;
        }
      },
      signOut: async () => {
        const client = requireSupabase();
        const { error } = await client.auth.signOut();
        if (error) {
          throwSupabaseServiceError('Sign out', error);
        }

        hydrationId.current += 1;
        setUser(null);
        setProfile(null);
      },
    }),
    [isLoading, profile, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }
  return value;
}
