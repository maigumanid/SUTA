import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  firebaseAuth,
  firestoreDb,
  isFirebaseConfigured,
  requireFirebase,
} from '@/services/firebase';
import { BsiProfile } from '@/types/inspector';

type AuthContextValue = {
  user: User | null;
  profile: BsiProfile | null;
  isLoading: boolean;
  configurationReady: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadBsiProfile(uid: string): Promise<BsiProfile> {
  if (!firestoreDb) {
    throw new Error('Firebase is not configured.');
  }

  const snapshot = await getDoc(doc(firestoreDb, 'bsiProfiles', uid));

  if (!snapshot.exists()) {
    throw new Error(
      'This account has no BSI profile. Ask the system owner to create its bsiProfiles record.'
    );
  }

  const data = snapshot.data() as Partial<BsiProfile>;
  if (
    !data.name ||
    !data.email ||
    !data.contactNumber ||
    !data.assignedBarangayId ||
    !data.assignedBarangay
  ) {
    throw new Error('This BSI profile is incomplete.');
  }

  return {
    uid,
    name: data.name,
    email: data.email,
    contactNumber: data.contactNumber,
    assignedBarangayId: data.assignedBarangayId,
    assignedBarangay: data.assignedBarangay,
    role: 'BSI',
  };
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<BsiProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!firebaseAuth) {
      setIsLoading(false);
      return;
    }

    const auth = firebaseAuth;

    return onAuthStateChanged(auth, async (nextUser) => {
      setIsLoading(true);
      if (!nextUser) {
        setUser(null);
        setProfile(null);
        setIsLoading(false);
        return;
      }

      try {
        const nextProfile = await loadBsiProfile(nextUser.uid);
        setUser(nextUser);
        setProfile(nextProfile);
      } catch (error) {
        setUser(null);
        setProfile(null);
        await firebaseSignOut(auth);
        console.error('Unable to load BSI profile:', error);
      } finally {
        setIsLoading(false);
      }
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      isLoading,
      configurationReady: isFirebaseConfigured,
      signIn: async (email, password) => {
        const { auth } = requireFirebase();
        const credential = await signInWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );

        try {
          const nextProfile = await loadBsiProfile(credential.user.uid);
          setUser(credential.user);
          setProfile(nextProfile);
        } catch (error) {
          await firebaseSignOut(auth);
          throw error;
        }
      },
      signOut: async () => {
        const { auth } = requireFirebase();
        await firebaseSignOut(auth);
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
