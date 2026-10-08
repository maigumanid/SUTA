import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import AppButton from '@/components/common/AppButton';
import KeyboardSafeView from '@/components/common/KeyboardSafeView';
import ProfileAvatar from '@/components/common/ProfileAvatar';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useNetwork } from '@/context/NetworkContext';
import {
  removeOwnProfileAvatar,
  selectProfilePhoto,
  type SelectedProfilePhoto,
  uploadOwnProfileAvatar,
} from '@/services/profileAvatarService';
import { updateOwnSupabaseProfile } from '@/services/supabaseProfileService';

export default function EditProfileScreen() {
  const { profile, refreshProfile } = useAuth();
  const { isOnline } = useNetwork();
  const [name, setName] = useState(profile?.name ?? '');
  const [contactNumber, setContactNumber] = useState(profile?.contactNumber ?? '');
  const [selectedPhoto, setSelectedPhoto] = useState<SelectedProfilePhoto | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!profile) return null;

  const returnToProfile = () => {
    router.replace(
      profile.role === 'admin'
        ? '/(admin)/admin-profile'
        : '/(tabs)/profile'
    );
  };

  const choosePhoto = async () => {
    if (isOnline === false) {
      Alert.alert('Internet Connection Required', 'Profile changes require an internet connection.');
      return;
    }
    try {
      const selection = await selectProfilePhoto();
      if (selection) {
        setSelectedPhoto(selection);
        setRemovePhoto(false);
      }
    } catch (error) {
      Alert.alert('Unable to Select Photo', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const save = async () => {
    if (isOnline === false) {
      Alert.alert('Internet Connection Required', 'Profile changes require an internet connection.');
      return;
    }
    if (!name.trim() || !contactNumber.trim()) {
      Alert.alert('Complete Your Profile', 'Full name and contact number are required.');
      return;
    }

    setSaving(true);
    let uploadedPath: string | undefined;
    try {
      const nextAvatarPath = selectedPhoto
        ? (uploadedPath = await uploadOwnProfileAvatar(profile.uid, selectedPhoto))
        : removePhoto
          ? undefined
          : profile.avatarPath;
      await updateOwnSupabaseProfile({
        name,
        contactNumber,
        avatarPath: nextAvatarPath,
      });
      if (removePhoto && profile.avatarPath) {
        await removeOwnProfileAvatar(profile.avatarPath).catch(() => undefined);
      }
      await refreshProfile();
      Alert.alert('Profile Updated', 'Your profile changes were saved.', [
        { text: 'OK', onPress: returnToProfile },
      ]);
    } catch (error) {
      if (uploadedPath && !profile.avatarPath) {
        await removeOwnProfileAvatar(uploadedPath).catch(() => undefined);
      }
      Alert.alert('Unable to Update Profile', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const roleLabel = profile.role === 'admin'
    ? 'Municipal/City Sanitation Administrator'
    : 'Barangay Sanitary Inspector';

  return <View style={styles.screen}>
    <View style={styles.header}>
      <Pressable accessibilityLabel="Cancel profile editing" onPress={returnToProfile} style={styles.backButton}>
        <Ionicons name="close" size={24} color={COLORS.text} />
      </Pressable>
      <View style={styles.flex}><Text style={styles.title}>Edit Profile</Text><Text style={styles.subtitle}>Personal presentation and contact information</Text></View>
    </View>
    <KeyboardSafeView>
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
    >
      {isOnline === false ? <View style={styles.offlineCard}><Ionicons name="cloud-offline-outline" size={20} color={COLORS.offline} /><Text style={styles.offlineText}>Profile changes require an internet connection. Your current profile remains available.</Text></View> : null}

      <View style={styles.photoSection}>
        <ProfileAvatar name={name || profile.name} avatarPath={removePhoto ? undefined : profile.avatarPath} localUri={selectedPhoto?.uri} size={96} />
        <View style={styles.photoActions}>
          <AppButton title={profile.avatarPath || selectedPhoto ? 'Change Photo' : 'Add Photo'} variant="outline" disabled={isOnline === false || saving} onPress={() => void choosePhoto()} />
          {(profile.avatarPath || selectedPhoto) && !removePhoto ? <AppButton title="Remove Photo" variant="outline" disabled={isOnline === false || saving} onPress={() => { setSelectedPhoto(null); setRemovePhoto(true); }} /> : null}
        </View>
      </View>

      <View style={styles.card}>
        <Field label="FULL NAME" value={name} onChangeText={setName} editable={!saving && isOnline !== false} />
        <Field label="CONTACT NUMBER" value={contactNumber} onChangeText={setContactNumber} keyboardType="phone-pad" editable={!saving && isOnline !== false} />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Admin-controlled account details</Text>
        <Text style={styles.help}>Contact your administrator if an official assignment or account detail needs correction.</Text>
        <ReadOnly label="EMAIL" value={profile.email} />
        <ReadOnly label="ROLE" value={roleLabel} />
        <ReadOnly label="ASSIGNED BARANGAY" value={profile.role === 'bsi' ? profile.assignedBarangay : 'Not applicable'} />
        <ReadOnly label="JURISDICTION" value={profile.jurisdictionName ?? 'Not specified'} />
      </View>

      <View style={styles.actions}>
        <AppButton title="Save Changes" loading={saving} disabled={isOnline === false || saving} onPress={() => void save()} />
        <AppButton title="Cancel" variant="outline" disabled={saving} onPress={returnToProfile} />
      </View>
    </ScrollView>
    </KeyboardSafeView>
  </View>;
}

function Field({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...props} placeholderTextColor={COLORS.textMuted} style={styles.input} /></View>;
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return <View style={styles.readOnlyRow}><Text style={styles.label}>{label}</Text><Text style={styles.readOnlyValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.surface },
  backButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.lg, backgroundColor: COLORS.primarySoft },
  title: { ...TYPOGRAPHY.title, color: COLORS.text },
  subtitle: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginTop: 2 },
  content: { padding: SPACING.lg, paddingBottom: SPACING.section, gap: SPACING.xl },
  offlineCard: { flexDirection: 'row', gap: SPACING.sm, padding: SPACING.md, borderRadius: RADIUS.xl, backgroundColor: COLORS.offlineSoft },
  offlineText: { ...TYPOGRAPHY.body, color: COLORS.offline, flex: 1 },
  photoSection: { alignItems: 'center', gap: SPACING.lg, padding: SPACING.xl, borderRadius: RADIUS.xxl, backgroundColor: COLORS.primarySoft, borderWidth: 1, borderColor: COLORS.primaryLight },
  photoActions: { width: '100%', gap: SPACING.sm },
  card: { padding: SPACING.lg, gap: SPACING.lg, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.xl, backgroundColor: COLORS.surface, ...SHADOWS.subtle },
  field: { gap: SPACING.xs },
  label: { ...TYPOGRAPHY.label, color: COLORS.textMuted },
  input: { minHeight: 50, paddingHorizontal: SPACING.md, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, backgroundColor: COLORS.background, color: COLORS.text },
  sectionTitle: { ...TYPOGRAPHY.subheading, color: COLORS.text },
  help: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary },
  readOnlyRow: { gap: 3 },
  readOnlyValue: { ...TYPOGRAPHY.body, color: COLORS.text },
  actions: { gap: SPACING.sm },
});
