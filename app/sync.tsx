import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  COLORS,
  RADIUS,
  SPACING,
} from '@/constants/theme';

import {
  getPlaceById,
} from '@/data/places';

import {
  getStoredInspections,
  StoredInspection,
} from '@/storage/inspectionStorage';

export default function SyncScreen() {
  const [inspections, setInspections] =
    useState<StoredInspection[]>([]);

  const [isLoading, setIsLoading] =
    useState(true);

  const [isRefreshing, setIsRefreshing] =
    useState(false);

  const loadInspections = async () => {
    try {
      const records =
        await getStoredInspections();

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
  };

  useFocusEffect(
    useCallback(() => {
      loadInspections();
    }, [])
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
                label="Pending"
                count={pendingCount}
                icon="time-outline"
              />

              <StatusCount
                label="Synced"
                count={syncedCount}
                icon="checkmark-circle-outline"
              />

              <StatusCount
                label="Failed"
                count={failedCount}
                icon="alert-circle-outline"
              />
            </View>
          </View>

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

          {inspections.length === 0 ? (
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
                No Local Inspections
              </Text>

              <Text
                style={styles.emptyText}
              >
                Completed inspections saved
                on this device will appear
                here.
              </Text>
            </View>
          ) : (
            <View style={styles.records}>
              {inspections.map(
                (inspection) => (
                  <InspectionCard
                    key={inspection.id}
                    inspection={
                      inspection
                    }
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
                waiting to be synchronized.
                The records are safely stored
                on this device.
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
}: {
  inspection: StoredInspection;
}) {
  const place =
    getPlaceById(inspection.placeId);

  const placeName =
    place?.name ??
    `Place ${inspection.placeId}`;

  const representative =
    place?.representativeName ??
    'Representative not available';

  const purok =
    place?.purok ??
    'Purok not available';

  const savedDate = formatDate(
    inspection.savedAt
  );

  const inspectionDate = formatDate(
    inspection.inspectionDate
  );

  const status =
    getStatusInfo(
      inspection.syncStatus
    );

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
            {placeName}
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
        icon="phone-portrait-outline"
        label="Saved on Device"
        value={savedDate}
      />

      <View style={styles.recordFooter}>
        <Text style={styles.recordId}>
          ID: {inspection.id}
        </Text>
      </View>
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

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Unknown date';
  }

  return date.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
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

  recordFooter: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },

  recordId: {
    fontSize: 9,
    color: COLORS.textMuted,
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
