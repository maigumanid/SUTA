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
import { loadSupabaseProfile } from '@/services/supabaseProfileService';
import {
  SupabaseServiceError,
  throwSupabaseServiceError,
} from '@/services/supabaseServiceError';
import {
  cacheProfile,
  getCachedProfile,
} from '@/storage/profileStorage';
import type { AppProfile } from '@/types/inspector';

export type AuthUser = {
  email?: string;
  uid: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  profile: AppProfile | null;
  isLoading: boolean;
  configurationReady: boolean;
  refreshProfile: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<AppProfile>;
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
      error.code === 'AUTH_REQUIRED' ||
      error.code === 'ACCOUNT_INACTIVE')
  );
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const hydrationId = useRef(0);

  const hydrateUser = useCallback(async (
    nextUser: User | null,
    allowCachedProfile = true,
    silently = false
  ) => {
    const currentHydration = ++hydrationId.current;

    if (!nextUser) {
      setUser(null);
      setProfile(null);
      setIsLoading(false);
      return;
    }

    setUser(mapAuthUser(nextUser));
    if (!silently) setIsLoading(true);

    const cachedProfile = allowCachedProfile
      ? await getCachedProfile(nextUser.id)
      : null;
    if (currentHydration !== hydrationId.current) return;

    if (cachedProfile) {
      setProfile(cachedProfile);
      setIsLoading(false);
    }

    try {
      const loadedProfile = await loadSupabaseProfile();
      const liveProfile: AppProfile = {
        ...loadedProfile,
        mustChangePassword:
          loadedProfile.mustChangePassword ||
          nextUser.user_metadata.must_change_password === true,
      };
      if (currentHydration !== hydrationId.current) return;

      await cacheProfile(liveProfile);
      if (currentHydration !== hydrationId.current) return;

      setProfile(liveProfile);
    } catch (error) {
      if (currentHydration !== hydrationId.current) return;

      if (isInvalidProfileError(error)) {
        setUser(null);
        setProfile(null);
        await supabaseClient?.auth.signOut();
      } else {
        console.error('Unable to refresh the account profile:', error);
        if (!cachedProfile && !silently) {
          setProfile(null);
        }
      }
    } finally {
      if (!silently && currentHydration === hydrationId.current) {
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
            void client.auth.getUser().then(({ data, error }) => {
              if (!error && active) {
                void hydrateUser(data.user, false, true);
              }
            });
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
      refreshProfile: async () => {
        const client = requireSupabase();
        const { data, error } = await client.auth.getUser();
        if (error) {
          throwSupabaseServiceError('Refresh profile', error);
        }
        await hydrateUser(data.user, false);
      },
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
          const loadedProfile = await loadSupabaseProfile();
          const nextProfile: AppProfile = {
            ...loadedProfile,
            mustChangePassword:
              loadedProfile.mustChangePassword ||
              data.user.user_metadata.must_change_password === true,
          };
          await cacheProfile(nextProfile);
          setUser(mapAuthUser(data.user));
          setProfile(nextProfile);
          return nextProfile;
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
    [hydrateUser, isLoading, profile, user]
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
