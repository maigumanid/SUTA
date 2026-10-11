import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppButton from '@/components/common/AppButton';
import EntranceTransition from '@/components/common/EntranceTransition';
import ScreenContainer from '@/components/common/ScreenContainer';
import { SUTA_ASSETS } from '@/constants/sutaAssets';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { setOnboardingState } from '@/storage/secureStorage';

type GuideStep = {
  image: number;
  title: string;
  bsiBody: string;
  adminBody: string;
};

const STEPS: GuideStep[] = [
  {
    image: SUTA_ASSETS.onboardingPlaces,
    title: 'Organize places and fieldwork',
    bsiBody: 'Find or register households in your assigned barangay, then keep every field visit connected to the right place.',
    adminBody: 'Review registered places and keep barangay fieldwork organized across assigned inspectors.',
  },
  {
    image: SUTA_ASSETS.onboardingInspection,
    title: 'Capture complete inspections',
    bsiBody: 'Record water and sanitation checks, testing dates, findings, remarks, and private evidence—even while working offline.',
    adminBody: 'Review complete water and sanitation records, findings, follow-up details, and authorized evidence.',
  },
  {
    image: SUTA_ASSETS.onboardingSyncReports,
    title: 'Sync, follow up, and report',
    bsiBody: 'Safely synchronize field records, monitor reinspections, and prepare complete operational reports when connected.',
    adminBody: 'Monitor synchronized activity, follow-up workload, and municipality-ready reports from authorized records.',
  },
];

export default function OnboardingScreen() {
  const { user, profile } = useAuth();
  const { replay } = useLocalSearchParams<{ replay?: string }>();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const steps = useMemo(() => STEPS, []);
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
  const compact = height < 700;

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, SPACING.xl) }]}
        showsVerticalScrollIndicator={false}
      >
        <View pointerEvents="none" style={styles.backgroundArt}>
          <View style={styles.orbTop} />
          <View style={styles.orbBottom} />
        </View>

        <View style={styles.header}>
          <Image accessibilityLabel="SUTA" source={SUTA_ASSETS.wordmark} contentFit="contain" style={styles.wordmark} />
          <Pressable onPress={requestSkip} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.skip}>Skip</Text>
          </Pressable>
        </View>

        <EntranceTransition key={index} distance={14} style={styles.slide}>
          <View style={[styles.illustrationStage, compact && styles.illustrationStageCompact]}>
            <View style={styles.illustrationHalo} />
            <Image
              accessibilityLabel={step.title}
              source={step.image}
              contentFit="contain"
              transition={140}
              style={styles.illustration}
            />
          </View>
          <Text style={styles.roleLabel}>{profile.role === 'admin' ? 'MUNICIPAL OPERATIONS' : 'FIELD OPERATIONS'}</Text>
          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.body}>{profile.role === 'admin' ? step.adminBody : step.bsiBody}</Text>
        </EntranceTransition>

        <View accessibilityLabel={`Page ${index + 1} of ${steps.length}`} style={styles.indicators}>
          {steps.map((item, itemIndex) => (
            <View key={item.title} style={[styles.indicator, itemIndex === index && styles.indicatorActive]} />
          ))}
        </View>

        <View style={styles.actions}>
          {index > 0 ? (
            <AppButton title="Previous" variant="secondary" style={styles.action} onPress={() => setIndex((value) => value - 1)} />
          ) : <View style={styles.action} />}
          <AppButton
            title={last ? 'Get Started' : 'Next'}
            style={styles.action}
            onPress={() => last ? void leave('completed') : setIndex((value) => value + 1)}
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
    paddingTop: SPACING.lg,
    position: 'relative',
  },
  backgroundArt: { ...StyleSheet.absoluteFillObject, left: -SPACING.xl, right: -SPACING.xl, overflow: 'hidden' },
  orbTop: { position: 'absolute', width: 240, height: 240, borderRadius: 120, top: -138, right: -96, backgroundColor: COLORS.aquaSoft },
  orbBottom: { position: 'absolute', width: 210, height: 210, borderRadius: 105, bottom: 34, left: -128, backgroundColor: COLORS.primaryMist },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 50 },
  wordmark: { width: 108, height: 42 },
  skip: { ...TYPOGRAPHY.bodyMedium, color: COLORS.primary, padding: SPACING.sm },
  slide: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.md },
  illustrationStage: { width: '100%', height: 350, alignItems: 'center', justifyContent: 'center', marginTop: SPACING.sm },
  illustrationStageCompact: { height: 250 },
  illustrationHalo: { position: 'absolute', width: '82%', height: '72%', borderRadius: RADIUS.pill, backgroundColor: 'rgba(221,245,241,0.72)' },
  illustration: { width: '100%', height: '100%' },
  roleLabel: { ...TYPOGRAPHY.tiny, color: COLORS.primary, fontWeight: '800', letterSpacing: 1.1, marginTop: SPACING.md },
  title: { ...TYPOGRAPHY.display, color: COLORS.text, textAlign: 'center', marginTop: SPACING.sm, maxWidth: 460 },
  body: { ...TYPOGRAPHY.body, color: COLORS.textSecondary, textAlign: 'center', marginTop: SPACING.md, maxWidth: 500 },
  indicators: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, marginTop: SPACING.xl },
  indicator: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.borderStrong },
  indicatorActive: { width: 28, backgroundColor: COLORS.primary },
  actions: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.xl },
  action: { flex: 1 },
});
