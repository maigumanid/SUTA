import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import AppButton from '@/components/common/AppButton';
import {
  COLORS,
  RADIUS,
  SPACING,
} from '@/constants/theme';

import { usePlaces } from '@/context/PlacesContext';
import { useAuth } from '@/context/AuthContext';
import { useInspectionSync } from '@/context/InspectionSyncContext';
import { getInspectionSyncErrorMessage } from '@/services/inspectionSyncService';

import {
  getStoredInspections,
  StoredInspection,
} from '@/storage/inspectionStorage';
import { formatLocalDateTime } from '@/utils/dateTime';
import {
  getInspectionResultLabel,
  getInspectionTypeLabel,
} from '@/utils/inspectionDisplay';

type SyncFilter = 'all' | StoredInspection['syncStatus'];

const FILTERS: { label: string; value: SyncFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Failed', value: 'failed' },
  { label: 'Pending', value: 'pending' },
  { label: 'Synced', value: 'synced' },
];

const STATUS_PRIORITY: Record<StoredInspection['syncStatus'], number> = {
  failed: 0,
  pending: 1,
  synced: 2,
};

export default function SyncScreen() {
  const { profile } = useAuth();
  const {
    isSyncing,
    retryInspection,
    syncRevision,
    syncingInspectionIds,
  } = useInspectionSync();
  const [inspections, setInspections] =
    useState<StoredInspection[]>([]);
  const [filter, setFilter] = useState<SyncFilter>('all');

  const [isLoading, setIsLoading] =
    useState(true);

  const [isRefreshing, setIsRefreshing] =
    useState(false);
  const [isRetryingAll, setIsRetryingAll] =
    useState(false);

  const loadInspections = useCallback(async () => {
    try {
      if (!profile) return;
      const records = await getStoredInspections({
        bsiUid: profile.uid,
        barangayId: profile.assignedBarangayId,
      });

      setInspections(records);
    } catch (error) {
      console.error(
        'Failed to load inspections:',
        error
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      loadInspections();
    }, [loadInspections])
  );

  const refresh = () => {
    setIsRefreshing(true);
    loadInspections();
  };

  const pendingCount =
    inspections.filter(
      (inspection) =>
        inspection.syncStatus ===
        'pending'
    ).length;

  const syncedCount =
    inspections.filter(
      (inspection) =>
        inspection.syncStatus ===
        'synced'
    ).length;

  const failedCount =
    inspections.filter(
      (inspection) =>
        inspection.syncStatus ===
        'failed'
    ).length;

  const visibleInspections = useMemo(
    () =>
      inspections
        .filter(
          (inspection) =>
            filter === 'all' || inspection.syncStatus === filter
        )
        .sort((left, right) => {
          if (filter === 'all') {
            const priorityDifference =
              STATUS_PRIORITY[left.syncStatus] -
              STATUS_PRIORITY[right.syncStatus];
            if (priorityDifference !== 0) {
              return priorityDifference;
            }
          }

          const leftTime = Date.parse(left.savedAt);
          const rightTime = Date.parse(right.savedAt);
          return (
            (Number.isNaN(rightTime) ? 0 : rightTime) -
            (Number.isNaN(leftTime) ? 0 : leftTime)
          );
        }),
    [filter, inspections]
  );

  useEffect(() => {
    if (syncRevision > 0) {
      void loadInspections();
    }
  }, [loadInspections, syncRevision]);

  const handleRetry = async (inspection: StoredInspection) => {
    try {
      await retryInspection(inspection.id);
      await loadInspections();
      Alert.alert(
        'Inspection Synchronized',
        'The inspection and its evidence were synchronized successfully.'
      );
    } catch (error) {
      await loadInspections();
      Alert.alert(
        'Synchronization Failed',
        getInspectionSyncErrorMessage(error)
      );
    }
  };

  const handleRetryAll = async () => {
    const failedInspections = inspections
      .filter((inspection) => inspection.syncStatus === 'failed')
      .sort((left, right) => {
        const leftTime = Date.parse(left.savedAt);
        const rightTime = Date.parse(right.savedAt);
        return (
          (Number.isNaN(leftTime) ? 0 : leftTime) -
          (Number.isNaN(rightTime) ? 0 : rightTime)
        );
      });

    if (failedInspections.length === 0 || isRetryingAll) {
      return;
    }

    setIsRetryingAll(true);
    let succeeded = 0;
    let failed = 0;

    try {
      for (const inspection of failedInspections) {
        try {
          await retryInspection(inspection.id);
          succeeded += 1;
        } catch {
          failed += 1;
        }
      }

      await loadInspections();

      Alert.alert(
        failed === 0
          ? 'Inspections Synchronized'
          : 'Synchronization Finished',
        failed === 0
          ? `${succeeded} ${succeeded === 1 ? 'inspection was' : 'inspections were'} synchronized.`
          : `${succeeded} synchronized and ${failed} remain failed. Local records and evidence were kept.`
      );
    } catch (error) {
      await loadInspections();
      Alert.alert(
        'Synchronization Failed',
        getInspectionSyncErrorMessage(error)
      );
    } finally {
      setIsRetryingAll(false);
    }
  };

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
            size={23}
            color={COLORS.text}
          />
        </Pressable>

        <View style={styles.headerText}>
          <Text style={styles.title}>
            Sync Status
          </Text>

          <Text style={styles.subtitle}>
            Offline inspection records
          </Text>
        </View>

        <Pressable
          onPress={refresh}
          style={({ pressed }) => [
            styles.refreshButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name="refresh-outline"
            size={21}
            color={COLORS.primary}
          />
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator
            size="large"
            color={COLORS.primary}
          />

          <Text style={styles.loadingText}>
            Loading inspections...
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={
            false
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={refresh}
            />
          }
          contentContainerStyle={
            styles.content
          }
        >
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <View
                style={styles.summaryIcon}
              >
                <Ionicons
                  name="cloud-outline"
                  size={25}
                  color={COLORS.primary}
                />
              </View>

              <View style={styles.flex}>
                <Text
                  style={
                    styles.summaryTitle
                  }
                >
                  Local Records
                </Text>

                <Text
                  style={
                    styles.summaryText
                  }
                >
                  Inspections saved on this
                  device
                </Text>
              </View>

              <Text style={styles.total}>
                {inspections.length}
              </Text>
            </View>

            <View style={styles.statusRow}>
              <StatusCount
                label="Failed"
                count={failedCount}
                icon="alert-circle-outline"
              />

              <StatusCount
                label="Pending"
                count={pendingCount}
                icon="time-outline"
              />

              <StatusCount
                label="Synced"
                count={syncedCount}
                icon="checkmark-circle-outline"
              />
            </View>
          </View>

          {failedCount > 0 && (
            <AppButton
              title="Retry All"
              onPress={() => {
                void handleRetryAll();
              }}
              loading={isRetryingAll}
              disabled={isSyncing || syncingInspectionIds.size > 0}
            />
          )}

          <View>
            <Text
              style={styles.sectionTitle}
            >
              Inspection Records
            </Text>

            <Text
              style={styles.sectionText}
            >
              Records saved locally will
              remain on this device until
              synchronization is available.
            </Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filters}
          >
            {FILTERS.map((item) => {
              const selected = filter === item.value;
              return (
                <Pressable
                  key={item.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setFilter(item.value)}
                  style={({ pressed }) => [
                    styles.filterChip,
                    selected && styles.filterChipSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterText,
                      selected && styles.filterTextSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {visibleInspections.length === 0 ? (
            <View style={styles.empty}>
              <View
                style={styles.emptyIcon}
              >
                <Ionicons
                  name="documents-outline"
                  size={32}
                  color={COLORS.textMuted}
                />
              </View>

              <Text
                style={styles.emptyTitle}
              >
                {inspections.length === 0
                  ? 'No Local Inspections'
                  : `No ${filter === 'all' ? '' : `${filter} `}inspections`}
              </Text>

              <Text
                style={styles.emptyText}
              >
                {inspections.length === 0
                  ? 'Completed inspections saved on this device will appear here.'
                  : 'Choose another filter to view local inspection records.'}
              </Text>
            </View>
          ) : (
            <View style={styles.records}>
              {visibleInspections.map(
                (inspection) => (
                  <InspectionCard
                    key={inspection.id}
                    inspection={
                      inspection
                    }
                    placeHistory={inspections.filter(
                      (candidate) =>
                        candidate.placeId === inspection.placeId
                    )}
                    isRetrying={syncingInspectionIds.has(inspection.id)}
                    retryDisabled={
                      isSyncing ||
                      isRetryingAll ||
                      syncingInspectionIds.size > 0
                    }
                    onRetry={() => {
                      void handleRetry(inspection);
                    }}
                  />
                )
              )}
            </View>
          )}

          {pendingCount > 0 && (
            <View
              style={
                styles.pendingNotice
              }
            >
              <Ionicons
                name="cloud-offline-outline"
                size={21}
                color={COLORS.offline}
              />

              <Text
                style={
                  styles.pendingNoticeText
                }
              >
                {pendingCount}{' '}
                {pendingCount === 1
                  ? 'inspection is'
                  : 'inspections are'}{' '}
                waiting for a connection and
                will sync automatically when
                online. The records are safely
                stored on this device.
              </Text>
            </View>
          )}

          {failedCount > 0 && (
            <View style={styles.failedNotice}>
              <Ionicons
                name="alert-circle-outline"
                size={21}
                color={COLORS.violation}
              />
              <Text style={styles.failedNoticeText}>
                {failedCount}{' '}
                {failedCount === 1 ? 'inspection remains' : 'inspections remain'}{' '}
                stored on this device after synchronization failed. Use Retry Sync to try again.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function InspectionCard({
  inspection,
  placeHistory,
  isRetrying,
  retryDisabled,
  onRetry,
}: {
  inspection: StoredInspection;
  placeHistory: StoredInspection[];
  isRetrying: boolean;
  retryDisabled: boolean;
  onRetry: () => void;
}) {
  const { getPlaceById } = usePlaces();
  const place =
    getPlaceById(inspection.placeId);

  const placeName =
    place?.name ??
    'Place not available';

  const representative =
    place?.representativeName ??
    'Representative not available';

  const purok =
    place?.purok ??
    'Purok not available';

  const savedDate = formatLocalDateTime(
    inspection.savedAt
  );

  const inspectionDate = formatLocalDateTime(
    inspection.inspectionDate
  );

  const status =
    getStatusInfo(
      inspection.syncStatus
    );

  const inspectionType = getInspectionTypeLabel(
    inspection,
    placeHistory
  );

  const result = getInspectionResultLabel(inspection.result);

  return (
    <View style={styles.recordCard}>
      <View style={styles.recordHeader}>
        <View style={styles.placeIcon}>
          <Ionicons
            name="home-outline"
            size={22}
            color={COLORS.primary}
          />
        </View>

        <View style={styles.flex}>
          <Text
            style={styles.placeName}
          >
            {inspectionType} — {placeName}
          </Text>

          <Text
            style={
              styles.representative
            }
          >
            {representative}
          </Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor:
                status.background,
            },
          ]}
        >
          <Ionicons
            name={status.icon}
            size={14}
            color={status.color}
          />

          <Text
            style={[
              styles.statusText,
              {
                color: status.color,
              },
            ]}
          >
            {status.label}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      <InfoLine
        icon="location-outline"
        label="Purok"
        value={purok}
      />

      <InfoLine
        icon="calendar-outline"
        label="Inspection Date"
        value={inspectionDate}
      />

      <InfoLine
        icon="clipboard-outline"
        label="Result"
        value={result}
      />

      <InfoLine
        icon="phone-portrait-outline"
        label="Saved on Device"
        value={savedDate}
      />

      {inspection.syncStatus === 'pending' && (
        <View style={styles.syncExplanation}>
          <Text style={styles.syncExplanationTitle}>
            Waiting for connection
          </Text>
          <Text style={styles.syncExplanationText}>
            Will sync automatically when online.
          </Text>
        </View>
      )}

      {inspection.syncStatus === 'failed' && (
        <Text style={styles.syncFailureText}>
          Synchronization failed
        </Text>
      )}

      {inspection.syncStatus === 'failed' && (
        <AppButton
          title="Retry Sync"
          onPress={onRetry}
          loading={isRetrying}
          disabled={retryDisabled}
          style={styles.retryButton}
        />
      )}
    </View>
  );
}

function StatusCount({
  label,
  count,
  icon,
}: {
  label: string;
  count: number;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.statusCount}>
      <Ionicons
        name={icon}
        size={18}
        color={COLORS.primary}
      />

      <Text
        style={styles.statusNumber}
      >
        {count}
      </Text>

      <Text
        style={styles.statusLabel}
      >
        {label}
      </Text>
    </View>
  );
}

function InfoLine({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoLine}>
      <Ionicons
        name={icon}
        size={17}
        color={COLORS.textMuted}
      />

      <Text style={styles.infoLabel}>
        {label}
      </Text>

      <Text style={styles.infoValue}>
        {value}
      </Text>
    </View>
  );
}

function getStatusInfo(
  status:
    | 'pending'
    | 'synced'
    | 'failed'
) {
  if (status === 'synced') {
    return {
      label: 'Synced',
      icon: 'checkmark-circle' as const,
      color: COLORS.compliant,
      background:
        COLORS.primarySoft,
    };
  }

  if (status === 'failed') {
    return {
      label: 'Failed',
      icon: 'alert-circle' as const,
      color: COLORS.violation,
      background: '#FBEDEC',
    };
  }

  return {
    label: 'Pending',
    icon: 'time' as const,
    color: COLORS.warning,
    background: '#FFF6E5',
  };
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  flex: {
    flex: 1,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
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

  headerText: {
    flex: 1,
  },

  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },

  subtitle: {
    marginTop: 2,
    fontSize: 12,
    color: COLORS.textSecondary,
  },

  refreshButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primarySoft,
  },

  content: {
    gap: SPACING.lg,
    padding: SPACING.lg,
    paddingBottom: 50,
  },

  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
  },

  loadingText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },

  summaryCard: {
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
  },

  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },

  summaryIcon: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primarySoft,
  },

  summaryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },

  summaryText: {
    marginTop: 3,
    fontSize: 11,
    color: COLORS.textSecondary,
  },

  total: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.primary,
  },

  statusRow: {
    flexDirection: 'row',
    marginTop: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },

  statusCount: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },

  statusNumber: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
  },

  statusLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
  },

  sectionText: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textSecondary,
  },

  filters: {
    gap: SPACING.sm,
    paddingRight: SPACING.lg,
  },

  filterChip: {
    minWidth: 76,
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surface,
  },

  filterChipSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },

  filterText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },

  filterTextSelected: {
    color: COLORS.white,
  },

  records: {
    gap: SPACING.md,
  },

  recordCard: {
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
  },

  recordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },

  placeIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primarySoft,
  },

  placeName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },

  representative: {
    marginTop: 2,
    fontSize: 11,
    color: COLORS.textSecondary,
  },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 20,
  },

  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },

  divider: {
    height: 1,
    marginVertical: SPACING.md,
    backgroundColor: COLORS.divider,
  },

  infoLine: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 30,
    gap: 7,
  },

  infoLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },

  infoValue: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'right',
    color: COLORS.text,
  },

  syncExplanation: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.warningSoft,
  },

  syncExplanationTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.warningDark,
  },

  syncExplanationText: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 16,
    color: COLORS.warningDark,
  },

  syncFailureText: {
    marginTop: SPACING.md,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.violation,
  },

  retryButton: {
    marginTop: SPACING.md,
  },

  pendingNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
  },

  pendingNoticeText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 17,
    color: COLORS.offline,
  },

  failedNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.violationSoft,
  },

  failedNoticeText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 17,
    color: COLORS.violation,
  },

  empty: {
    alignItems: 'center',
    paddingVertical: 50,
    paddingHorizontal: SPACING.lg,
  },

  emptyIcon: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 32,
    backgroundColor: COLORS.primarySoft,
  },

  emptyTitle: {
    marginTop: SPACING.md,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },

  emptyText: {
    maxWidth: 270,
    marginTop: 5,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    color: COLORS.textSecondary,
  },

  pressed: {
    opacity: 0.65,
  },
});
