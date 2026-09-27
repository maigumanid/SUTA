import {
  router,
  useFocusEffect,
  useLocalSearchParams,
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

import AppButton from '@/components/common/AppButton';
import MetricCard from '@/components/dashboard/MetricCard';
import QuickAction from '@/components/dashboard/QuickAction';
import ReinspectionCard from '@/components/dashboard/ReinspectionCard';

import TourOverlay, {
  TourTarget,
} from '@/components/onboarding/TourOverlay';

import {
  COLORS,
  SPACING,
} from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { usePlaces } from '@/context/PlacesContext';
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
  const { getPlaceById } = usePlaces();
  const [inspections, setInspections] = useState<StoredInspection[]>([]);
  const [reinspections, setReinspections] = useState<ReinspectionRecord[]>([]);
  const { tour } = useLocalSearchParams<{
    tour?: string;
  }>();

  const isTourActive =
    tour === 'true';

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

  const quickActionsRef =
    useRef<View>(null);

  const reinspectionsRef =
    useRef<View>(null);

  const scrollRef =
    useRef<ScrollView>(null);

  const metricsY = useRef(0);
  const inspectionY = useRef(0);
  const quickActionsY = useRef(0);
  const reinspectionsY = useRef(0);

  useFocusEffect(
    useCallback(() => {
      setIsScreenFocused(true);

      if (profile) {
        const scope = {
          bsiUid: profile.uid,
          barangayId: profile.assignedBarangayId,
        };
        void Promise.all([
          getStoredInspections(scope),
          getReinspections(scope),
        ]).then(([nextInspections, nextReinspections]) => {
          setInspections(nextInspections);
          setReinspections(nextReinspections);
        });
      }

      return () => {
        setIsScreenFocused(false);
        setTourTarget(null);
      };
    }, [profile])
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
        'These cards show your inspections today and establishments that require reinspection.',
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
      title: 'Quick Actions',
      description:
        'Open the establishments directory or check inspections waiting to synchronize.',
      ref: quickActionsRef,
      y: quickActionsY,
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
          showTourStep(0);
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
        <View>
          <Text style={styles.greeting}>
            Good day, {profile?.name ?? 'Inspector'}
          </Text>

          <Text style={styles.subtitle}>
            Sanitary Inspection Dashboard
          </Text>
        </View>

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
          />

          <MetricCard
            value={pendingReinspections.length}
            label="For Reinspection"
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
          <Text
            style={styles.sectionTitle}
          >
            Inspection
          </Text>

          <Text
            style={
              styles.sectionDescription
            }
          >
            Start a new sanitary inspection
            for an establishment.
          </Text>

          <AppButton
            title="Start Sanitary Inspection"
            onPress={() =>
              router.push(
                '/(tabs)/establishments'
              )
            }
          />
        </View>

        <View
          ref={quickActionsRef}
          collapsable={false}
          style={styles.section}
          onLayout={(event) => {
            quickActionsY.current =
              event.nativeEvent.layout.y;
          }}
        >
          <Text
            style={styles.sectionTitle}
          >
            Quick Actions
          </Text>

          <View style={styles.list}>
            <QuickAction
              title="Establishments"
              description="Search establishments and view inspection history."
              icon="business-outline"
              onPress={() =>
                router.push(
                  '/(tabs)/establishments'
                )
              }
            />

            <QuickAction
              title="Sync Status"
              description="View inspections waiting to synchronize."
              icon="cloud-upload-outline"
              onPress={() =>
                router.push('/sync')
              }
            />
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
          <View
            style={styles.sectionHeader}
          >
            <Text
              style={styles.sectionTitle}
            >
              Upcoming Reinspections
            </Text>

            <Text style={styles.count}>
              {pendingReinspections.length} pending
            </Text>
          </View>

          <View style={styles.list}>
            {pendingReinspections.length === 0 ? (
              <Text style={styles.sectionDescription}>
                No pending reinspections for this barangay.
              </Text>
            ) : (
              pendingReinspections.slice(0, 5).map((record) => (
                <ReinspectionCard
                  key={record.id}
                  establishmentName={
                    getPlaceById(record.placeId)?.name ?? `Place ${record.placeId}`
                  }
                  dueDate={new Date(record.scheduledDate).toLocaleDateString(
                    'en-PH',
                    { month: 'short', day: 'numeric', year: 'numeric' }
                  )}
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
    paddingBottom: SPACING.xl,
    gap: SPACING.xl,
  },

  greeting: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.text,
  },

  subtitle: {
    marginTop: SPACING.xs,
    fontSize: 14,
    color: COLORS.textSecondary,
  },

  metrics: {
    flexDirection: 'row',
    gap: SPACING.md,
  },

  section: {
    gap: SPACING.md,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'space-between',
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },

  sectionDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textSecondary,
  },

  list: {
    gap: SPACING.sm,
  },

  count: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.warning,
  },

  demoNote: {
    textAlign: 'center',
    fontSize: 12,
    color: COLORS.textMuted,
  },
});
