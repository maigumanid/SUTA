import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Text } from 'react-native';

import AdminPage, { adminStyles } from '@/components/admin/AdminPage';
import AppButton from '@/components/common/AppButton';
import { useAuth } from '@/context/AuthContext';

export default function AdminProfileScreen() {
  const { profile, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const logout = async () => {
    setLoading(true);
    try { await signOut(); router.replace('/login'); }
    catch (error) { Alert.alert('Unable to Sign Out', error instanceof Error ? error.message : 'Please try again.'); }
    finally { setLoading(false); }
  };
  return (
    <AdminPage title="Profile" subtitle="Authorized sanitation administrator">
      <Text style={adminStyles.sectionTitle}>{profile?.name}</Text>
      <Text style={adminStyles.body}>{profile?.email}</Text>
      <Text style={adminStyles.body}>Municipal/City Sanitation Administrator</Text>
      <Text style={adminStyles.body}>{profile?.jurisdictionName ?? 'Jurisdiction not specified'}</Text>
      <AppButton title="Sign Out" variant="outline" loading={loading} onPress={() => void logout()} />
    </AdminPage>
  );
}
