import {
  router,
  useFocusEffect,
} from 'expo-router';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import QuickActionCard from '@/components/common/QuickActionCard';
import EntranceTransition from '@/components/common/EntranceTransition';
import SectionHeader from '@/components/common/SectionHeader';
import SurfaceCard from '@/components/common/SurfaceCard';
import MetricCard from '@/components/dashboard/MetricCard';
import ReinspectionCard from '@/components/dashboard/ReinspectionCard';
import NotificationBell from '@/components/common/NotificationBell';
import ProfileAvatar from '@/components/common/ProfileAvatar';
import SanitationIllustration from '@/components/illustrations/SanitationIllustration';

import TourOverlay, {
  TourTarget,
} from '@/components/onboarding/TourOverlay';

import {
  COLORS,
  RADIUS,
  SHADOWS,
  SPACING,
  TYPOGRAPHY,
} from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useNetwork } from '@/context/NetworkContext';
import { usePlaces } from '@/context/PlacesContext';
import { loadReinspections } from '@/services/reinspectionService';
import {
  getStoredInspections,
  StoredInspection,
} from '@/storage/inspectionStorage';
import {
  getReinspections,
  ReinspectionRecord,
} from '@/storage/reinspectionStorage';

export default function DashboardScreen() {
  const { profile } = useAuth();
  const { isOnline } = useNetwork();
  const { getPlaceById } = usePlaces();
  const [inspections, setInspections] = useState<StoredInspection[]>([]);
  const [reinspections, setReinspections] = useState<ReinspectionRecord[]>([]);
  // The legacy measured-target tour is retained temporarily but has no entry
  // point; the reliable role-specific guide now lives at /onboarding.
  const isTourActive = false;

  const [
    isScreenFocused,
    setIsScreenFocused,
  ] = useState(false);

  const [tourStep, setTourStep] =
    useState(0);

  const [
    tourTarget,
    setTourTarget,
  ] = useState<TourTarget | null>(
    null
  );

  const [
    isMetricsReady,
    setIsMetricsReady,
  ] = useState(false);

  const metricsRef =
    useRef<View>(null);

  const inspectionRef =
    useRef<View>(null);

  const reinspectionsRef =
    useRef<View>(null);

  const scrollRef =
    useRef<ScrollView>(null);

  const metricsY = useRef(0);
  const inspectionY = useRef(0);
  const reinspectionsY = useRef(0);

  useFocusEffect(
    useCallback(() => {
      setIsScreenFocused(true);

      if (profile) {
        const scope = {
          bsiUid: profile.uid,
          barangayId: profile.assignedBarangayId,
        };
        void (async () => {
          const nextInspections = await getStoredInspections(scope);
          let nextReinspections = await getReinspections(scope);

          if (isOnline !== false) {
            try {
              nextReinspections = await loadReinspections(scope, true);
            } catch (error) {
              console.error('Unable to refresh dashboard workload:', error);
            }
          }

          setInspections(nextInspections);
          setReinspections(nextReinspections);
        })();
      }

      return () => {
        setIsScreenFocused(false);
        setTourTarget(null);
      };
    }, [isOnline, profile])
  );

  const today = new Date().toISOString().slice(0, 10);
  const inspectionsToday = inspections.filter(
    (inspection) => inspection.inspectionDate.slice(0, 10) === today
  ).length;
  const pendingReinspections = reinspections.filter(
    (reinspection) => reinspection.status === 'pending'
  );

  const tourSteps = [
    {
      title: 'Inspection Overview',
      description:
        'These cards show your inspections today and places that require reinspection.',
      ref: metricsRef,
      y: metricsY,
    },
    {
      title: 'Start an Inspection',
      description:
        'Use this section when you are ready to conduct a new sanitary inspection.',
      ref: inspectionRef,
      y: inspectionY,
    },
    {
      title: 'Upcoming Reinspections',
      description:
        'Follow-up inspections and their due dates will appear here.',
      ref: reinspectionsRef,
      y: reinspectionsY,
    },
  ];

  const showTourStep = (
    index: number
  ) => {
    if (!isTourActive) {
      return;
    }

    setTourTarget(null);

    const step =
      tourSteps[index];

    scrollRef.current?.scrollTo({
      y: Math.max(
        step.y.current - 20,
        0
      ),
      animated: true,
    });

    setTimeout(() => {
      step.ref.current?.measureInWindow(
        (
          x,
          y,
          width,
          height
        ) => {
          setTourTarget({
            x,
            y,
            width,
            height,
          });
        }
      );
    }, 450);
  };

  useEffect(() => {
    if (
      isTourActive &&
      isScreenFocused &&
      isMetricsReady &&
      tourStep === 0 &&
      tourTarget === null
    ) {
      const timer = setTimeout(
        () => {
          scrollRef.current?.scrollTo({ y: Math.max(metricsY.current - 20, 0), animated: true });
          metricsRef.current?.measureInWindow((x, y, width, height) => {
            setTourTarget({ x, y, width, height });
          });
        },
        300
      );

      return () =>
        clearTimeout(timer);
    }
  }, [
    isTourActive,
    isScreenFocused,
    isMetricsReady,
    tourStep,
    tourTarget,
  ]);

  const nextTourStep = () => {
    if (
      tourStep <
      tourSteps.length - 1
    ) {
      const next =
        tourStep + 1;

      setTourTarget(null);
      setTourStep(next);

      setTimeout(() => {
        showTourStep(next);
      }, 100);

      return;
    }

    setTourTarget(null);

    setTimeout(() => {
      router.replace({
        pathname:
          '/(tabs)/establishments',
        params: {
          tour: 'true',
        },
      });
    }, 150);
  };

  const previousTourStep = () => {
    if (tourStep === 0) {
      return;
    }

    const previous =
      tourStep - 1;

    setTourTarget(null);
    setTourStep(previous);

    setTimeout(() => {
      showTourStep(previous);
    }, 100);
  };

  const skipTour = () => {
    setTourTarget(null);

    router.replace(
      '/(tabs)/dashboard'
    );
  };

  return (
    <View style={styles.root}>
      <ScrollView
        ref={scrollRef}
        style={styles.screen}
        contentContainerStyle={
          styles.container
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        <View style={styles.headerRow}>
          <View style={styles.identity}>
            <ProfileAvatar name={profile?.name ?? 'Inspector'} avatarPath={profile?.avatarPath} size={44} />
            <View style={styles.headerText}>
              <Text style={styles.eyebrow}>BARANGAY SANITARY INSPECTOR</Text>
              <Text numberOfLines={1} style={styles.greeting}>Good day, {profile?.name?.split(' ')[0] ?? 'Inspector'}</Text>
            </View>
          </View>
          <NotificationBell />
        </View>

        <EntranceTransition style={styles.hero}>
          <View style={styles.heroGlow} />
          <View style={styles.heroCopy}>
            <View style={styles.assignmentPill}>
              <Ionicons name="location-outline" size={14} color={COLORS.white} />
              <Text numberOfLines={1} style={styles.assignmentText}>{profile?.assignedBarangay ?? 'Assigned barangay'}</Text>
            </View>
            <Text style={styles.heroTitle}>Keep your community inspection-ready.</Text>
            <Text style={styles.heroBody}>Capture field findings, follow up cases, and keep records moving—even offline.</Text>
          </View>
          <SanitationIllustration variant="community" size="small" style={styles.heroArt} />
        </EntranceTransition>

        <View
          ref={metricsRef}
          collapsable={false}
          style={styles.metrics}
          onLayout={(event) => {
            metricsY.current =
              event.nativeEvent.layout.y;

            setIsMetricsReady(true);
          }}
        >
          <MetricCard
            value={inspectionsToday}
            label="Inspections Today"
            icon="clipboard-outline"
          />

          <MetricCard
            value={pendingReinspections.length}
            label="For Reinspection"
            icon="refresh-outline"
            tone="warning"
          />
        </View>

        <View
          ref={inspectionRef}
          collapsable={false}
          style={styles.section}
          onLayout={(event) => {
            inspectionY.current =
              event.nativeEvent.layout.y;
          }}
        >
          <SectionHeader title="Quick actions" subtitle="Continue your field work" />
          <View style={styles.actions}>
            <QuickActionCard icon="add-circle-outline" title="Start an inspection" description="Choose a registered place" onPress={() => router.push('/(tabs)/establishments')} />
            <QuickActionCard icon="cloud-upload-outline" title="Check synchronization" description="Review pending or failed records" tone="blue" onPress={() => router.push('/(tabs)/sync')} />
          </View>
        </View>

        <View
          ref={reinspectionsRef}
          collapsable={false}
          style={styles.section}
          onLayout={(event) => {
            reinspectionsY.current =
              event.nativeEvent.layout.y;
          }}
        >
          <SectionHeader title="Upcoming reinspections" subtitle={`${pendingReinspections.length} ${pendingReinspections.length === 1 ? 'case' : 'cases'} awaiting follow-up`} />

          <View style={styles.list}>
            {pendingReinspections.length === 0 ? (
              <SurfaceCard tone="teal" style={styles.clearCard}>
                <View style={styles.clearIcon}><Ionicons name="checkmark-done-outline" size={24} color={COLORS.compliant} /></View>
                <View style={styles.clearCopy}>
                  <Text style={styles.clearTitle}>No follow-ups waiting</Text>
                  <Text style={styles.sectionDescription}>This barangay has no pending reinspections on this device.</Text>
                </View>
              </SurfaceCard>
            ) : (
              pendingReinspections.slice(0, 5).map((record) => (
                <ReinspectionCard
                  key={record.id}
                  establishmentName={
                    getPlaceById(record.placeId)?.name ?? 'Place not available'
                  }
                  scheduledDate={record.scheduledDate}
                  onPress={() => router.push(`/reinspection/${record.id}`)}
                />
              ))
            )}
          </View>
        </View>

      </ScrollView>

      <TourOverlay
        visible={
          isTourActive &&
          isScreenFocused &&
          tourTarget !== null
        }
        step={tourStep + 1}
        totalSteps={tourSteps.length}
        title={tourSteps[tourStep].title}
        description={
          tourSteps[tourStep].description
        }
        target={tourTarget}
        onNext={nextTourStep}
        onBack={
          tourStep > 0
            ? previousTourStep
            : undefined
        }
        onSkip={skipTour}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.md },
  identity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  headerText: { flex: 1, minWidth: 0 },
  root: {
    flex: 1,
    backgroundColor:
      COLORS.background,
  },

  screen: {
    flex: 1,
    backgroundColor:
      COLORS.background,
  },

  container: {
    padding: SPACING.lg,
    paddingBottom: SPACING.section,
    gap: SPACING.xl,
  },

  greeting: {
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '800',
    color: COLORS.text,
  },
  eyebrow: { ...TYPOGRAPHY.tiny, color: COLORS.primary, fontWeight: '800', letterSpacing: 0.8 },
  hero: { minHeight: 232, position: 'relative', overflow: 'hidden', flexDirection: 'row', alignItems: 'center', padding: SPACING.xl, backgroundColor: COLORS.primaryDeep, borderRadius: RADIUS.xxl, ...SHADOWS.card },
  heroGlow: { position: 'absolute', width: 190, height: 190, right: -48, top: -48, borderRadius: 95, backgroundColor: 'rgba(71,184,174,0.20)' },
  heroCopy: { flex: 1, minWidth: 0, zIndex: 2, paddingRight: 112 },
  assignmentPill: { maxWidth: 190, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, paddingHorizontal: SPACING.sm, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: RADIUS.pill },
  assignmentText: { ...TYPOGRAPHY.tiny, color: COLORS.white, fontWeight: '700' },
  heroTitle: { fontSize: 25, lineHeight: 30, letterSpacing: -0.4, fontWeight: '800', color: COLORS.white, marginTop: SPACING.md },
  heroBody: { ...TYPOGRAPHY.caption, color: '#D8EBE8', marginTop: SPACING.sm, maxWidth: 230 },
  heroArt: { position: 'absolute', right: 0, bottom: 12 },

  metrics: {
    flexDirection: 'row',
    gap: SPACING.md,
  },

  section: {
    gap: SPACING.lg,
  },
  actions: { gap: SPACING.sm },

  sectionDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textSecondary,
  },

  list: {
    gap: SPACING.sm,
  },
  clearCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  clearIcon: { width: 46, height: 46, borderRadius: RADIUS.lg, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' },
  clearCopy: { flex: 1 },
  clearTitle: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text },

  demoNote: {
    textAlign: 'center',
    fontSize: 12,
    color: COLORS.textMuted,
  },
});
