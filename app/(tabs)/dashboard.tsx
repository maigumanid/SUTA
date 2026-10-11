import {
  type Href,
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
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import EntranceTransition from '@/components/common/EntranceTransition';
import SectionHeader from '@/components/common/SectionHeader';
import SurfaceCard from '@/components/common/SurfaceCard';
import ReinspectionCard from '@/components/dashboard/ReinspectionCard';
import NotificationBell from '@/components/common/NotificationBell';
import ProfileAvatar from '@/components/common/ProfileAvatar';

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
import { isReinspectionOverdue } from '@/utils/reinspection';

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

  const reinspectionsRef =
    useRef<View>(null);

  const scrollRef =
    useRef<ScrollView>(null);

  const metricsY = useRef(0);
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
  const overdueReinspections = pendingReinspections.filter((reinspection) =>
    isReinspectionOverdue(reinspection.scheduledDate, reinspection.status)
  ).length;
  const pendingSync = inspections.filter((inspection) => inspection.syncStatus === 'pending').length;
  const failedSync = inspections.filter((inspection) => inspection.syncStatus === 'failed').length;
  const syncAttention = pendingSync + failedSync;

  const tourSteps = [
    {
      title: 'Inspection Overview',
      description:
        'These cards show your inspections today and places that require reinspection.',
      ref: metricsRef,
      y: metricsY,
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
          <View style={styles.heroCopy}>
            <View style={styles.assignmentPill}>
              <Ionicons name="location-outline" size={14} color={COLORS.primary} />
              <Text numberOfLines={1} style={styles.assignmentText}>{profile?.assignedBarangay ?? 'Assigned barangay'}</Text>
            </View>
            <Text style={styles.heroTitle}>Ready for today&apos;s fieldwork?</Text>
            <Text style={styles.heroBody}>Inspect, document, and move follow-ups forward.</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/establishments')} style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}>
            <View style={styles.primaryActionIcon}><Ionicons name="clipboard-outline" size={20} color={COLORS.primary} /></View>
            <Text style={styles.primaryActionText}>Start Inspection</Text>
            <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.push('/field-planning' as Href)} style={({ pressed }) => [styles.fieldPlanAction, pressed && styles.pressed]}>
            <Ionicons name="navigate-circle-outline" size={21} color={COLORS.primary} />
            <View style={styles.fieldPlanCopy}><Text style={styles.fieldPlanTitle}>Open Field Plan</Text><Text style={styles.fieldPlanText}>Coverage, queue, and map</Text></View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
          </Pressable>
        </EntranceTransition>

        <View
          ref={metricsRef}
          collapsable={false}
          style={styles.section}
          onLayout={(event) => {
            metricsY.current =
              event.nativeEvent.layout.y;

            setIsMetricsReady(true);
          }}
        >
          <SectionHeader title="Operational priorities" subtitle="Today&apos;s activity and items needing attention" />
          <EntranceTransition delay={45} style={styles.priorityPanel}>
            <View style={styles.todayPriority}>
              <View style={styles.activityCopy}>
                <Text style={styles.priorityEyebrow}>INSPECTION ACTIVITY</Text>
                <Text style={styles.todayLabel}>Recorded today</Text>
              </View>
              <Text style={styles.todayValue}>{inspectionsToday}</Text>
            </View>
            <View style={styles.needsAttentionHeader}>
              <Text style={styles.needsAttentionTitle}>Needs attention</Text>
              <Text style={styles.needsAttentionHint}>Open an item to take action</Text>
            </View>
            <View style={styles.priorityRows}>
              <Pressable onPress={() => router.push('/(tabs)/sync')} style={({ pressed }) => [styles.priorityRow, pressed && styles.pressed]}>
                <View style={[styles.priorityMarker, failedSync > 0 ? styles.priorityMarkerDanger : styles.priorityMarkerBlue]} />
                <View style={styles.priorityCopy}><Text style={styles.priorityTitle}>Sync</Text><Text style={styles.priorityMeta}>{failedSync > 0 ? `${failedSync} failed · ${pendingSync} pending` : `${pendingSync} pending · none failed`}</Text></View>
                <Text style={[styles.priorityValue, failedSync > 0 && styles.priorityValueDanger]}>{syncAttention}</Text>
                <Ionicons name="chevron-forward" size={17} color={COLORS.textMuted} />
              </Pressable>
              <Pressable onPress={() => pendingReinspections[0] ? router.push(`/reinspection/${pendingReinspections[0].id}`) : undefined} disabled={!pendingReinspections.length} style={({ pressed }) => [styles.priorityRow, pressed && styles.pressed]}>
                <View style={[styles.priorityMarker, styles.priorityMarkerWarning]} />
                <View style={styles.priorityCopy}><Text style={styles.priorityTitle}>Follow-ups</Text><Text style={styles.priorityMeta}>{overdueReinspections > 0 ? `${overdueReinspections} overdue` : 'No overdue follow-ups'}</Text></View>
                <Text style={styles.priorityValue}>{pendingReinspections.length}</Text>
                {pendingReinspections.length ? <Ionicons name="chevron-forward" size={17} color={COLORS.textMuted} /> : null}
              </Pressable>
            </View>
          </EntranceTransition>
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
    width: '100%',
    maxWidth: 700,
    alignSelf: 'center',
    padding: SPACING.lg,
    paddingBottom: SPACING.section,
    gap: SPACING.xl,
  },

  greeting: {
    ...TYPOGRAPHY.title,
    fontSize: 22,
    lineHeight: 27,
    color: COLORS.text,
  },
  eyebrow: { ...TYPOGRAPHY.tiny, color: COLORS.primary, fontWeight: '800', letterSpacing: 0.8 },
  hero: { padding: SPACING.xl, backgroundColor: COLORS.primarySoft, borderRadius: RADIUS.xxl, borderWidth: 1, borderColor: COLORS.primaryLight, ...SHADOWS.subtle },
  heroCopy: { width: '100%', zIndex: 2 },
  assignmentPill: { maxWidth: 220, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, paddingHorizontal: SPACING.sm, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.76)', borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.primaryLight },
  assignmentText: { ...TYPOGRAPHY.tiny, color: COLORS.primaryDeep, fontWeight: '700', flexShrink: 1 },
  heroTitle: { ...TYPOGRAPHY.title, fontSize: 25, lineHeight: 30, color: COLORS.text, marginTop: SPACING.md, maxWidth: 390 },
  heroBody: { ...TYPOGRAPHY.bodySmall, color: COLORS.textSecondary, marginTop: SPACING.sm, maxWidth: 390 },
  primaryAction: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.lg, paddingHorizontal: SPACING.md, borderRadius: RADIUS.lg, backgroundColor: COLORS.primary, zIndex: 2 },
  primaryActionIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.white },
  primaryActionText: { ...TYPOGRAPHY.bodyMedium, color: COLORS.white, flex: 1 },
  fieldPlanAction: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.sm, paddingHorizontal: SPACING.md, borderRadius: RADIUS.lg, backgroundColor: 'rgba(255,255,255,0.78)', borderWidth: 1, borderColor: COLORS.primaryLight },
  fieldPlanCopy: { flex: 1 }, fieldPlanTitle: { ...TYPOGRAPHY.bodyMedium, color: COLORS.primaryDeep }, fieldPlanText: { ...TYPOGRAPHY.tiny, color: COLORS.textSecondary },

  section: {
    gap: SPACING.lg,
  },
  priorityPanel: { overflow: 'hidden', backgroundColor: COLORS.surface, borderRadius: RADIUS.xxl, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.subtle },
  todayPriority: { minHeight: 104, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.lg, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.lg, backgroundColor: COLORS.primarySoft },
  activityCopy: { flex: 1 },
  priorityEyebrow: { ...TYPOGRAPHY.tiny, color: COLORS.primary, fontWeight: '800', letterSpacing: 0.8 },
  todayValue: { ...TYPOGRAPHY.metric, fontSize: 42, lineHeight: 46, color: COLORS.primaryDeep },
  todayLabel: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginTop: SPACING.xs },
  needsAttentionHeader: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.xs },
  needsAttentionTitle: { ...TYPOGRAPHY.label, color: COLORS.text },
  needsAttentionHint: { ...TYPOGRAPHY.tiny, color: COLORS.textMuted, marginTop: 1 },
  priorityRows: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.sm },
  priorityRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  priorityMarker: { width: 8, height: 32, borderRadius: RADIUS.pill },
  priorityMarkerBlue: { backgroundColor: COLORS.blue },
  priorityMarkerDanger: { backgroundColor: COLORS.violation },
  priorityMarkerWarning: { backgroundColor: COLORS.warning },
  priorityCopy: { flex: 1, minWidth: 0 },
  priorityTitle: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text },
  priorityMeta: { ...TYPOGRAPHY.tiny, color: COLORS.textSecondary, marginTop: 2 },
  priorityValue: { ...TYPOGRAPHY.title, minWidth: 28, textAlign: 'right', fontSize: 22, lineHeight: 27, color: COLORS.text },
  priorityValueDanger: { color: COLORS.violation },
  pressed: { opacity: 0.74, transform: [{ scale: 0.99 }] },

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
