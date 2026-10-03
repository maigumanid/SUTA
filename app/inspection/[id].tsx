import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import AppButton from '@/components/common/AppButton';
import EvidencePreviewGallery from '@/components/inspection/EvidencePreviewGallery';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { usePlaces } from '@/context/PlacesContext';
import {
  getStoredInspectionById,
  getStoredInspectionsForPlace,
  type StoredInspection,
} from '@/storage/inspectionStorage';
import { formatLocalDate, formatLocalDateTime } from '@/utils/dateTime';
import {
  getInspectionResultLabel,
  getInspectionTypeLabel,
} from '@/utils/inspectionDisplay';

export default function InspectionDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const { getPlaceById } = usePlaces();
  const [inspection, setInspection] =
    useState<StoredInspection | null>(null);
  const [placeHistory, setPlaceHistory] =
    useState<StoredInspection[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;

    setIsLoading(true);
    const scope = {
      bsiUid: profile.uid,
      barangayId: profile.assignedBarangayId,
    };
    const record = await getStoredInspectionById(id, scope);
    const history = record
      ? await getStoredInspectionsForPlace(record.placeId, scope)
      : [];
    setInspection(record);
    setPlaceHistory(history);
    setIsLoading(false);
  }, [id, profile]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)/establishments');
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.secondary}>Loading inspection...</Text>
      </View>
    );
  }

  if (!inspection) {
    return (
      <View style={styles.center}>
        <Ionicons name="document-outline" size={48} color={COLORS.textMuted} />
        <Text style={styles.emptyTitle}>Inspection not available</Text>
        <Text style={styles.emptyText}>
          This local inspection record could not be found on this device.
        </Text>
        <AppButton title="Back to Places" onPress={goBack} />
      </View>
    );
  }

  const place = getPlaceById(inspection.placeId);
  const water = inspection.safeWaterSupply;
  const sanitation = inspection.sanitationFacility;
  const inspectionType = getInspectionTypeLabel(inspection, placeHistory);
  const relationship = inspection.reinspectionOfInspectionId
    ? 'Follow-up linked to an earlier inspection'
    : placeHistory.some(
        (candidate) =>
          candidate.reinspectionOfInspectionId === inspection.id
      )
      ? 'A completed follow-up is linked to this inspection'
      : 'No linked follow-up';

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={goBack}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="arrow-back" size={23} color={COLORS.text} />
        </Pressable>
        <View style={styles.flex}>
          <Text style={styles.title}>Inspection Details</Text>
          <Text style={styles.secondary}>Read-only saved record</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Section title="Overview" icon="clipboard-outline">
          <DetailRow label="Place" value={place?.name ?? 'Place not available'} />
          <DetailRow label="Inspection Type" value={inspectionType} />
          <DetailRow
            label="Inspection Date"
            value={formatLocalDateTime(inspection.inspectionDate)}
          />
          <DetailRow
            label="Result"
            value={getInspectionResultLabel(inspection.result)}
          />
          <DetailRow label="Relationship" value={relationship} />
          <DetailRow label="Sync Status" value={formatSyncStatus(inspection)} last />
        </Section>

        <Section title="Location" icon="location-outline">
          <DetailRow
            label="Capture Status"
            value={formatLocationStatus(inspection.locationCaptureStatus)}
          />
          <DetailRow
            label="Coordinates"
            value={
              inspection.inspectionLocation
                ? `${inspection.inspectionLocation.latitude.toFixed(6)}, ${inspection.inspectionLocation.longitude.toFixed(6)}`
                : 'Not captured'
            }
          />
          <DetailRow
            label="Captured"
            value={formatLocalDateTime(
              inspection.inspectionLocation?.capturedAt,
              'Not captured'
            )}
          />
          <DetailRow
            label="Accuracy"
            value={
              inspection.inspectionLocation?.accuracy !== undefined
                ? `${Math.round(inspection.inspectionLocation.accuracy)} meters`
                : 'Not available'
            }
            last
          />
        </Section>

        <Section title="Safe Water Supply" icon="water-outline">
          <DetailRow label="Water Source" value={formatWaterSource(inspection)} />
          <DetailRow
            label="Within Premises"
            value={formatBoolean(water.locatedWithinPremises)}
          />
          <DetailRow
            label="Available at Least 12 Hours"
            value={formatBoolean(water.availableAtLeast12Hours)}
          />
          <DetailRow label="SMDWS" value={formatBinary(water.smdwsStatus)} />
          <DetailRow
            label="Microbial Test"
            value={water.microbialTest.recorded ? 'Recorded' : 'Not recorded'}
          />
          <DetailRow
            label="Microbial Test Date"
            value={formatLocalDate(
              water.microbialTest.dateValidationDone,
              'Not recorded'
            )}
          />
          <DetailRow
            label="E. coli Result"
            value={formatBinary(
              water.microbialTest.eColiResult,
              'Presence detected',
              'No presence detected'
            )}
          />
          <DetailRow
            label="Arsenic Test"
            value={water.arsenicTest.conducted ? 'Conducted' : 'Not conducted'}
          />
          <DetailRow
            label="Arsenic Test Date"
            value={formatLocalDate(
              water.arsenicTest.dateTestingDone,
              'Not recorded'
            )}
          />
          <DetailRow
            label="Arsenic Result"
            value={formatBinary(
              water.arsenicTest.result,
              'Within allowable limit',
              'Above allowable limit'
            )}
            last
          />
        </Section>

        <Section title="Sanitation Facility" icon="home-outline">
          <DetailRow label="Facility Type" value={formatSanitationFacility(inspection)} />
          <DetailRow
            label="Shared Facility"
            value={formatBinary(sanitation.sharedWithOtherHouseholds)}
          />
          <DetailRow
            label="Basic Sanitation"
            value={formatBinary(sanitation.basicSanitationFacility)}
          />
          <DetailRow
            label="Disposal / Treatment"
            value={formatDisposalMethod(inspection)}
          />
          <DetailRow label="SMSS" value={formatBinary(sanitation.smssStatus)} last />
        </Section>

        <Section title="Findings" icon="alert-circle-outline">
          {inspection.findings.length === 0 ? (
            <Text style={styles.emptySection}>No findings recorded.</Text>
          ) : (
            inspection.findings.map((finding, index) => (
              <View
                key={finding.id}
                style={[
                  styles.finding,
                  index < inspection.findings.length - 1 && styles.rowBorder,
                ]}
              >
                <Text style={styles.findingTitle}>Finding {index + 1}</Text>
                <Text style={styles.findingCategory}>
                  {formatFindingCategory(finding.category)}
                </Text>
                <Text style={styles.findingDetails}>{finding.details}</Text>
                <EvidencePreviewGallery evidence={finding.evidence} />
              </View>
            ))
          )}
        </Section>

        <Section title="Remarks" icon="document-text-outline">
          <Text style={inspection.remarks.trim() ? styles.remarks : styles.emptySection}>
            {inspection.remarks.trim() || 'No remarks recorded.'}
          </Text>
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon} size={20} color={COLORS.primary} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function DetailRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function formatSyncStatus(inspection: StoredInspection) {
  if (inspection.syncStatus === 'synced') return 'Synced';
  if (inspection.syncStatus === 'failed') return 'Failed — stored locally';
  return 'Pending — stored locally';
}

function formatBoolean(value?: boolean) {
  return value === undefined ? 'Not recorded' : value ? 'Yes' : 'No';
}

function formatBinary(
  value?: 0 | 1,
  yes = 'Yes',
  no = 'No'
) {
  return value === undefined ? 'Not determined' : value === 1 ? yes : no;
}

function formatWaterSource(inspection: StoredInspection) {
  const water = inspection.safeWaterSupply;
  switch (water.waterSourceType) {
    case 'level_1':
      return 'Level I — Point source';
    case 'level_2':
      return 'Level II — Communal faucet system';
    case 'level_3':
      return 'Level III — Individual connection';
    case 'others':
      return water.otherWaterSource || 'Other source';
    default:
      return 'Not recorded';
  }
}

function formatSanitationFacility(inspection: StoredInspection) {
  const sanitation = inspection.sanitationFacility;
  if (sanitation.sanitaryFacilityType === 'septic_tank') return 'Septic tank';
  if (sanitation.sanitaryFacilityType === 'sewer_system') return 'Sewer system';
  if (sanitation.sanitaryFacilityType === 'vip_or_composting') {
    return 'VIP latrine or composting toilet';
  }
  switch (sanitation.unsanitaryToiletType) {
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
}

function formatDisposalMethod(inspection: StoredInspection) {
  switch (inspection.sanitationFacility.excretaDisposalMethod) {
    case 'onsite_treatment':
      return 'Stored and treated on-site';
    case 'offsite_dislodging':
      return 'Transported and treated off-site';
    case 'sewer_or_offsite_treatment':
      return 'Conveyed and treated off-site';
    default:
      return 'Not recorded';
  }
}

function formatFindingCategory(category: StoredInspection['findings'][number]['category']) {
  if (category === 'safe_water_supply') return 'Safe Water Supply';
  if (category === 'sanitation') return 'Sanitation';
  return 'Other';
}

function formatLocationStatus(status: StoredInspection['locationCaptureStatus']) {
  switch (status) {
    case 'captured':
      return 'Captured';
    case 'permission_denied':
      return 'Not captured — permission denied';
    case 'services_disabled':
      return 'Not captured — services disabled';
    case 'unavailable':
      return 'Not captured — unavailable';
    default:
      return 'Not attempted';
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  backButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primarySoft,
  },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  secondary: { marginTop: 2, fontSize: 12, color: COLORS.textSecondary },
  content: { gap: SPACING.lg, padding: SPACING.lg, paddingBottom: 50 },
  section: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  sectionBody: { paddingHorizontal: SPACING.md },
  row: { paddingVertical: SPACING.md },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  rowLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textMuted },
  rowValue: { marginTop: 4, fontSize: 13, lineHeight: 19, color: COLORS.text },
  finding: { paddingVertical: SPACING.md },
  findingTitle: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  findingCategory: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.violation,
  },
  findingDetails: { marginTop: SPACING.sm, fontSize: 13, lineHeight: 19, color: COLORS.text },
  remarks: { paddingVertical: SPACING.md, fontSize: 13, lineHeight: 20, color: COLORS.text },
  emptySection: {
    paddingVertical: SPACING.md,
    fontSize: 12,
    fontStyle: 'italic',
    color: COLORS.textMuted,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    padding: SPACING.xl,
    backgroundColor: COLORS.background,
  },
  emptyTitle: { fontSize: 19, fontWeight: '700', color: COLORS.text },
  emptyText: {
    maxWidth: 320,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.textSecondary,
  },
  pressed: { opacity: 0.7 },
});
