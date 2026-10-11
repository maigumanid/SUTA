import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AdminPage from '@/components/admin/AdminPage';
import AppButton from '@/components/common/AppButton';
import { useAuth } from '@/context/AuthContext';
import ProfileAvatar from '@/components/common/ProfileAvatar';
import SurfaceCard from '@/components/common/SurfaceCard';
import SectionHeader from '@/components/common/SectionHeader';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '@/constants/theme';

export default function AdminProfileScreen() {
  const { profile, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const logout = async () => {
    if (loading) return;
    setLoading(true);
    try { await signOut(); router.replace('/login'); }
    catch (error) { Alert.alert('Unable to Sign Out', error instanceof Error ? error.message : 'Please try again.'); }
    finally { setLoading(false); }
  };
  const confirmLogout = () => {
    if (loading) return;
    Alert.alert('Log Out', 'Do you want to end this session?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => void logout() },
    ]);
  };
  return (
    <AdminPage title="Profile" subtitle="Authorized sanitation administrator" allowOfflineContent>
      <View style={styles.hero}>
        <View style={styles.heroGlow} />
        <ProfileAvatar name={profile?.name ?? 'Administrator'} avatarPath={profile?.avatarPath} size={88} />
        <View style={styles.identityText}>
          <Text numberOfLines={2} style={styles.name}>{profile?.name ?? 'Administrator'}</Text>
          <View style={styles.rolePill}><Ionicons name="shield-checkmark-outline" size={14} color={COLORS.primaryDeep} /><Text style={styles.roleText}>Sanitation Administrator</Text></View>
        </View>
      </View>

      <SectionHeader title="Account details" subtitle="Identity and jurisdiction" />
      <SurfaceCard elevated style={styles.detailsCard}>
        <Detail icon="mail-outline" label="Email address" value={profile?.email} />
        <View style={styles.divider} />
        <Detail icon="call-outline" label="Contact number" value={profile?.contactNumber} />
        <View style={styles.divider} />
        <Detail icon="business-outline" label="Jurisdiction" value={profile?.jurisdictionName ?? 'Jurisdiction not specified'} />
        <View style={styles.divider} />
        <Detail icon="id-card-outline" label="Access role" value="Municipal/City Sanitation Administrator" />
      </SurfaceCard>

      <SectionHeader title="Security" subtitle="Manage access to your account" />
      <AppButton title="Change Password" variant="secondary" onPress={() => router.push('/change-password')} />

      <SectionHeader title="Profile & help" />
      <View style={styles.actions}>
        <AppButton title="Edit Profile" onPress={() => router.push('/edit-profile')} />
        <AppButton title="Replay App Guide" variant="secondary" onPress={() => router.push({ pathname: '/onboarding', params: { replay: 'true' } })} />
        <AppButton title="Log Out" variant="outline" loading={loading} onPress={confirmLogout} />
      </View>
    </AdminPage>
  );
}

function Detail({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value?: string }) {
  return <View style={styles.detail}><View style={styles.detailIcon}><Ionicons name={icon} size={19} color={COLORS.primary} /></View><View style={styles.detailCopy}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value || 'Not available'}</Text></View></View>;
}

const styles = StyleSheet.create({
  hero: { minHeight: 168, position: 'relative', overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: SPACING.lg, padding: SPACING.xl, backgroundColor: COLORS.primaryDeep, borderRadius: RADIUS.xxl, ...SHADOWS.card },
  heroGlow: { position: 'absolute', width: 180, height: 180, borderRadius: 90, right: -55, top: -70, backgroundColor: 'rgba(71,184,174,0.22)' },
  identityText: { flex: 1, minWidth: 0, alignItems: 'flex-start' },
  name: { ...TYPOGRAPHY.title, color: COLORS.textOnDark },
  rolePill: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginTop: SPACING.md, paddingHorizontal: SPACING.sm, paddingVertical: 7, borderRadius: RADIUS.pill, backgroundColor: '#CDEBE7' },
  roleText: { ...TYPOGRAPHY.tiny, flexShrink: 1, color: COLORS.primaryDeep, fontWeight: '800' },
  detailsCard: { paddingVertical: SPACING.sm },
  detail: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.md },
  detailIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primarySoft },
  detailCopy: { flex: 1 },
  label: { ...TYPOGRAPHY.tiny, color: COLORS.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text, marginTop: 2 },
  divider: { height: 1, backgroundColor: COLORS.divider, marginLeft: 50 },
  actions: { gap: SPACING.md },
});
