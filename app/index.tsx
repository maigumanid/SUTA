import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { COLORS } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { hasCompletedOnboarding } from '@/storage/secureStorage';

export default function Index() {
  const { user, profile } = useAuth();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    if (!user || !profile || profile.mustChangePassword) {
      setOnboarded(null);
      return () => { active = false; };
    }
    void hasCompletedOnboarding(user.uid, profile.role).then((value) => {
      if (active) setOnboarded(value);
    });
    return () => { active = false; };
  }, [profile, user]);

  if (!user || !profile) return <Redirect href="/login" />;
  if (profile.mustChangePassword) return <Redirect href="/change-password" />;
  if (onboarded === null) return <View style={styles.loading}><ActivityIndicator color={COLORS.primary} /></View>;
  if (!onboarded) return <Redirect href="/onboarding" />;
  return <Redirect href={profile.role === 'admin' ? '/(admin)/admin-dashboard' : '/(tabs)/dashboard'} />;
}

const styles = StyleSheet.create({ loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background } });
