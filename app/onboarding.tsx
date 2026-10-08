import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppButton from '@/components/common/AppButton';
import EntranceTransition from '@/components/common/EntranceTransition';
import ScreenContainer from '@/components/common/ScreenContainer';
import SanitationIllustration from '@/components/illustrations/SanitationIllustration';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { setOnboardingState } from '@/storage/secureStorage';

type GuideStep = { icon: keyof typeof Ionicons.glyphMap; title: string; body: string };

const BSI_STEPS: GuideStep[] = [
  { icon: 'home-outline', title: 'Start with today’s fieldwork', body: 'Home brings your assigned barangay, workload, priority places, and follow-ups into one view.' },
  { icon: 'location-outline', title: 'Choose the right place', body: 'Find or register a household, confirm its details, then begin the visit from that place record.' },
  { icon: 'navigate-outline', title: 'Capture the field location', body: 'Record where the visit happens without changing the household’s registered address.' },
  { icon: 'checkbox-outline', title: 'Inspect with confidence', body: 'Complete the water and sanitation checklist, select testing dates, and keep your draft as you move.' },
  { icon: 'camera-outline', title: 'Document what matters', body: 'Record clear findings and attach private evidence to the finding it supports.' },
  { icon: 'cloud-upload-outline', title: 'Save now, sync safely', body: 'Review and save even offline. Sync shows Pending, Failed, and Synced records without losing local history.' },
  { icon: 'document-text-outline', title: 'Follow up and submit', body: 'Track reinspections, add device-calendar reminders, and export complete operational reports when connected.' },
];

const ADMIN_STEPS: GuideStep[] = [
  { icon: 'speedometer-outline', title: 'See the municipality clearly', body: 'Dashboard metrics surface inspection activity, sanitation risk, and follow-up workload.' },
  { icon: 'people-outline', title: 'Keep assignments official', body: 'Create and manage BSI accounts, then assign each inspector from the canonical barangay directory.' },
  { icon: 'clipboard-outline', title: 'Review the record', body: 'Inspect authorized historical records and full printable forms without altering submitted data.' },
  { icon: 'warning-outline', title: 'Act on priorities', body: 'Monitor high-risk places and pending or overdue reinspections from operational views.' },
  { icon: 'document-text-outline', title: 'Prepare real submissions', body: 'Export municipal summaries, barangay reports, inspection registers, and follow-up reports from complete filtered data.' },
];

export default function OnboardingScreen() {
  const { user, profile } = useAuth();
  const { replay } = useLocalSearchParams<{ replay?: string }>();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const steps = useMemo(() => profile?.role === 'admin' ? ADMIN_STEPS : BSI_STEPS, [profile?.role]);
  const home = profile?.role === 'admin' ? '/(admin)/admin-dashboard' : '/(tabs)/dashboard';

  const leave = useCallback(async (state: 'completed' | 'skipped') => {
    if (!user || !profile) return;
    await setOnboardingState(user.uid, profile.role, state);
    router.replace(home);
  }, [home, profile, user]);

  const requestSkip = useCallback(() => {
    Alert.alert('Skip app guide?', 'You can replay it later from Profile.', [
      { text: 'Keep Learning', style: 'cancel' },
      { text: 'Skip', onPress: () => void leave('skipped') },
    ]);
  }, [leave]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (index > 0) setIndex((current) => current - 1);
      else if (replay === 'true' && router.canGoBack()) router.back();
      else requestSkip();
      return true;
    });
    return () => subscription.remove();
  }, [index, replay, requestSkip]);

  if (!user || !profile) return null;
  const step = steps[index];
  const last = index === steps.length - 1;

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, SPACING.xl) }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.badge}>{profile.role === 'admin' ? 'ADMIN GUIDE' : 'BSI GUIDE'}</Text>
          <Pressable onPress={requestSkip} accessibilityRole="button"><Text style={styles.skip}>Skip</Text></Pressable>
        </View>
        <View style={styles.progressTrack}><View style={[styles.progress, { width: `${((index + 1) / steps.length) * 100}%` }]} /></View>
        <Text style={styles.count}>Step {index + 1} of {steps.length}</Text>
        <EntranceTransition key={index} distance={14} style={styles.card}>
          <SanitationIllustration size="medium" variant={profile.role === 'admin' ? 'reports' : index % 2 === 0 ? 'inspection' : 'community'} style={styles.illustration} />
          <View style={styles.icon}><Ionicons name={step.icon} size={22} color={COLORS.primary} /></View>
          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.body}>{step.body}</Text>
        </EntranceTransition>
        <Text style={styles.note}>Your inspection drafts and cached history remain available for supported offline work.</Text>
        <View style={styles.actions}>
          {index > 0 && <AppButton title="Previous" variant="secondary" onPress={() => setIndex((value) => value - 1)} />}
          <AppButton title={last ? 'Finish' : 'Next'} onPress={() => last ? void leave('completed') : setIndex((value) => value + 1)} />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingVertical: SPACING.xl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: { ...TYPOGRAPHY.label, color: COLORS.primary }, skip: { ...TYPOGRAPHY.body, color: COLORS.textSecondary, padding: SPACING.sm },
  progressTrack: { height: 6, marginTop: SPACING.xl, borderRadius: 3, backgroundColor: COLORS.divider, overflow: 'hidden' },
  progress: { height: '100%', backgroundColor: COLORS.primary }, count: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, marginTop: SPACING.sm },
  card: { flex: 1, minHeight: 430, alignItems: 'center', justifyContent: 'center', marginVertical: SPACING.xl, padding: SPACING.xxl, backgroundColor: COLORS.surface, borderRadius: RADIUS.xxl, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.card },
  illustration: { marginBottom: SPACING.md },
  icon: { width: 46, height: 46, borderRadius: RADIUS.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primaryLight, marginBottom: SPACING.lg },
  title: { ...TYPOGRAPHY.heading, color: COLORS.text, textAlign: 'center' }, body: { ...TYPOGRAPHY.body, color: COLORS.textSecondary, textAlign: 'center', marginTop: SPACING.md },
  note: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, textAlign: 'center' }, actions: { gap: SPACING.md, marginTop: SPACING.xl },
});
