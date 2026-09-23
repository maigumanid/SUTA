import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  useEffect,
  useRef,
  useState,
} from 'react';

import TourOverlay, {
  TourTarget,
} from '@/components/onboarding/TourOverlay';

import AppButton from '@/components/common/AppButton';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { Place } from '@/types/place';

const SAMPLE_PLACES: Place[] = [
  {
    id: '1',
    name: 'Dela Cruz Household',
    representativeName: 'Juan Dela Cruz',
    address: 'Purok 1',
    purok: 'Purok 1',
    placeType: 'Household / Residence',
    status: 'Not Inspected',
    riskLevel: 'Low',
  },
  {
    id: '2',
    name: 'Santos Household',
    representativeName: 'Maria Santos',
    address: 'Purok 2',
    purok: 'Purok 2',
    placeType: 'Household / Residence',
    status: 'For Reinspection',
    riskLevel: 'High',
    lastInspectionDate: 'September 10, 2026',
  },
  {
    id: '3',
    name: 'Sample Food House',
    representativeName: 'Pedro Reyes',
    address: 'Purok 3',
    purok: 'Purok 3',
    placeType: 'Food Establishment',
    status: 'Compliant',
    riskLevel: 'Low',
    lastInspectionDate: 'September 15, 2026',
  },
  {
    id: '4',
    name: 'Barangay Elementary School',
    representativeName: 'Ana Cruz',
    address: 'Purok 4',
    purok: 'Purok 4',
    placeType: 'School',
    status: 'Not Inspected',
    riskLevel: 'Medium',
  },
  {
    id: '5',
    name: 'Barangay Covered Court',
    representativeName: 'Barangay Representative',
    address: 'Purok 5',
    purok: 'Purok 5',
    placeType: 'Public Facility',
    status: 'For Reinspection',
    riskLevel: 'Medium',
    lastInspectionDate: 'September 18, 2026',
  },
  {
    id: '6',
    name: 'San Roque Chapel',
    representativeName: 'Community Representative',
    address: 'Purok 6',
    purok: 'Purok 6',
    placeType: 'Church',
    status: 'Not Inspected',
    riskLevel: 'Low',
  },
];

export default function PlaceDetailsScreen() {
  const { id, tour } = useLocalSearchParams<{
    id: string;
    tour?: string;
  }>();

  const isTourActive = tour === 'true';

  const [tourStep, setTourStep] = useState(0);
  const [tourTarget, setTourTarget] =
    useState<TourTarget | null>(null);

  const [isProfileReady, setIsProfileReady] =
    useState(false);

  const profileRef = useRef<View>(null);
  const informationRef = useRef<View>(null);
  const inspectionRef = useRef<View>(null);
  const actionRef = useRef<View>(null);

  const scrollRef = useRef<ScrollView>(null);

  const profileY = useRef(0);
  const informationY = useRef(0);
  const inspectionY = useRef(0);
  const actionY = useRef(0);

  const tourSteps = [
    {
      title: 'Place Overview',
      description:
        'This section shows the selected household or place, its type, current inspection status, and risk level.',
      ref: profileRef,
      y: profileY,
    },
    {
      title: 'Place Information',
      description:
        'Review the household head or representative, purok, address, and place type before starting an inspection.',
      ref: informationRef,
      y: informationY,
    },
    {
      title: 'Inspection Status',
      description:
        'Check the current sanitary inspection status, risk level, and previous inspection date.',
      ref: inspectionRef,
      y: inspectionY,
    },
    {
      title: 'Start Inspection',
      description:
        'Use this button when you are ready to conduct the sanitary inspection for this household or place.',
      ref: actionRef,
      y: actionY,
    },
  ];

  const showTourStep = (index: number) => {
    if (!isTourActive) {
      return;
    }

    setTourTarget(null);

    const step = tourSteps[index];

    scrollRef.current?.scrollTo({
      y: Math.max(step.y.current - 20, 0),
      animated: true,
    });

    setTimeout(() => {
      step.ref.current?.measureInWindow(
        (x, y, width, height) => {
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
      isProfileReady &&
      tourTarget === null &&
      tourStep === 0
    ) {
      const timer = setTimeout(() => {
        showTourStep(0);
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [
    isTourActive,
    isProfileReady,
    tourStep,
  ]);

  const nextTourStep = () => {
    if (tourStep < tourSteps.length - 1) {
      const next = tourStep + 1;

      setTourTarget(null);
      setTourStep(next);

      setTimeout(() => {
        showTourStep(next);
      }, 100);
    } else {
      setTourTarget(null);

      setTimeout(() => {
        router.push({
          pathname: '/inspection/new',
          params: {
            placeId: id,
            tour: 'true',
          },
        });
      }, 150);
    }
  };

  const previousTourStep = () => {
    if (tourStep === 0) {
      return;
    }

    const previous = tourStep - 1;

    setTourTarget(null);
    setTourStep(previous);

    setTimeout(() => {
      showTourStep(previous);
    }, 100);
  };

  const skipTour = () => {
    setTourTarget(null);

    router.replace({
      pathname: '/place/[id]',
      params: {
        id,
      },
    });
  };

  const place = SAMPLE_PLACES.find(
    (item) => item.id === id
  );

  if (!place) {
    return (
      <View style={styles.notFound}>
        <Ionicons
          name="location-outline"
          size={48}
          color={COLORS.textMuted}
        />

        <Text style={styles.notFoundTitle}>
          Place not found
        </Text>

        <AppButton
          title="Go Back"
          onPress={() => router.back()}
        />
      </View>
    );
  }

  const isHousehold =
    place.placeType === 'Household / Residence';

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color={COLORS.text}
          />
        </Pressable>

        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>
            Place Details
          </Text>

          <Text style={styles.headerSubtitle}>
            Information and inspection records
          </Text>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View
          ref={profileRef}
          collapsable={false}
          style={styles.profileCard}
          onLayout={(event) => {
            profileY.current =
              event.nativeEvent.layout.y;

            setIsProfileReady(true);
          }}
        >
          <View style={styles.placeIcon}>
            <Ionicons
              name={
                isHousehold
                  ? 'home-outline'
                  : 'business-outline'
              }
              size={32}
              color={COLORS.primary}
            />
          </View>

          <Text style={styles.placeName}>
            {place.name}
          </Text>

          <Text style={styles.placeType}>
            {place.placeType}
          </Text>

          <View style={styles.badgeRow}>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>
                {place.status}
              </Text>
            </View>

            <Text style={styles.riskText}>
              {place.riskLevel} Risk
            </Text>
          </View>
        </View>

        <View
          ref={informationRef}
          collapsable={false}
          onLayout={(event) => {
            informationY.current =
              event.nativeEvent.layout.y;
          }}
        >
          <Text style={styles.sectionTitle}>
            {isHousehold
              ? 'Household Information'
              : 'Place Information'}
          </Text>

          <View style={styles.infoCard}>
            <InfoRow
              icon="person-outline"
              label={
                isHousehold
                  ? 'Household Head / Representative'
                  : 'Owner / Representative'
              }
              value={place.representativeName}
            />

            <View style={styles.divider} />

            <InfoRow
              icon="location-outline"
              label="Purok"
              value={place.purok}
            />

            <View style={styles.divider} />

            <InfoRow
              icon="navigate-outline"
              label="Address"
              value={place.address}
            />

            <View style={styles.divider} />

            <InfoRow
              icon={
                isHousehold
                  ? 'home-outline'
                  : 'business-outline'
              }
              label="Place Type"
              value={place.placeType}
            />
          </View>
        </View>

        <View
          ref={inspectionRef}
          collapsable={false}
          onLayout={(event) => {
            inspectionY.current =
              event.nativeEvent.layout.y;
          }}
        >
          <Text style={styles.sectionTitle}>
            Inspection Status
          </Text>

          <View style={styles.infoCard}>
            <InfoRow
              icon="shield-checkmark-outline"
              label="Current Status"
              value={place.status}
            />

            <View style={styles.divider} />

            <InfoRow
              icon="warning-outline"
              label="Risk Level"
              value={`${place.riskLevel} Risk`}
            />

            <View style={styles.divider} />

            <InfoRow
              icon="calendar-outline"
              label="Last Inspection"
              value={
                place.lastInspectionDate ??
                'No inspection recorded'
              }
            />
          </View>
        </View>

        <View>
          <Text style={styles.sectionTitle}>
            Inspection History
          </Text>

          {!place.lastInspectionDate ? (
            <View style={styles.emptyHistory}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name="clipboard-outline"
                  size={28}
                  color={COLORS.textMuted}
                />
              </View>

              <Text style={styles.emptyTitle}>
                No inspection history
              </Text>

              <Text style={styles.emptyText}>
                No sanitary inspection has been recorded for this place yet.
              </Text>
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.historyCard,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.historyIcon}>
                <Ionicons
                  name="clipboard-outline"
                  size={22}
                  color={COLORS.primary}
                />
              </View>

              <View style={styles.historyContent}>
                <Text style={styles.historyTitle}>
                  Sanitary Inspection
                </Text>

                <Text style={styles.historyDate}>
                  {place.lastInspectionDate}
                </Text>

                <Text style={styles.historyStatus}>
                  {place.status}
                </Text>
              </View>

              <Ionicons
                name="chevron-forward"
                size={20}
                color={COLORS.textMuted}
              />
            </Pressable>
          )}
        </View>

        {place.status === 'For Reinspection' && (
          <View style={styles.reinspectionNotice}>
            <Ionicons
              name="alert-circle-outline"
              size={23}
              color={COLORS.warning}
            />

            <View style={styles.noticeContent}>
              <Text style={styles.noticeTitle}>
                Reinspection Required
              </Text>

              <Text style={styles.noticeText}>
                This place has findings that require a follow-up inspection.
              </Text>
            </View>
          </View>
        )}

        <View
          ref={actionRef}
          collapsable={false}
          style={styles.actions}
          onLayout={(event) => {
            actionY.current =
              event.nativeEvent.layout.y;
          }}
        >
          <AppButton
            title={
              place.status === 'For Reinspection'
                ? 'Start Reinspection'
                : 'Start New Inspection'
            }
            onPress={() => {
              if (
                place.status === 'For Reinspection'
              ) {
                router.push(
                  `/reinspection/${place.id}`
                );
                return;
              }

              router.push({
                pathname: '/inspection/new',
                params: {
                  placeId: place.id,
                },
              });
            }}
          />
        </View>

        <Text style={styles.developmentNote}>
          Sample data is being used during development.
        </Text>
      </ScrollView>

      <TourOverlay
        visible={
          isTourActive &&
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

type InfoRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
};

function InfoRow({
  icon,
  label,
  value,
}: InfoRowProps) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoRowIcon}>
        <Ionicons
          name={icon}
          size={20}
          color={COLORS.primary}
        />
      </View>

      <View style={styles.infoRowContent}>
        <Text style={styles.infoLabel}>
          {label}
        </Text>

        <Text style={styles.infoValue}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  backButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primarySoft,
  },

  headerText: {
    flex: 1,
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },

  headerSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: COLORS.textSecondary,
  },

  content: {
    padding: SPACING.lg,
    paddingBottom: 40,
    gap: SPACING.lg,
  },

  profileCard: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
  },

  placeIcon: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 32,
    backgroundColor: COLORS.primarySoft,
    marginBottom: SPACING.md,
  },

  placeName: {
    fontSize: 21,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },

  placeType: {
    marginTop: 4,
    fontSize: 14,
    color: COLORS.textSecondary,
  },

  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primarySoft,
  },

  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },

  riskText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },

  sectionTitle: {
    marginBottom: SPACING.sm,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },

  infoCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },

  infoRowIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primarySoft,
  },

  infoRowContent: {
    flex: 1,
    marginLeft: SPACING.md,
  },

  infoLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },

  infoValue: {
    marginTop: 3,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.divider,
  },

  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },

  historyIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primarySoft,
  },

  historyContent: {
    flex: 1,
    marginLeft: SPACING.md,
  },

  historyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },

  historyDate: {
    marginTop: 3,
    fontSize: 12,
    color: COLORS.textSecondary,
  },

  historyStatus: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },

  emptyHistory: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
  },

  emptyIcon: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
    backgroundColor: COLORS.primarySoft,
  },

  emptyTitle: {
    marginTop: SPACING.sm,
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },

  emptyText: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },

  reinspectionNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    backgroundColor: '#FFF4DD',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },

  noticeContent: {
    flex: 1,
  },

  noticeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },

  noticeText: {
    marginTop: 3,
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.textSecondary,
  },

  actions: {
    marginTop: SPACING.sm,
  },

  developmentNote: {
    fontSize: 11,
    lineHeight: 16,
    color: COLORS.textMuted,
    textAlign: 'center',
  },

  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    padding: SPACING.xl,
    backgroundColor: COLORS.background,
  },

  notFoundTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },

  pressed: {
    opacity: 0.7,
  },
});
