import { Ionicons } from '@expo/vector-icons';
import {
  router,
  useLocalSearchParams,
} from 'expo-router';
import { useEffect, useState } from 'react';

import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import EvidencePreviewGallery from '@/components/inspection/EvidencePreviewGallery';
import CorrectiveFindingComparison from '@/components/inspection/CorrectiveFindingComparison';
import InspectionProgress from '@/components/inspection/InspectionProgress';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useInspectionSync } from '@/context/InspectionSyncContext';
import { useInspection } from '@/context/InspectionContext';
import { useAuth } from '@/context/AuthContext';
import { usePlaces } from '@/context/PlacesContext';
import { fetchStoredInspectionById } from '@/services/inspectionHistoryService';
import {
  getStoredInspectionById,
  getStoredInspectionsForPlace,
  saveInspectionLocally,
  type StoredInspection,
} from '@/storage/inspectionStorage';
import { getCachedInspectionById } from '@/storage/inspectionHistoryCache';
import { completeReinspection } from '@/storage/reinspectionStorage';
import {
  getInspectionSyncErrorMessage,
} from '@/services/inspectionSyncService';
import { formatLocalDate, formatLocalDateTime } from '@/utils/dateTime';
import { getInspectionTypeLabel } from '@/utils/inspectionDisplay';
import { formatPurok } from '@/utils/placeDisplay';
import { getNetworkAvailability } from '@/utils/networkState';
import { calculateInspectionRisk, getRiskClassification } from '@/utils/riskClassification';

export default function InspectionSummaryScreen() {
  const { profile, isProfileValidated } = useAuth();
  const { getPlaceById } = usePlaces();
  const { isOnline, retryInspection } = useInspectionSync();
  const { tour } = useLocalSearchParams<{
    tour?: string;
  }>();

  const isTourActive = tour === 'true';

  const {
    draftInspection,
    clearDraftInspection,
  } = useInspection();

  const [isSaving, setIsSaving] = useState(false);
  const [placeHistory, setPlaceHistory] =
    useState<StoredInspection[]>([]);
  const [originalInspections, setOriginalInspections] = useState<
    Record<string, StoredInspection>
  >({});
  const [isLoadingOriginalEvidence, setIsLoadingOriginalEvidence] =
    useState(false);

  const place = draftInspection
    ? getPlaceById(draftInspection.placeId)
    : undefined;
  const risk = draftInspection ? calculateInspectionRisk(draftInspection) : null;

  useEffect(() => {
    if (!draftInspection || !profile) {
      setPlaceHistory([]);
      setOriginalInspections({});
      setIsLoadingOriginalEvidence(false);
      return;
    }
    let active = true;
    const scope = {
      bsiUid: profile.uid,
      barangayId: profile.assignedBarangayId,
    };
    const originalIds = [...new Set(
      draftInspection.findings.flatMap((finding) =>
        finding.correctiveAction
          ? [finding.correctiveAction.originalInspectionId]
          : []
      )
    )];

    void (async () => {
      setIsLoadingOriginalEvidence(originalIds.length > 0);
      try {
        const localHistory = await getStoredInspectionsForPlace(
          draftInspection.placeId,
          scope
        );
        if (!active) return;
        setPlaceHistory(localHistory);

        const originals = await Promise.all(
          originalIds.map(async (originalId) => {
            try {
              let original = localHistory.find((record) => record.id === originalId)
                ?? await getStoredInspectionById(originalId, scope)
                ?? await getCachedInspectionById(originalId, scope);
              if (!original && isOnline !== false) {
                original = await fetchStoredInspectionById(originalId, scope);
              }
              return original ? ([originalId, original] as const) : null;
            } catch (error) {
              console.warn(`Unable to load original inspection ${originalId}:`, error);
              return null;
            }
          })
        );
        if (active) {
          setOriginalInspections(
            Object.fromEntries(
              originals.filter(
                (entry): entry is readonly [string, StoredInspection] => entry !== null
              )
            )
          );
        }
      } catch (error) {
        console.warn('Unable to load linked original evidence for review:', error);
        if (active) setOriginalInspections({});
      } finally {
        if (active) setIsLoadingOriginalEvidence(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [draftInspection, isOnline, profile]);

  const resetInspectionFlowTo = (
    pathname: '/place/[id]' | '/(tabs)/sync',
    placeId?: string
  ) => {
    router.dismissAll();

    requestAnimationFrame(() => {
      router.replace('/(tabs)/establishments');
      requestAnimationFrame(() => {
        if (pathname === '/place/[id]' && placeId) {
          router.push({
            pathname,
            params: { id: placeId },
          });
          return;
        }

        router.push('/(tabs)/sync');
      });
    });
  };

  const yesNo = (value?: boolean) => {
    if (value === undefined) {
      return 'Not recorded';
    }

    return value ? 'Yes' : 'No';
  };

  const binaryYesNo = (value?: 1 | 0) => {
    if (value === undefined) {
      return 'Not determined';
    }

    return value === 1 ? 'Yes' : 'No';
  };

  const getWaterSource = () => {
    if (!draftInspection) {
      return 'Not recorded';
    }

    const water =
      draftInspection.safeWaterSupply;

    switch (water.waterSourceType) {
      case 'level_1':
        return 'Level I — Point source';

      case 'level_2':
        return 'Level II — Communal faucet system or stand posts';

      case 'level_3':
        return 'Level III — Waterworks system or individual house connection';

      case 'others':
        return water.otherWaterSource
          ? `Others — ${water.otherWaterSource}`
          : 'Others';

      default:
        return 'Not recorded';
    }
  };

  const getSanitationFacility = () => {
    if (!draftInspection) {
      return 'Not recorded';
    }

    const sanitation =
      draftInspection.sanitationFacility;

    if (sanitation.sanitaryFacilityType) {
      switch (
        sanitation.sanitaryFacilityType
      ) {
        case 'septic_tank':
          return 'Pour/Flush connected to septic tank';

        case 'sewer_system':
          return 'Pour/Flush connected to sewer/sewage system';

        case 'vip_or_composting':
          return 'VIP Latrine or Composting Toilet';
      }
    }

    switch (
      sanitation.unsanitaryToiletType
    ) {
      case 3:
        return 'Water sealed connected to open drain';

      case 2:
        return 'Overhung latrine';

      case 1:
        return 'Open pit latrine';

      case 0:
        return 'Without toilet';

      default:
        return 'Not recorded';
    }
  };

  const getDisposalMethod = () => {
    if (!draftInspection) {
      return 'Not recorded';
    }

    const method =
      draftInspection.sanitationFacility
        .excretaDisposalMethod;

    switch (method) {
      case 'onsite_treatment':
        return 'Stored in containment and treated';

      case 'offsite_dislodging':
        return 'Dislodged, transported and treated/disposed off-site';

      case 'sewer_or_offsite_treatment':
        return 'Conveyed through sewer/sewerage and treated off-site';

      default:
        return 'Not recorded';
    }
  };

  const getInspectionResult = () => {
    switch (draftInspection?.result) {
      case 'compliant':
        return 'Compliant';
      case 'non_compliant':
        return 'Non-Compliant';
      case 'for_reinspection':
        return 'For Reinspection';
      default:
        return 'Not selected';
    }
  };

  const getFindingCategory = (
    category:
      | 'safe_water_supply'
      | 'sanitation'
      | 'other'
  ) => {
    switch (category) {
      case 'safe_water_supply':
        return 'Safe Water Supply';
      case 'sanitation':
        return 'Sanitation';
      default:
        return 'Other';
    }
  };

  const handleSave = async () => {
    console.log('SAVE BUTTON PRESSED');

    if (!draftInspection || !profile) {
      console.log('NO DRAFT INSPECTION');

      Alert.alert(
        'No Inspection',
        'There is no inspection available to save.'
      );

      return;
    }

    if (isSaving) {
      return;
    }

    try {
      setIsSaving(true);

      console.log(
        'DRAFT INSPECTION:',
        draftInspection
      );

      const scope = {
        bsiUid: profile.uid,
        barangayId: profile.assignedBarangayId,
      };
      const saved = await saveInspectionLocally({
        ...draftInspection,
        ...scope,
      });

      if (draftInspection.reinspectionId) {
        await completeReinspection(
          draftInspection.reinspectionId,
          saved.id,
          scope
        );
      }

      let synced = false;
      let savedOffline = false;
      let syncError: unknown;
      const networkAvailable = await getNetworkAvailability();

      if (networkAvailable === false || !isProfileValidated) {
        savedOffline = true;
      } else {
        try {
          await retryInspection(saved.id);
          synced = true;
        } catch (error) {
          syncError = error;
          savedOffline = (await getNetworkAvailability()) === false;
        }
      }

      console.log(
        'SAVED INSPECTION:',
        saved
      );

      Alert.alert(
        synced
          ? 'Inspection Saved'
          : savedOffline
            ? 'Saved on device'
            : 'Synchronization Failed',
        synced
          ? 'The inspection was saved and synchronized.'
          : savedOffline
            ? 'This inspection is stored locally and will sync automatically when an internet connection is available.'
            : getInspectionSyncErrorMessage(syncError),
        [
          {
            text: 'OK',
            onPress: () => {
              clearDraftInspection();

              if (synced) {
                resetInspectionFlowTo(
                  '/place/[id]',
                  saved.placeId
                );
                return;
              }

              resetInspectionFlowTo('/(tabs)/sync');
            },
          },
        ],
        {
          cancelable: false,
        }
      );
    } catch {
      Alert.alert(
        'Save Failed',
        'The inspection could not be saved. Please try again.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (!draftInspection) {
    return (
      <View style={styles.centerContainer}>
        <View style={styles.emptyIcon}>
          <Ionicons
            name="document-text-outline"
            size={40}
            color="#075E5A"
          />
        </View>

        <Text style={styles.emptyTitle}>
          No Inspection Found
        </Text>

        <Text style={styles.emptyText}>
          No inspection data was passed to
          this review page.
        </Text>

        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.primaryButtonText}>
            Go Back
          </Text>
        </Pressable>
      </View>
    );
  }

  const water =
    draftInspection.safeWaterSupply;

  const sanitation =
    draftInspection.sanitationFacility;

  const location =
    draftInspection.inspectionLocation;
  const evidenceCount = draftInspection.findings.reduce(
    (total, finding) => total + finding.evidence.length,
    0
  );

  const locationStatus = (() => {
    if (location) {
      return `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
    }

    switch (
      draftInspection.locationCaptureStatus
    ) {
      case 'permission_denied':
        return 'Not captured — permission denied';
      case 'services_disabled':
        return 'Not captured — location services disabled';
      case 'unavailable':
        return 'Not captured — location unavailable';
      default:
        return 'Not captured';
    }
  })();

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          disabled={isSaving}
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name="arrow-back"
            size={23}
            color="#17211F"
          />
        </Pressable>

        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>
            Review Inspection
          </Text>

          <Text style={styles.headerSubtitle}>
            Check the information before saving
          </Text>
        </View>

        <View style={styles.headerIcon}>
          <Ionicons
            name="clipboard-outline"
            size={22}
            color="#075E5A"
          />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <InspectionProgress currentStep={5} placeName={place?.name} />

        <View style={styles.infoCard}>
          <Ionicons
            name="information-circle-outline"
            size={22}
            color="#3D6F82"
          />

          <Text style={styles.infoText}>
            {isTourActive
              ? 'Final step of the guided tour. Review the inspection information below, then confirm and save the inspection.'
              : 'Review the household inspection information below. You can return to the checklist if something needs to be corrected.'}
          </Text>
        </View>

        <Section
          icon="calendar-outline"
          title="Place & Inspection"
        >
          <ReviewRow
            label="Inspection Date"
            value={formatLocalDateTime(
              draftInspection.inspectionDate,
              'Not recorded'
            )}
          />

          <ReviewRow
            label="Place"
            value={place?.name ?? 'Place not available'}
          />

          {place ? (
            <>
              <ReviewRow label="Household Representative" value={place.representativeName} />
              <ReviewRow label="Location" value={`${formatPurok(place.purok)} · ${place.barangay ?? profile?.assignedBarangay ?? 'Assigned barangay'}`} />
              <ReviewRow label="Address" value={place.address} />
            </>
          ) : null}

          <ReviewRow
            label="Inspection Type"
            value={getInspectionTypeLabel(
              draftInspection,
              placeHistory
            )}
          />

          {draftInspection.reinspectionOfInspectionId && (
            <ReviewRow
              label="Relationship"
              value="Linked follow-up to the original inspection"
            />
          )}

          <ReviewRow
            label="Inspection Location"
            value={locationStatus}
          />

          <ReviewRow
            label="Location Accuracy"
            value={
              location?.accuracy !== undefined
                ? `${Math.round(location.accuracy)} meters`
                : 'Not available'
            }
          />

          <ReviewRow
            label="Location Captured"
            value={formatLocalDateTime(
              location?.capturedAt,
              'Not recorded'
            )}
            last
          />
        </Section>

        <Section
          icon="water-outline"
          title="Safe Water Supply"
        >
          <ReviewRow
            label="Water Source"
            value={getWaterSource()}
          />

          <ReviewRow
            label="Located Within Premises"
            value={yesNo(
              water.locatedWithinPremises
            )}
          />

          <ReviewRow
            label="Available at Least 12 Hours"
            value={yesNo(
              water.availableAtLeast12Hours
            )}
          />

          <ReviewRow
            label="SMDWS"
            value={binaryYesNo(
              water.smdwsStatus
            )}
            last
          />
        </Section>

        <Section
          icon="home-outline"
          title="Sanitation Facility"
        >
          <ReviewRow
            label="Facility Type"
            value={getSanitationFacility()}
          />

          {sanitation.sanitaryFacilityType && (
            <>
              <ReviewRow
                label="Shared with Other Households"
                value={binaryYesNo(
                  sanitation
                    .sharedWithOtherHouseholds
                )}
              />

              <ReviewRow
                label="Basic Sanitation Facility"
                value={binaryYesNo(
                  sanitation
                    .basicSanitationFacility
                )}
              />

              <ReviewRow
                label="Disposal / Treatment"
                value={getDisposalMethod()}
              />
            </>
          )}

          <ReviewRow
            label="SMSS"
            value={binaryYesNo(
              sanitation.smssStatus
            )}
            last
          />
        </Section>

        <Section icon="flask-outline" title="Laboratory Testing" optional>
          <Text style={styles.reviewGroupLabel}>MICROBIAL</Text>
          <ReviewRow label="Test Performed" value={water.microbialTest.recorded ? 'Yes' : 'No'} />
          {water.microbialTest.recorded ? (
            <>
              <ReviewRow label="Testing Date" value={formatLocalDate(water.microbialTest.dateValidationDone, 'Not recorded')} />
              <ReviewRow label="Result" value={water.microbialTest.eColiResult === 1 ? 'Presence of E. coli' : water.microbialTest.eColiResult === 0 ? 'Absence of E. coli' : 'Not recorded'} />
            </>
          ) : null}

          <Text style={styles.reviewGroupLabel}>ARSENIC</Text>
          <ReviewRow label="Test Performed" value={water.arsenicTest.conducted ? 'Yes' : 'No'} last={!water.arsenicTest.conducted} />
          {water.arsenicTest.conducted ? (
            <>
              <ReviewRow label="Testing Date" value={formatLocalDate(water.arsenicTest.dateTestingDone, 'Not recorded')} />
              <ReviewRow label="Result" value={water.arsenicTest.result === 1 ? 'Within allowable PNSDW limit' : water.arsenicTest.result === 0 ? 'Above allowable PNSDW limit' : 'Not recorded'} last />
            </>
          ) : null}
        </Section>

        <Section
          icon="alert-circle-outline"
          title="Findings"
        >
          {draftInspection.findings.length === 0 ? (
            <Text style={styles.notRecorded}>
              No findings recorded.
            </Text>
          ) : (
            draftInspection.findings.map((finding, index) => {
              if (finding.correctiveAction) {
                const original = originalInspections[
                  finding.correctiveAction.originalInspectionId
                ];
                const originalFinding = original?.findings.find(
                  (candidate) =>
                    candidate.id === finding.correctiveAction?.originalFindingId
                );

                return (
                  <CorrectiveFindingComparison
                    key={finding.id}
                    afterEvidence={finding.evidence}
                    beforeEvidence={originalFinding?.evidence ?? []}
                    beforeLoading={isLoadingOriginalEvidence}
                    beforeUnavailable={!isLoadingOriginalEvidence && !original}
                    category={getFindingCategory(finding.category)}
                    divided={index > 0}
                    findingNumber={index + 1}
                    originalDescription={originalFinding?.details ?? finding.details}
                    status={finding.correctiveAction.status}
                    verificationNote={finding.correctiveAction.verificationNote}
                  />
                );
              }

              return (
                <View
                  key={finding.id}
                  style={[
                    styles.findingReview,
                    index !== draftInspection.findings.length - 1 &&
                      styles.reviewRowBorder,
                  ]}
                >
                  <Text style={styles.reviewLabel}>
                    {`Finding ${index + 1} — ${getFindingCategory(finding.category)}`}
                  </Text>
                  <Text style={styles.reviewValue}>
                    {finding.details}
                  </Text>
                  <EvidencePreviewGallery evidence={finding.evidence} />
                </View>
              );
            })
          )}
        </Section>

        {!draftInspection.findings.some((finding) => finding.correctiveAction) ? (
          <Section icon="images-outline" title="Evidence" optional>
            <ReviewRow label="Photo Evidence" value={`${evidenceCount} ${evidenceCount === 1 ? 'photo' : 'photos'} attached to findings`} last />
          </Section>
        ) : null}

        <Section
          icon="document-text-outline"
          title="Remarks"
          optional
        >
          <Text
            style={
              draftInspection.remarks.trim()
                ? styles.remarksText
                : styles.notRecorded
            }
          >
            {draftInspection.remarks.trim() ||
              'No remarks recorded.'}
          </Text>
        </Section>

        <Section icon="shield-checkmark-outline" title="Result & Risk">
          <ReviewRow label="Result" value={getInspectionResult()} />
          <ReviewRow
            label="Risk Level"
            value={risk ? `${getRiskClassification(risk.level).label}${risk.percentage === null ? '' : ` (${Math.round(risk.percentage)}%)`}` : 'Not yet classified'}
            last={!(draftInspection.reinspectionId || draftInspection.reinspectionOfInspectionId || draftInspection.result === 'for_reinspection')}
          />
          {draftInspection.reinspectionId || draftInspection.reinspectionOfInspectionId || draftInspection.result === 'for_reinspection' ? (
            <ReviewRow
              label="Reinspection"
              value={draftInspection.reinspectionId ? 'Scheduled follow-up inspection in progress' : draftInspection.reinspectionOfInspectionId ? 'Linked to the original inspection' : 'Reinspection required'}
              last
            />
          ) : null}
        </Section>

        <Pressable
          disabled={isSaving}
          onPress={handleSave}
          style={({ pressed }) => [
            styles.saveButton,
            isSaving &&
              styles.disabledButton,
            pressed &&
              !isSaving &&
              styles.saveButtonPressed,
          ]}
        >
          <Ionicons
            name={
              isSaving
                ? 'hourglass-outline'
                : 'save-outline'
            }
            size={21}
            color="#FFFFFF"
          />

          <Text style={styles.saveButtonText}>
            {isSaving
              ? 'Saving Inspection...'
              : isTourActive
                ? 'Finish Tour & Save Inspection'
                : 'Confirm & Save Inspection'}
          </Text>
        </Pressable>

        <Pressable
          disabled={isSaving}
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.editButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name="create-outline"
            size={18}
            color="#075E5A"
          />

          <Text style={styles.editButtonText}>
            Back to Edit Checklist
          </Text>
        </Pressable>

        <View
          style={[
            styles.offlineCard,
            isOnline === false && styles.offlineCardActive,
          ]}
        >
          <Ionicons
            name="cloud-offline-outline"
            size={20}
            color="#786451"
          />

          <Text style={styles.offlineText}>
            {isOnline === false
              ? 'You are offline. Saving will keep this inspection on the device and it will sync automatically when connectivity returns.'
              : 'If a connection is unavailable, this inspection will remain safely stored on the device until automatic synchronization can run.'}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Section({
  icon,
  title,
  optional,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>
          <Ionicons
            name={icon}
            size={20}
            color="#075E5A"
          />
        </View>

        <View>
          <Text style={styles.sectionTitle}>
            {title}
          </Text>

          {optional && (
            <Text style={styles.optional}>
              Optional
            </Text>
          )}
        </View>
      </View>

      <View style={styles.sectionContent}>
        {children}
      </View>
    </View>
  );
}

function ReviewRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View
      style={[
        styles.reviewRow,
        !last && styles.reviewRowBorder,
      ]}
    >
      <Text style={styles.reviewLabel}>
        {label}
      </Text>

      <Text style={styles.reviewValue}>
        {value}
      </Text>
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
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },

  backButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: COLORS.primarySoft,
  },

  headerTextContainer: {
    flex: 1,
  },

  headerTitle: {
    ...TYPOGRAPHY.heading,
    fontSize: 19,
    color: COLORS.text,
  },

  headerSubtitle: {
    ...TYPOGRAPHY.tiny,
    marginTop: 2,
    color: COLORS.textSecondary,
  },

  headerIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    backgroundColor: COLORS.primarySoft,
  },

  content: {
    width: '100%',
    maxWidth: 700,
    alignSelf: 'center',
    padding: SPACING.lg,
    paddingBottom: 60,
    gap: 16,
  },

  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: COLORS.primarySoft,
  },

  infoText: {
    ...TYPOGRAPHY.caption,
    flex: 1,
    lineHeight: 18,
    color: COLORS.textSecondary,
  },

  section: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.surface,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },

  sectionIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
    backgroundColor: COLORS.primarySoft,
  },

  sectionTitle: {
    ...TYPOGRAPHY.bodyMedium,
    fontSize: 14,
    color: COLORS.text,
  },

  optional: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '700',
    color: '#89918F',
  },

  sectionContent: {
    paddingHorizontal: 14,
  },

  reviewRow: {
    paddingVertical: 13,
  },

  findingReview: {
    paddingVertical: 13,
  },

  reviewRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },

  reviewLabel: {
    ...TYPOGRAPHY.tiny,
    marginBottom: 4,
    color: COLORS.textMuted,
  },

  reviewValue: {
    ...TYPOGRAPHY.caption,
    lineHeight: 19,
    color: COLORS.text,
  },

  notRecorded: {
    paddingVertical: 15,
    fontSize: 12,
    fontStyle: 'italic',
    color: '#89918F',
  },

  remarksText: {
    paddingVertical: 15,
    fontSize: 13,
    lineHeight: 20,
    color: '#17211F',
  },

  saveButton: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderRadius: 14,
    backgroundColor: '#075E5A',
  },

  saveButtonPressed: {
    opacity: 0.7,
  },

  disabledButton: {
    opacity: 0.55,
  },

  saveButtonText: {
    ...TYPOGRAPHY.button,
    fontSize: 14,
    color: COLORS.white,
  },

  editButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },

  editButtonText: {
    ...TYPOGRAPHY.label,
    color: COLORS.primary,
  },

  offlineCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    padding: 13,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },

  reviewGroupLabel: {
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xs,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: COLORS.primary,
  },

  offlineCardActive: {
    backgroundColor: '#F1ECE5',
  },

  offlineText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 17,
    color: '#786451',
  },

  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F4F3EE',
  },

  emptyIcon: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 38,
    backgroundColor: '#EEF7F5',
  },

  emptyTitle: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: '800',
    color: '#17211F',
  },

  emptyText: {
    marginTop: 8,
    marginBottom: 20,
    maxWidth: 300,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 20,
    color: '#5F6B68',
  },

  primaryButton: {
    minWidth: 160,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#075E5A',
  },

  primaryButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  pressed: {
    opacity: 0.65,
  },
});
