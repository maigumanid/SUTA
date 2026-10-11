import { Ionicons } from '@expo/vector-icons';
import {
  type Href,
  router,
  useFocusEffect,
  useLocalSearchParams,
} from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
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
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useNetwork } from '@/context/NetworkContext';
import { usePlaces } from '@/context/PlacesContext';
import {
  fetchInspectionHistoryForPlace,
  type InspectionHistoryItem,
  mergeInspectionHistory,
} from '@/services/inspectionHistoryService';
import { loadReinspections } from '@/services/reinspectionService';
import {
  getStoredInspectionsForPlace,
  StoredInspection,
} from '@/storage/inspectionStorage';
import { getCachedInspectionHistoryForPlace } from '@/storage/inspectionHistoryCache';
import {
  getReinspections,
  type ReinspectionRecord,
} from '@/storage/reinspectionStorage';
import { formatLocalDate, formatLocalDateTime } from '@/utils/dateTime';
import {
  getInspectionTypeLabel,
  isLinkedReinspection,
} from '@/utils/inspectionDisplay';
import { getRiskClassification } from '@/utils/riskClassification';
import { isReinspectionOverdue } from '@/utils/reinspection';
import { formatPurok } from '@/utils/placeDisplay';
import { shareComplianceNoticePdf } from '@/utils/complianceNoticePdf';

export default function PlaceDetailsScreen() {
  const { getPlaceById, isLoading } = usePlaces();
  const { profile } = useAuth();
  const { isOnline } = useNetwork();
  const { id } = useLocalSearchParams<{
    id: string;
  }>();
  const isTourActive = false;

  const [tourStep, setTourStep] = useState(0);
  const [tourTarget, setTourTarget] =
    useState<TourTarget | null>(null);

  const [isProfileReady, setIsProfileReady] =
    useState(false);
  const [inspectionHistory, setInspectionHistory] =
    useState<InspectionHistoryItem[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] =
    useState(true);
  const [historyError, setHistoryError] =
    useState<string | null>(null);
  const [reinspection, setReinspection] =
    useState<ReinspectionRecord | null>(null);
  const [isGeneratingNotice, setIsGeneratingNotice] = useState(false);

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
        'This section shows the selected household or place, its type, current inspection status, and risk classification availability.',
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
        'Check the current sanitary inspection status, risk classification availability, and previous inspection date.',
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
      setReinspection(null);
      setIsHistoryLoading(false);
      return;
    }

    setIsHistoryLoading(true);
    setHistoryError(null);

    try {
      const scope = {
        bsiUid: profile.uid,
        barangayId: profile.assignedBarangayId,
      };
      const [localRecords, cachedRecords, localReinspections] = await Promise.all([
        getStoredInspectionsForPlace(id, scope),
        getCachedInspectionHistoryForPlace(id, scope),
        getReinspections(scope),
      ]);
      const deviceRecords = mergeInspectionHistory(localRecords, cachedRecords);
      let records = deviceRecords;
      let reinspectionRecords = localReinspections;
      let refreshFailed = false;

      if (isOnline !== false) {
        try {
          const serverRecords = await fetchInspectionHistoryForPlace(id, scope);
          records = mergeInspectionHistory(deviceRecords, serverRecords);
        } catch (error) {
          console.error('Unable to refresh inspection history:', error);
          refreshFailed = true;
        }

        try {
          reinspectionRecords = await loadReinspections(scope, true);
        } catch (error) {
          console.error('Unable to refresh reinspection status:', error);
          refreshFailed = true;
        }
      }

      const latestRequiredInspection = records.find(
        (inspection) => inspection.result === 'for_reinspection'
      );
      const matchingReinspection = latestRequiredInspection
        ? reinspectionRecords.find(
            (record) =>
              record.originalInspectionId === latestRequiredInspection.id
          ) ?? null
        : reinspectionRecords
            .filter(
              (record) =>
                record.placeId === id && record.status === 'completed'
            )
            .sort(
              (left, right) =>
                Date.parse(right.completedAt ?? right.createdAt) -
                Date.parse(left.completedAt ?? left.createdAt)
            )[0] ?? null;

      setInspectionHistory(records);
      setReinspection(matchingReinspection);
      if (refreshFailed) {
        setHistoryError(
          'Some online records could not be refreshed. Check your connection and try again.'
        );
      }
    } catch (error) {
      console.error(
        'Unable to load inspection history:',
        error
      );
      setHistoryError(
        'Inspection history could not be refreshed. Check your connection and try again.'
      );
    } finally {
      setIsHistoryLoading(false);
    }
  }, [id, isOnline, profile]);

  useFocusEffect(
    useCallback(() => {
      void loadInspectionHistory();
    }, [loadInspectionHistory])
  );

  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/(tabs)/establishments');
  }, []);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          if (!router.canGoBack()) {
            router.replace('/(tabs)/establishments');
            return true;
          }
          return false;
        }
      );

      return () => subscription.remove();
    }, [])
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
        profileRef.current?.measureInWindow((x, y, width, height) => {
          setTourTarget({ x, y, width, height });
        });
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [
    isTourActive,
    isProfileReady,
    tourStep,
    tourTarget,
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
          onPress={goBack}
        />
      </View>
    );
  }

  const isHousehold =
    place.placeType === 'Household / Residence';
  const riskClassification = getRiskClassification(place.riskLevel);
  const fullHistory = inspectionHistory.filter(
    (record): record is StoredInspection => 'findings' in record
  );
  const correctiveByFinding = new Map<string, { status: 'Unresolved' | 'Partially Corrected' | 'Corrected'; date: string }>();
  [...fullHistory]
    .sort((left, right) => Date.parse(left.inspectionDate) - Date.parse(right.inspectionDate))
    .forEach((record) => record.findings.forEach((finding) => {
      const correction = finding.correctiveAction;
      if (correction) correctiveByFinding.set(`${correction.originalInspectionId}:${correction.originalFindingId}`, { status: correction.status, date: record.inspectionDate });
    }));
  const correctiveCounts = [...correctiveByFinding.values()].reduce(
    (counts, finding) => {
      const status = finding.status;
      if (status === 'Corrected') counts.corrected += 1;
      else if (status === 'Partially Corrected') counts.partial += 1;
      else if (status === 'Unresolved') counts.unresolved += 1;
      return counts;
    },
    { corrected: 0, partial: 0, unresolved: 0 }
  );
  const latestFailedInspection = [...fullHistory]
    .filter((record) => (record.result === 'non_compliant' || record.result === 'for_reinspection') && record.findings.some((finding) => !finding.correctiveAction))
    .sort((left, right) => Date.parse(right.inspectionDate) - Date.parse(left.inspectionDate))[0];

  const generateNotice = async () => {
    if (!latestFailedInspection || !profile) return;
    setIsGeneratingNotice(true);
    try {
      await shareComplianceNoticePdf({
        place,
        inspection: latestFailedInspection,
        barangay: place.barangay || profile.assignedBarangay,
        preparedBy: profile.name,
        correctiveStatuses: Object.fromEntries(
          latestFailedInspection.findings
            .filter((finding) => !finding.correctiveAction)
            .flatMap((finding) => {
              const value = correctiveByFinding.get(`${latestFailedInspection.id}:${finding.id}`);
              return value ? [[finding.id, value.status] as const] : [];
            })
        ),
        ...(reinspection?.status === 'pending' ? { scheduledDate: reinspection.scheduledDate } : {}),
      });
    } catch (error) {
      Alert.alert('Unable to Generate Notice', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsGeneratingNotice(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          onPress={goBack}
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
          <View style={styles.placeHeaderRow}>
            <View style={styles.placeIcon}>
              <Ionicons name={isHousehold ? 'home-outline' : 'business-outline'} size={27} color={COLORS.primary} />
            </View>
            <View style={styles.placeHeadingCopy}>
              <Text style={styles.placeName}>{place.name}</Text>
              <Text style={styles.placeType}>{place.placeType}</Text>
            </View>
          </View>

          <View style={styles.badgeRow}>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>
                {place.status}
              </Text>
            </View>

            <Text style={styles.riskText}>
              {riskClassification.label}
            </Text>
          </View>

          <View ref={informationRef} collapsable={false} style={styles.placeFacts} onLayout={(event) => { informationY.current = event.nativeEvent.layout.y; }}>
            <PlaceFact label={isHousehold ? 'Household Representative' : 'Owner / Representative'} value={place.representativeName || 'Not recorded'} />
            <PlaceFact label="Purok" value={formatPurok(place.purok)} />
            <PlaceFact label="Address" value={place.address} />
            {place.contactNumber ? <PlaceFact label="Contact" value={place.contactNumber} /> : null}
            {place.notes ? <PlaceFact label="Notes / Remarks" value={place.notes} last /> : null}
          </View>
        </View>

        {place.profileStatus === 'starter' ? (
          <View style={styles.completionCard}>
            <View style={styles.completionIcon}><Ionicons name="create-outline" size={24} color={COLORS.warningDark} /></View>
            <View style={styles.completionCopy}><Text style={styles.completionTitle}>Imported record needs completion</Text><Text style={styles.completionText}>Confirm the household representative and purok during field preparation.</Text></View>
            <Pressable accessibilityRole="button" onPress={() => router.push(`/place/edit/${place.id}` as Href)} style={({ pressed }) => [styles.completionAction, pressed && styles.pressed]}><Text style={styles.completionActionText}>Complete</Text><Ionicons name="arrow-forward" size={17} color={COLORS.warningDark} /></Pressable>
          </View>
        ) : null}

        {place.status !== 'For Reinspection' &&
          reinspection?.status !== 'pending' && (
            <View
              ref={actionRef}
              collapsable={false}
              style={styles.actions}
              onLayout={(event) => {
                actionY.current = event.nativeEvent.layout.y;
              }}
            >
              <Text style={styles.sectionTitle}>Primary Action</Text>
              <AppButton
                title="Start Inspection"
                onPress={() => {
                  router.push({
                    pathname: '/inspection/new',
                    params: { placeId: place.id },
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
          )}

        <View
          ref={inspectionRef}
          collapsable={false}
          onLayout={(event) => {
            inspectionY.current =
              event.nativeEvent.layout.y;
          }}
        >
          <Text style={styles.sectionTitle}>
            Current Sanitation Status
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
              value={riskClassification.label}
            />

            <View style={styles.divider} />

            <InfoRow
              icon="calendar-outline"
              label="Last Inspection"
              value={
                formatLocalDateTime(
                  place.lastInspectionDate,
                  'No inspection recorded'
                )
              }
            />

            <View style={styles.divider} />

            <InfoRow
              icon="refresh-outline"
              label="Reinspection Status"
              value={
                !reinspection
                  ? place.status === 'For Reinspection'
                    ? 'Required · Not scheduled'
                    : 'None pending'
                  : reinspection.status === 'completed'
                    ? `Completed · ${formatLocalDateTime(reinspection.completedAt)}`
                    : isReinspectionOverdue(reinspection.scheduledDate, reinspection.status)
                      ? `Overdue · ${formatLocalDate(reinspection.scheduledDate)}`
                      : `Scheduled · ${formatLocalDate(reinspection.scheduledDate)}`
              }
            />
          </View>
        </View>

        {correctiveByFinding.size > 0 ? (
          <View style={styles.correctiveProgress}>
            <View style={styles.correctiveProgressMark}><Ionicons name="construct-outline" size={20} color={COLORS.primary} /></View>
            <View style={styles.correctiveProgressCopy}>
              <Text style={styles.correctiveProgressTitle}>Corrective progress</Text>
              <Text style={styles.correctiveProgressText}>
                {correctiveByFinding.size} findings · {correctiveCounts.corrected} corrected · {correctiveCounts.partial} partial · {correctiveCounts.unresolved} unresolved
              </Text>
            </View>
          </View>
        ) : null}

        {(place.status === 'Non-Compliant' || place.status === 'For Reinspection') && latestFailedInspection ? (
          <AppButton title="Generate corrective notice" variant="outline" loading={isGeneratingNotice} onPress={() => void generateNotice()} />
        ) : null}

        {(place.status === 'For Reinspection' || reinspection) && (
          <View>
            <Text style={styles.sectionTitle}>
              Reinspection
            </Text>

            <View style={styles.reinspectionStatusCard}>
              <View style={styles.reinspectionStatusHeader}>
                <Ionicons
                  name={
                    reinspection?.status === 'completed'
                      ? 'checkmark-circle-outline'
                      : 'alert-circle-outline'
                  }
                  size={23}
                  color={
                    reinspection?.status === 'completed'
                      ? COLORS.compliant
                      : COLORS.warning
                  }
                />

                <View style={styles.noticeContent}>
                  <Text style={styles.noticeTitle}>
                    {!reinspection
                      ? 'Required'
                      : reinspection.status === 'completed'
                        ? 'Completed'
                        : isReinspectionOverdue(
                            reinspection.scheduledDate,
                            reinspection.status
                          )
                          ? 'Overdue'
                          : 'Scheduled'}
                  </Text>

                  <Text style={styles.noticeText}>
                    {!reinspection
                      ? 'Not yet scheduled'
                      : reinspection.status === 'completed'
                        ? formatLocalDateTime(reinspection.completedAt)
                        : `${isReinspectionOverdue(reinspection.scheduledDate, reinspection.status) ? 'Overdue since' : 'Scheduled for'} ${formatLocalDate(reinspection.scheduledDate)}`}
                  </Text>
                </View>
              </View>

              <View style={styles.reinspectionActions}>
                {!reinspection ? (
                  <AppButton
                    title="Schedule Reinspection"
                    onPress={() => router.push(`/reinspection/${place.id}`)}
                  />
                ) : reinspection.status === 'pending' ? (
                  <>
                    <AppButton
                      title="Change Schedule"
                      variant="outline"
                      onPress={() =>
                        router.push(`/reinspection/${reinspection.id}`)
                      }
                    />
                    <AppButton
                      title="Conduct Reinspection"
                      onPress={() =>
                        router.push({
                          pathname: '/inspection/new',
                          params: {
                            placeId: reinspection.placeId,
                            reinspectionId: reinspection.id,
                            originalInspectionId:
                              reinspection.originalInspectionId,
                          },
                        })
                      }
                    />
                  </>
                ) : reinspection.completedInspectionId ? (
                  <AppButton
                    title="View Reinspection"
                    variant="outline"
                    onPress={() => {
                      const completedInspectionId =
                        reinspection.completedInspectionId;

                      if (!completedInspectionId) {
                        return;
                      }

                      router.push({
                        pathname: '/inspection/[id]',
                        params: {
                          id: completedInspectionId,
                        },
                      });
                    }}
                  />
                ) : null}
              </View>
            </View>
          </View>
        )}

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
          ) : historyError && inspectionHistory.length === 0 ? (
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
              {historyError ? (
                <View style={styles.historyWarning}>
                  <Ionicons
                    name="cloud-offline-outline"
                    size={18}
                    color={COLORS.warning}
                  />
                  <Text style={styles.historyWarningText}>
                    Showing records available on this device. Refresh again when connected.
                  </Text>
                </View>
              ) : null}
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
                  inspectionType={getInspectionTypeLabel(
                    inspection,
                    inspectionHistory
                  )}
                  onPress={() =>
                    router.push({
                      pathname: '/inspection/[id]',
                      params: { id: inspection.id },
                    })
                  }
                />
              ))}
            </View>
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

function PlaceFact({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.placeFact, !last && styles.placeFactBorder]}>
      <Text style={styles.placeFactLabel}>{label}</Text>
      <Text style={styles.placeFactValue}>{value || 'Not recorded'}</Text>
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
  inspection: InspectionHistoryItem;
  originalInspection?: InspectionHistoryItem;
  followUpInspection?: InspectionHistoryItem;
  inspectionType: string;
  onPress: () => void;
};

function InspectionHistoryCard({
  inspection,
  originalInspection,
  followUpInspection,
  inspectionType,
  onPress,
}: InspectionHistoryCardProps) {
  const isReinspection = isLinkedReinspection(inspection);
  const result = getInspectionResultDetails(
    inspection.result
  );
  const findingCount = 'findingCount' in inspection
    ? inspection.findingCount
    : inspection.findings.length;
  const findingLabel =
    findingCount === 1
      ? '1 finding'
      : `${findingCount} findings`;

  let relationship: string | undefined;

  if (isReinspection) {
    relationship = originalInspection
      ? `Follow-up to ${formatLocalDateTime(
          originalInspection.inspectionDate
        )}`
      : 'Linked follow-up inspection';
  } else if (followUpInspection) {
    relationship = `Follow-up completed ${formatLocalDateTime(
      followUpInspection.inspectionDate
    )}`;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View ${inspectionType.toLowerCase()} details`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.historyCard,
        pressed && styles.pressed,
      ]}
    >
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
            {inspectionType}
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
          {formatLocalDateTime(inspection.inspectionDate)}
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
    </Pressable>
  );
}

function formatSyncStatus(status: InspectionHistoryItem['syncStatus']) {
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
    ...TYPOGRAPHY.heading,
    color: COLORS.text,
  },

  headerSubtitle: {
    ...TYPOGRAPHY.caption,
    marginTop: 2,
    color: COLORS.textSecondary,
  },

  content: {
    width: '100%',
    maxWidth: 700,
    alignSelf: 'center',
    padding: SPACING.lg,
    paddingBottom: 40,
    gap: SPACING.lg,
  },

  profileCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
  },

  placeHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  placeHeadingCopy: { flex: 1, minWidth: 0 },

  placeIcon: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primarySoft,
  },

  placeName: {
    ...TYPOGRAPHY.heading,
    fontSize: 21,
    color: COLORS.text,
  },

  placeType: {
    ...TYPOGRAPHY.bodySmall,
    marginTop: 4,
    color: COLORS.textSecondary,
  },

  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
    ...TYPOGRAPHY.label,
    fontSize: 12,
    color: COLORS.primary,
  },

  riskText: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    color: COLORS.textSecondary,
  },

  sectionTitle: {
    ...TYPOGRAPHY.subheading,
    marginBottom: SPACING.sm,
    fontSize: 16,
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
    width: 32,
    height: 32,
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
  historyWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.warningSoft,
  },
  historyWarningText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.text,
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
    borderRadius: RADIUS.xl,
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

  placeFacts: { marginTop: SPACING.lg, borderTopWidth: 1, borderTopColor: COLORS.divider },
  correctiveProgress: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md, borderLeftWidth: 3, borderLeftColor: COLORS.primary, backgroundColor: COLORS.primarySoft, borderRadius: RADIUS.md },
  correctiveProgressMark: { width: 34, height: 34, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface },
  correctiveProgressCopy: { flex: 1, gap: 3 },
  correctiveProgressTitle: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text },
  correctiveProgressText: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, lineHeight: 17 },
  completionCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md, borderRadius: RADIUS.xl, backgroundColor: COLORS.warningSoft, borderWidth: 1, borderColor: '#EBD8A7' },
  completionIcon: { width: 44, height: 44, borderRadius: RADIUS.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface },
  completionCopy: { flex: 1 }, completionTitle: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text }, completionText: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginTop: 2 },
  completionAction: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.sm }, completionActionText: { ...TYPOGRAPHY.caption, fontWeight: '800', color: COLORS.warningDark },
  placeFact: { paddingVertical: SPACING.md },
  placeFactBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  placeFactLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted },
  placeFactValue: { marginTop: 3, fontSize: 14, lineHeight: 20, fontWeight: '600', color: COLORS.text },

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

  reinspectionStatusCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
  },

  reinspectionStatusHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
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

  reinspectionActions: {
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },

  actions: {
    gap: SPACING.sm,
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
