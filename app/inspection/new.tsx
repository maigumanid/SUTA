import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import AppButton from '@/components/common/AppButton';
import InspectionProgress from '@/components/inspection/InspectionProgress';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { createInitialHouseholdInspection } from '@/constants/householdInspection';
import { useAuth } from '@/context/AuthContext';
import { useInspection } from '@/context/InspectionContext';
import { useNetwork } from '@/context/NetworkContext';
import { usePlaces } from '@/context/PlacesContext';
import { fetchStoredInspectionById } from '@/services/inspectionHistoryService';
import { getStoredInspectionById, type StoredInspection } from '@/storage/inspectionStorage';
import { getCachedInspectionById } from '@/storage/inspectionHistoryCache';
import type { InspectionFinding } from '@/types/householdInspection';
import { isSupportedPlaceType } from '@/types/place';
import { formatPurok } from '@/utils/placeDisplay';
import {
  captureInspectionLocation,
  InspectionLocationResult,
} from '@/services/locationService';

export default function NewInspectionScreen() {
  const { profile } = useAuth();
  const { isOnline } = useNetwork();
  const { getPlaceById } = usePlaces();
  const {
    placeId,
    tour,
    reinspectionId,
    originalInspectionId,
  } = useLocalSearchParams<{
    placeId?: string;
    tour?: string;
    reinspectionId?: string;
    originalInspectionId?: string;
  }>();

  const { draftInspection, setDraftInspection } =
    useInspection();

  const [isCapturingLocation, setIsCapturingLocation] =
    useState(false);
  const [capturedLocation] =
    useState<InspectionLocationResult | null>(() => {
      const draft = draftInspection;

      if (
        !draft ||
        draft.placeId !== placeId ||
        draft.reinspectionId !== reinspectionId ||
        draft.reinspectionOfInspectionId !==
          originalInspectionId ||
        draft.locationCaptureStatus !== 'captured' ||
        !draft.inspectionLocation
      ) {
        return null;
      }

      return {
        status: 'captured',
        attemptedAt:
          draft.locationCaptureAttemptedAt ??
          draft.inspectionLocation.capturedAt,
        location: draft.inspectionLocation,
      };
    });
  const [locationFailure, setLocationFailure] =
    useState<InspectionLocationResult | null>(null);
  const [correctiveSource, setCorrectiveSource] = useState<StoredInspection | null>(null);
  const [loadingCorrectiveSource, setLoadingCorrectiveSource] = useState(Boolean(originalInspectionId));
  const [correctiveSourceError, setCorrectiveSourceError] = useState('');

  useEffect(() => {
    if (!originalInspectionId || !profile) {
      setCorrectiveSource(null);
      setCorrectiveSourceError('');
      setLoadingCorrectiveSource(false);
      return;
    }
    let active = true;
    const scope = { bsiUid: profile.uid, barangayId: profile.assignedBarangayId };
    void (async () => {
      setLoadingCorrectiveSource(true);
      setCorrectiveSourceError('');
      try {
        let source = await getStoredInspectionById(originalInspectionId, scope);
        if (!source) source = await getCachedInspectionById(originalInspectionId, scope);
        if (!source && isOnline !== false) source = await fetchStoredInspectionById(originalInspectionId, scope);
        if (!source) throw new Error('The original inspection is not available on this device. Reconnect to load its findings.');
        if (!active) return;
        setCorrectiveSource(source);
        const linkedFindings: InspectionFinding[] = source.findings.map((finding) => ({
          id: `followup_${source!.id}_${finding.id}`,
          category: finding.category,
          details: finding.details,
          evidence: [],
          correctiveAction: {
            originalInspectionId: source!.id,
            originalFindingId: finding.id,
            status: 'Unresolved',
          },
        }));
        setDraftInspection((current) => {
          if (!current) {
            return current;
          }
          if (
            current.placeId === placeId &&
            current.reinspectionId === reinspectionId &&
            current.reinspectionOfInspectionId === originalInspectionId
          ) {
            const existingLinks = new Set(current.findings.flatMap((finding) => finding.correctiveAction ? [`${finding.correctiveAction.originalInspectionId}:${finding.correctiveAction.originalFindingId}`] : []));
            return { ...current, findings: [...current.findings, ...linkedFindings.filter((finding) => !existingLinks.has(`${finding.correctiveAction!.originalInspectionId}:${finding.correctiveAction!.originalFindingId}`))] };
          }
          return current;
        });
      } catch (error) {
        if (active) setCorrectiveSourceError(error instanceof Error ? error.message : 'Unable to load original findings.');
      } finally {
        if (active) setLoadingCorrectiveSource(false);
      }
    })();
    return () => { active = false; };
  }, [isOnline, originalInspectionId, placeId, profile, reinspectionId, setDraftInspection]);

  const place = placeId
    ? getPlaceById(placeId)
    : undefined;

  if (!place) {
    return (
      <View style={styles.notFound}>
        <Ionicons
          name="alert-circle-outline"
          size={48}
          color={COLORS.textMuted}
        />

        <Text style={styles.notFoundTitle}>
          No place selected
        </Text>

        <Text style={styles.notFoundText}>
          Select a household or other place before starting an inspection.
        </Text>

        <AppButton
          title="Go to Places"
          onPress={() =>
            router.replace('/(tabs)/establishments')
          }
        />
      </View>
    );
  }

  const isHousehold =
    place.placeType === 'Household / Residence';
  const isInspectablePlace = isSupportedPlaceType(place.placeType);
  const linkedFindings: InspectionFinding[] = correctiveSource?.findings.map((finding) => ({
    id: `followup_${correctiveSource.id}_${finding.id}`,
    category: finding.category,
    details: finding.details,
    evidence: [],
    correctiveAction: {
      originalInspectionId: correctiveSource.id,
      originalFindingId: finding.id,
      status: 'Unresolved',
    },
  })) ?? [];

  const openChecklist = (
    result: InspectionLocationResult
  ) => {
    const locationChanges = {
        inspectionLocation: result.location,
        locationCaptureStatus: result.status,
        locationCaptureAttemptedAt:
          result.attemptedAt,
        reinspectionId,
        reinspectionOfInspectionId:
          originalInspectionId,
      };

    const matchesCurrentDraft =
      draftInspection?.placeId === place.id &&
      draftInspection.reinspectionId === reinspectionId &&
      draftInspection.reinspectionOfInspectionId ===
        originalInspectionId;

    setDraftInspection(
      matchesCurrentDraft
        ? {
            ...draftInspection,
            ...locationChanges,
          }
        : {
            ...createInitialHouseholdInspection(place.id, locationChanges),
            findings: linkedFindings,
          }
    );

    requestAnimationFrame(() => {
      router.replace({
        pathname: '/inspection/checklist',
        params: {
          placeId: place.id,
          ...(tour === 'true'
            ? { tour: 'true' }
            : {}),
        },
      });
    });
  };

  const captureCurrentLocation = async () => {
    if (isCapturingLocation) {
      return;
    }

    setLocationFailure(null);
    setIsCapturingLocation(true);

    const result =
      await captureInspectionLocation();

    if (result.status === 'captured') {
      openChecklist(result);
      return;
    }

    setIsCapturingLocation(false);
    setLocationFailure(result);
  };

  const locationFailureMessage = (() => {
    switch (locationFailure?.status) {
      case 'permission_denied':
        return 'Location permission was denied. SUTA will not create or substitute coordinates.';
      case 'services_disabled':
        return 'Location services are disabled. Turn them on and retry to record this inspection location.';
      case 'unavailable':
        return 'The current location could not be obtained. This may be a temporary GPS or device error.';
      default:
        return null;
    }
  })();

  const shouldOpenLocationSettings =
    locationFailure?.status === 'services_disabled' ||
    (locationFailure?.status === 'permission_denied' &&
      locationFailure.canAskAgain === false);

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
            {reinspectionId
              ? 'Reinspection'
              : 'New Inspection'}
          </Text>

          <Text style={styles.headerSubtitle}>
            Confirm the inspection details
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <InspectionProgress currentStep={1} placeName={place.name} />

        <View style={styles.notice}>
          <View style={styles.noticeIcon}>
            <Ionicons
              name="clipboard-outline"
              size={24}
              color={COLORS.primary}
            />
          </View>

          <View style={styles.noticeContent}>
            <Text style={styles.noticeTitle}>
              {reinspectionId
                ? 'Follow-up Sanitary Inspection'
                : 'Sanitary Inspection'}
            </Text>

            <Text style={styles.noticeText}>
              Review the selected place before proceeding to the inspection checklist.
            </Text>
          </View>
        </View>

        <View>
          <Text style={styles.sectionTitle}>
            Selected Place
          </Text>

          <View style={styles.placeCard}>
            <View style={styles.placeHeader}>
              <View style={styles.placeIcon}>
                <Ionicons
                  name={
                    isHousehold
                      ? 'home-outline'
                      : 'business-outline'
                  }
                  size={26}
                  color={COLORS.primary}
                />
              </View>

              <View style={styles.placeHeaderContent}>
                <Text style={styles.placeName}>
                  {place.name}
                </Text>

                <Text style={styles.placeType}>
                  {place.placeType}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <InfoRow
              icon="person-outline"
              label={
                isHousehold
                  ? 'Household Head / Representative'
                  : 'Owner / Representative'
              }
              value={place.representativeName}
            />

            <InfoRow
              icon="location-outline"
              label="Purok"
              value={formatPurok(place.purok)}
            />
          </View>
        </View>

        <View>
          <Text style={styles.sectionTitle}>
            Inspection Location
          </Text>

          <View style={styles.locationCard}>
            <Text style={styles.locationPurpose}>
              Capture your current location to record where this inspection was conducted. This is separate from the registered place address.
            </Text>

            <View style={styles.registeredAddress}>
              <Text style={styles.infoLabel}>
                Registered address
              </Text>
              <Text style={styles.infoValue}>
                {place.address}
              </Text>
            </View>

            {capturedLocation?.status === 'captured' && (
              <View style={styles.locationSuccess}>
                <Ionicons
                  name="checkmark-circle"
                  size={22}
                  color={COLORS.compliant}
                />
                <Text style={styles.locationSuccessText}>
                  Current inspection location captured.
                </Text>
              </View>
            )}

            {locationFailureMessage && (
              <View style={styles.locationFailure}>
                <Ionicons
                  name="alert-circle-outline"
                  size={22}
                  color={COLORS.violation}
                />
                <Text style={styles.locationFailureText}>
                  {locationFailureMessage}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View>
          <Text style={styles.sectionTitle}>
            Before You Begin
          </Text>

          <View style={styles.reminderCard}>
            <ReminderItem
              icon="checkmark-circle-outline"
              text="Confirm that you are inspecting the correct household or place."
            />

            <ReminderItem
              icon="people-outline"
              text="Coordinate with the household head, owner, or representative before inspection."
            />

            <ReminderItem
              icon="navigate-outline"
              text="The captured GPS location records where you were when this inspection was conducted."
            />

            <ReminderItem
              icon="camera-outline"
              text="Photo evidence can be added when violations are found."
            />

            <ReminderItem
              icon="cloud-offline-outline"
              text="Inspection records are saved on this device and synchronize when connectivity is available."
            />
          </View>
        </View>

        {capturedLocation?.status === 'captured' ? (
          <AppButton
            title="Continue to Checklist"
            onPress={() => openChecklist(capturedLocation)}
            disabled={!isInspectablePlace || loadingCorrectiveSource || Boolean(correctiveSourceError)}
          />
        ) : locationFailure ? (
          <View style={styles.locationActions}>
            <AppButton
              title="Retry Location"
              onPress={captureCurrentLocation}
              disabled={!isInspectablePlace}
              loading={isCapturingLocation}
            />
            <AppButton
              title="Continue Without Location"
              variant="outline"
              onPress={() => openChecklist(locationFailure)}
              disabled={!isInspectablePlace || loadingCorrectiveSource || Boolean(correctiveSourceError)}
            />
            {shouldOpenLocationSettings && (
              <AppButton
                title="Open Location Settings"
                variant="outline"
                onPress={() => {
                  void Linking.openSettings();
                }}
              />
            )}
          </View>
        ) : (
          <AppButton
            title="Capture Current Location"
            onPress={captureCurrentLocation}
            disabled={!isInspectablePlace || loadingCorrectiveSource || Boolean(correctiveSourceError)}
            loading={isCapturingLocation}
          />
        )}

        {loadingCorrectiveSource ? <Text style={styles.developmentNote}>Loading original findings for corrective verification…</Text> : null}
        {correctiveSourceError ? <View style={styles.locationFailure}><Ionicons name="alert-circle-outline" size={20} color={COLORS.violation} /><Text style={styles.locationFailureText}>{correctiveSourceError}</Text></View> : null}
        {correctiveSource && correctiveSource.findings.length === 0 ? <Text style={styles.developmentNote}>The linked original inspection contains no findings to verify.</Text> : null}

        {!isInspectablePlace && (
          <Text style={styles.developmentNote}>
            This record has an unsupported place type. Update the place profile before continuing.
          </Text>
        )}

      </ScrollView>
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
      <Ionicons
        name={icon}
        size={19}
        color={COLORS.primary}
      />

      <View style={styles.infoContent}>
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

type ReminderItemProps = {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
};

function ReminderItem({
  icon,
  text,
}: ReminderItemProps) {
  return (
    <View style={styles.reminderItem}>
      <Ionicons
        name={icon}
        size={20}
        color={COLORS.primary}
      />

      <Text style={styles.reminderText}>
        {text}
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
    width: '100%',
    maxWidth: 700,
    alignSelf: 'center',
    padding: SPACING.lg,
    paddingBottom: 40,
    gap: SPACING.lg,
  },

  notice: {
    flexDirection: 'row',
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primarySoft,
  },

  noticeIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
  },

  noticeContent: {
    flex: 1,
  },

  noticeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },

  noticeText: {
    marginTop: 3,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.textSecondary,
  },

  sectionTitle: {
    marginBottom: SPACING.sm,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },

  placeCard: {
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
  },

  placeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  placeIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primarySoft,
  },

  placeHeaderContent: {
    flex: 1,
    marginLeft: SPACING.md,
  },

  placeName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },

  placeType: {
    marginTop: 3,
    fontSize: 13,
    color: COLORS.textSecondary,
  },

  divider: {
    height: 1,
    marginVertical: SPACING.md,
    backgroundColor: COLORS.divider,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },

  infoContent: {
    flex: 1,
  },

  infoLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },

  infoValue: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },

  reminderCard: {
    gap: SPACING.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
  },

  locationCard: {
    gap: SPACING.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
  },

  locationPurpose: {
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.textSecondary,
  },

  registeredAddress: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceMuted,
  },

  locationSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.compliantSoft,
  },

  locationSuccessText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.compliant,
  },

  locationFailure: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.violationSoft,
  },

  locationFailureText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.violation,
  },

  locationActions: {
    gap: SPACING.sm,
  },

  reminderItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },

  reminderText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.textSecondary,
  },

  developmentNote: {
    fontSize: 11,
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

  notFoundText: {
    maxWidth: 300,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },

  pressed: {
    opacity: 0.7,
  },
});
