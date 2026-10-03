import { Ionicons } from '@expo/vector-icons';
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
} from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import TourOverlay, {
  TourTarget,
} from '@/components/onboarding/TourOverlay';

import AppButton from '@/components/common/AppButton';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { usePlaces } from '@/context/PlacesContext';
import {
  getStoredInspectionsForPlace,
  StoredInspection,
} from '@/storage/inspectionStorage';

export default function PlaceDetailsScreen() {
  const { getPlaceById, isLoading } = usePlaces();
  const { profile } = useAuth();
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
  const [inspectionHistory, setInspectionHistory] =
    useState<StoredInspection[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] =
    useState(true);
  const [historyError, setHistoryError] =
    useState<string | null>(null);

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

  const loadInspectionHistory = useCallback(async () => {
    if (!profile) {
      setInspectionHistory([]);
      setIsHistoryLoading(false);
      return;
    }

    setIsHistoryLoading(true);
    setHistoryError(null);

    try {
      const records = await getStoredInspectionsForPlace(id, {
        bsiUid: profile.uid,
        barangayId: profile.assignedBarangayId,
      });

      setInspectionHistory(records);
    } catch (error) {
      console.error(
        'Unable to load inspection history:',
        error
      );
      setHistoryError(
        'Inspection history could not be loaded from this device.'
      );
    } finally {
      setIsHistoryLoading(false);
    }
  }, [id, profile]);

  useFocusEffect(
    useCallback(() => {
      void loadInspectionHistory();
    }, [loadInspectionHistory])
  );

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

  const place = getPlaceById(id);

  if (!place) {
    return (
      <View style={styles.notFound}>
        <Ionicons
          name="location-outline"
          size={48}
          color={COLORS.textMuted}
        />

        <Text style={styles.notFoundTitle}>
          {isLoading ? 'Loading place...' : 'Place not found'}
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

          {isHistoryLoading ? (
            <View style={styles.historyState}>
              <ActivityIndicator
                color={COLORS.primary}
              />
              <Text style={styles.historyStateText}>
                Loading inspection history...
              </Text>
            </View>
          ) : historyError ? (
            <View style={styles.emptyHistory}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name="alert-circle-outline"
                  size={28}
                  color={COLORS.violation}
                />
              </View>

              <Text style={styles.emptyTitle}>
                History unavailable
              </Text>

              <Text style={styles.emptyText}>
                {historyError}
              </Text>

              <AppButton
                title="Try Again"
                variant="outline"
                onPress={() => {
                  void loadInspectionHistory();
                }}
                style={styles.historyRetry}
              />
            </View>
          ) : inspectionHistory.length === 0 ? (
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
            <View style={styles.historyList}>
              {inspectionHistory.map((inspection) => (
                <InspectionHistoryCard
                  key={inspection.id}
                  inspection={inspection}
                  originalInspection={
                    inspection.reinspectionOfInspectionId
                      ? inspectionHistory.find(
                          (candidate) =>
                            candidate.id ===
                            inspection.reinspectionOfInspectionId
                        )
                      : undefined
                  }
                  followUpInspection={inspectionHistory.find(
                    (candidate) =>
                      candidate.reinspectionOfInspectionId ===
                      inspection.id
                  )}
                />
              ))}
            </View>
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
            disabled={!isHousehold}
          />

          {!isHousehold && (
            <Text style={styles.developmentNote}>
              The official inspection form for this place type is not yet available. Household inspection data will not be used for it.
            </Text>
          )}
        </View>

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

type InspectionHistoryCardProps = {
  inspection: StoredInspection;
  originalInspection?: StoredInspection;
  followUpInspection?: StoredInspection;
};

function InspectionHistoryCard({
  inspection,
  originalInspection,
  followUpInspection,
}: InspectionHistoryCardProps) {
  const isReinspection = Boolean(
    inspection.reinspectionId ||
      inspection.reinspectionOfInspectionId
  );
  const result = getInspectionResultDetails(
    inspection.result
  );
  const findingLabel =
    inspection.findings.length === 1
      ? '1 finding'
      : `${inspection.findings.length} findings`;

  let relationship: string | undefined;

  if (isReinspection) {
    relationship = originalInspection
      ? `Follow-up to ${formatInspectionDate(
          originalInspection.inspectionDate
        )}`
      : 'Linked follow-up inspection';
  } else if (followUpInspection) {
    relationship = `Follow-up completed ${formatInspectionDate(
      followUpInspection.inspectionDate
    )}`;
  }

  return (
    <View style={styles.historyCard}>
      <View style={styles.historyIcon}>
        <Ionicons
          name={
            isReinspection
              ? 'refresh-outline'
              : 'clipboard-outline'
          }
          size={22}
          color={COLORS.primary}
        />
      </View>

      <View style={styles.historyContent}>
        <View style={styles.historyCardHeader}>
          <Text style={styles.historyTitle}>
            {isReinspection
              ? 'Reinspection'
              : 'Initial Inspection'}
          </Text>

          <View
            style={[
              styles.historyResultBadge,
              { backgroundColor: result.background },
            ]}
          >
            <Text
              style={[
                styles.historyResultText,
                { color: result.color },
              ]}
            >
              {result.label}
            </Text>
          </View>
        </View>

        <Text style={styles.historyDate}>
          {formatInspectionDate(inspection.inspectionDate)}
        </Text>

        <Text style={styles.historySummary}>
          {findingLabel} · {formatSyncStatus(inspection.syncStatus)}
        </Text>

        {relationship ? (
          <Text style={styles.historyRelationship}>
            {relationship}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function formatInspectionDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Date not available';
  }

  return date.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatSyncStatus(status: StoredInspection['syncStatus']) {
  switch (status) {
    case 'synced':
      return 'Synced';
    case 'failed':
      return 'Sync failed';
    default:
      return 'Pending sync';
  }
}

function getInspectionResultDetails(
  result: StoredInspection['result']
) {
  switch (result) {
    case 'compliant':
      return {
        label: 'Compliant',
        color: COLORS.compliant,
        background: COLORS.compliantSoft,
      };
    case 'non_compliant':
      return {
        label: 'Non-Compliant',
        color: COLORS.violation,
        background: COLORS.violationSoft,
      };
    case 'for_reinspection':
      return {
        label: 'For Reinspection',
        color: COLORS.warning,
        background: COLORS.warningSoft,
      };
    default:
      return {
        label: 'Result not recorded',
        color: COLORS.neutral,
        background: COLORS.neutralSoft,
      };
  }
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
    alignItems: 'flex-start',
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

  historyList: {
    gap: SPACING.sm,
  },

  historyCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },

  historyResultBadge: {
    flexShrink: 1,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
  },

  historyResultText: {
    fontSize: 10,
    fontWeight: '700',
  },

  historySummary: {
    marginTop: 5,
    fontSize: 12,
    color: COLORS.textSecondary,
  },

  historyRelationship: {
    marginTop: 5,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },

  historyState: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    minHeight: 96,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
  },

  historyStateText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },

  historyRetry: {
    alignSelf: 'stretch',
    marginTop: SPACING.md,
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
