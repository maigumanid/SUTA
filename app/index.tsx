import { Redirect } from 'expo-router';

import { useAuth } from '@/context/AuthContext';

export default function Index() {
  const { user, profile } = useAuth();

  if (!user || !profile) {
    return <Redirect href="/login" />;
  }

  if (profile.mustChangePassword) {
    return <Redirect href="/change-password" />;
  }

  return (
    <Redirect
      href={profile.role === 'admin'
        ? '/(admin)/admin-dashboard'
        : '/(tabs)/dashboard'}
    />
  );
}
