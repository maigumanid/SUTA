import { Alert, StyleSheet, Text, View } from 'react-native';

import AppButton from '@/components/common/AppButton';
import ScreenContainer from '@/components/common/ScreenContainer';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

export default function ProfileScreen() {
  const { profile, signOut } = useAuth();

  const handleLogout = () => {
    Alert.alert('Log Out', 'Do you want to end this session?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: () => void signOut(),
      },
    ]);
  };

  return (
    <ScreenContainer>
      <View style={styles.container}>
        <View>
          <Text style={styles.title}>BSI Profile</Text>
          <Text style={styles.subtitle}>
            Your account and assigned barangay
          </Text>
        </View>

        <View style={styles.card}>
          <ProfileRow label="Name" value={profile?.name} />
          <ProfileRow label="Email" value={profile?.email} />
          <ProfileRow label="Contact number" value={profile?.contactNumber} />
          <ProfileRow label="Assigned barangay" value={profile?.assignedBarangay} />
          <ProfileRow label="UID" value={profile?.uid} />
        </View>

        <AppButton title="Log Out" variant="outline" onPress={handleLogout} />
      </View>
    </ScreenContainer>
  );
}

function ProfileRow({ label, value }: { label: string; value?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value ?? 'Not available'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingVertical: SPACING.xl, gap: SPACING.xl },
  title: { fontSize: 28, fontWeight: '700', color: COLORS.text },
  subtitle: { marginTop: 5, fontSize: 14, color: COLORS.textSecondary },
  card: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    gap: SPACING.lg,
  },
  row: { gap: SPACING.xs },
  label: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted },
  value: { fontSize: 15, color: COLORS.text },
});
