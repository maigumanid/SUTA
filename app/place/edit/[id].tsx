import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import AppButton from '@/components/common/AppButton';
import AppInput from '@/components/common/AppInput';
import KeyboardSafeView from '@/components/common/KeyboardSafeView';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useNetwork } from '@/context/NetworkContext';
import { usePlaces } from '@/context/PlacesContext';
import { updatePlaceProfile } from '@/services/placeService';
import { PLACE_TYPES, type PlaceType } from '@/types/place';

export default function EditPlaceProfileScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { getPlaceById, refreshPlaces } = usePlaces();
  const { isOnline } = useNetwork();
  const place = getPlaceById(id);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [representativeName, setRepresentativeName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [purok, setPurok] = useState('');
  const [notes, setNotes] = useState('');
  const [placeType, setPlaceType] = useState<PlaceType>('Household / Residence');

  useEffect(() => {
    if (!place) return;
    setName(place.name); setAddress(place.address); setRepresentativeName(place.representativeName ?? '');
    setContactNumber(place.contactNumber ?? ''); setPurok(place.purok ?? ''); setNotes(place.notes ?? ''); setPlaceType(place.placeType);
  }, [place]);

  const save = async () => {
    if (!place) return;
    if (!name.trim() || !address.trim()) {
      Alert.alert('Required information', 'Place / household name and address cannot be empty.');
      return;
    }
    if (!isOnline) {
      Alert.alert('Connection required', 'Profile changes must be verified with the barangay register before they are saved.');
      return;
    }
    setSaving(true);
    try {
      await updatePlaceProfile(place.id, { name, address, representativeName, contactNumber, purok, notes, placeType });
      await refreshPlaces();
      Alert.alert('Place profile updated', representativeName.trim() && purok.trim() ? 'This record is now complete.' : 'The record remains marked as needing completion.', [{ text: 'View place', onPress: () => router.replace(`/place/${place.id}`) }]);
    } catch (error) {
      Alert.alert('Unable to update place', error instanceof Error ? error.message : 'The place profile could not be updated.');
    } finally { setSaving(false); }
  };

  if (!place) return <View style={styles.center}><Text style={styles.body}>This place is not available in the current barangay cache.</Text><AppButton title="Back to Places" onPress={() => router.replace('/(tabs)/establishments')} style={styles.backToList} /></View>;

  return <KeyboardSafeView><View style={styles.screen}><View style={styles.header}><Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" style={styles.back}><Ionicons name="arrow-back" size={22} color={COLORS.text} /></Pressable><View style={styles.flex}><Text style={styles.eyebrow}>{place.profileStatus === 'starter' ? 'COMPLETE STARTER RECORD' : 'PLACE DIRECTORY'}</Text><Text style={styles.title}>Place profile</Text></View></View>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {place.profileStatus === 'starter' ? <View style={styles.starter}><View style={styles.starterMark}><Ionicons name="create-outline" size={24} color={COLORS.warningDark} /></View><View style={styles.flex}><Text style={styles.starterTitle}>Field details still needed</Text><Text style={styles.starterText}>Add a representative and purok to complete this imported census record. Contact and notes remain optional.</Text></View></View> : null}
      <View style={styles.form}>
        <AppInput label="PLACE / HOUSEHOLD NAME *" value={name} onChangeText={setName} placeholder="Enter a name" />
        <AppInput label="ADDRESS *" value={address} onChangeText={setAddress} placeholder="Enter the complete address" />
        <AppInput label="REPRESENTATIVE / HOUSEHOLD HEAD" value={representativeName} onChangeText={setRepresentativeName} placeholder="Not yet recorded" />
        <AppInput label="PUROK" value={purok} onChangeText={setPurok} placeholder="Not yet recorded" />
        <AppInput label="CONTACT NUMBER" value={contactNumber} onChangeText={setContactNumber} placeholder="Optional" keyboardType="phone-pad" />
        <View><Text style={styles.label}>PLACE TYPE</Text><View style={styles.types}>{PLACE_TYPES.map((type) => <Pressable key={type} onPress={() => setPlaceType(type)} style={[styles.type, placeType === type && styles.typeActive]}><Text style={[styles.typeText, placeType === type && styles.typeTextActive]}>{type}</Text></Pressable>)}</View></View>
        <AppInput label="NOTES / REMARKS" value={notes} onChangeText={setNotes} placeholder="Optional source-list or field note" multiline numberOfLines={4} />
        <AppButton title={representativeName.trim() && purok.trim() ? 'Save complete profile' : 'Save as starter record'} onPress={save} loading={saving} disabled={!isOnline} />
        {!isOnline ? <Text style={styles.offline}>Reconnect to update this directory record.</Text> : null}
      </View>
    </ScrollView>
  </View></KeyboardSafeView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background }, header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.surface }, back: { width: 44, height: 44, borderRadius: RADIUS.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primarySoft }, flex: { flex: 1 }, eyebrow: { ...TYPOGRAPHY.tiny, fontWeight: '800', letterSpacing: 1, color: COLORS.primary }, title: { ...TYPOGRAPHY.heading, color: COLORS.text }, content: { width: '100%', maxWidth: 700, alignSelf: 'center', padding: SPACING.lg, paddingBottom: SPACING.section },
  starter: { flexDirection: 'row', gap: SPACING.md, padding: SPACING.lg, marginBottom: SPACING.xl, borderRadius: RADIUS.xl, backgroundColor: COLORS.warningSoft, borderWidth: 1, borderColor: '#EBD8A7' }, starterMark: { width: 46, height: 46, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface }, starterTitle: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text }, starterText: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginTop: 3 },
  form: { gap: SPACING.lg }, label: { ...TYPOGRAPHY.label, color: COLORS.textSecondary, marginBottom: SPACING.sm }, types: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm }, type: { paddingVertical: 9, paddingHorizontal: SPACING.md, borderRadius: RADIUS.pill, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border }, typeActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary }, typeText: { ...TYPOGRAPHY.caption, fontWeight: '700', color: COLORS.textSecondary }, typeTextActive: { color: COLORS.white }, offline: { ...TYPOGRAPHY.caption, color: COLORS.offline, textAlign: 'center' }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl, backgroundColor: COLORS.background }, body: { ...TYPOGRAPHY.bodySmall, color: COLORS.textSecondary, textAlign: 'center' }, backToList: { alignSelf: 'stretch', marginTop: SPACING.lg },
});

