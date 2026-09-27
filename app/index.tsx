import { Redirect } from 'expo-router';

import { useAuth } from '@/context/AuthContext';

export default function Index() {
  const { user, profile } = useAuth();

  return (
    <Redirect
      href={user && profile ? '/(tabs)/dashboard' : '/login'}
    />
  );
}
