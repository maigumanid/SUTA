import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import AppButton from '@/components/common/AppButton';
import ProfileAvatar from '@/components/common/ProfileAvatar';
import ScreenContainer from '@/components/common/ScreenContainer';
import SectionHeader from '@/components/common/SectionHeader';
import SurfaceCard from '@/components/common/SurfaceCard';
import OfflineStoragePanel from '@/components/profile/OfflineStoragePanel';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

export default function ProfileScreen() {
  const { profile, signOut } = useAuth();

  const handleLogout = () => {
    Alert.alert('Log Out', 'Do you want to end this session?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View>
          <Text style={styles.title}>Profile</Text>
          <Text style={styles.subtitle}>Your account and field assignment</Text>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroGlow} />
          <ProfileAvatar name={profile?.name ?? 'BSI'} avatarPath={profile?.avatarPath} size={88} />
          <View style={styles.heroCopy}>
            <Text numberOfLines={2} style={styles.name}>{profile?.name ?? 'Barangay Sanitary Inspector'}</Text>
            <View style={styles.rolePill}><Ionicons name="shield-checkmark-outline" size={14} color={COLORS.primaryDeep} /><Text style={styles.roleText}>Barangay Sanitary Inspector</Text></View>
          </View>
        </View>

        <SectionHeader title="Account details" subtitle="Official access information" />
        <SurfaceCard elevated style={styles.detailsCard}>
          <ProfileRow icon="mail-outline" label="Email address" value={profile?.email} />
          <Divider />
          <ProfileRow icon="call-outline" label="Contact number" value={profile?.contactNumber} />
          <Divider />
          <ProfileRow icon="location-outline" label="Assigned barangay" value={profile?.assignedBarangay} />
          <Divider />
          <ProfileRow icon="id-card-outline" label="Access role" value="BSI" />
        </SurfaceCard>

        {profile?.uid && profile.assignedBarangayId ? (
          <OfflineStoragePanel
            scope={{
              bsiUid: profile.uid,
              barangayId: profile.assignedBarangayId,
            }}
          />
        ) : null}

        <SectionHeader title="Security" subtitle="Manage access to your account" />
        <AppButton title="Change Password" variant="secondary" onPress={() => router.push('/change-password')} />

        <SectionHeader title="Profile & help" />
        <View style={styles.actions}>
          <AppButton title="Edit Profile" onPress={() => router.push('/edit-profile')} />
          <AppButton title="Replay App Guide" variant="secondary" onPress={() => router.push({ pathname: '/onboarding', params: { replay: 'true' } })} />
          <AppButton title="Log Out" variant="outline" onPress={handleLogout} />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function ProfileRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value?: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}><Ionicons name={icon} size={19} color={COLORS.primary} /></View>
      <View style={styles.rowCopy}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value || 'Not available'}</Text></View>
    </View>
  );
}

function Divider() { return <View style={styles.divider} />; }

const styles = StyleSheet.create({
  container: { paddingTop: SPACING.xxl, paddingBottom: SPACING.section, gap: SPACING.xl },
  title: { ...TYPOGRAPHY.display, fontSize: 29, lineHeight: 39, color: COLORS.text },
  subtitle: { ...TYPOGRAPHY.bodySmall, marginTop: SPACING.xs, color: COLORS.textSecondary },
  hero: { minHeight: 168, position: 'relative', overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: SPACING.lg, padding: SPACING.xl, backgroundColor: COLORS.primaryDeep, borderRadius: RADIUS.xxl, ...SHADOWS.card },
  heroGlow: { position: 'absolute', width: 180, height: 180, borderRadius: 90, right: -55, top: -70, backgroundColor: 'rgba(71,184,174,0.22)' },
  heroCopy: { flex: 1, minWidth: 0, alignItems: 'flex-start' },
  name: { ...TYPOGRAPHY.title, color: COLORS.textOnDark },
  rolePill: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginTop: SPACING.md, paddingHorizontal: SPACING.sm, paddingVertical: 7, borderRadius: RADIUS.pill, backgroundColor: '#CDEBE7' },
  roleText: { ...TYPOGRAPHY.tiny, flexShrink: 1, color: COLORS.primaryDeep, fontWeight: '800' },
  detailsCard: { paddingVertical: SPACING.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.md },
  rowIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primarySoft },
  rowCopy: { flex: 1 },
  label: { ...TYPOGRAPHY.tiny, color: COLORS.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text, marginTop: 2 },
  divider: { height: 1, backgroundColor: COLORS.divider, marginLeft: 50 },
  actions: { gap: SPACING.md },
});
