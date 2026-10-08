import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import AppButton from '@/components/common/AppButton';
import SurfaceCard from '@/components/common/SurfaceCard';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import {
  clearDownloadedInspectionHistory,
  getOfflineStorageStats,
  OFFLINE_CACHE_TARGET_OPTIONS_MB,
  OFFLINE_RETENTION_OPTIONS,
  setOfflineStoragePreferences,
  type OfflineCacheTargetMb,
  type OfflineRetentionDays,
  type OfflineStorageStats,
} from '@/storage/inspectionHistoryCache';
import type { InspectionScope } from '@/storage/inspectionStorage';
import { formatLocalDateTime } from '@/utils/dateTime';

export default function OfflineStoragePanel({ scope }: { scope: InspectionScope }) {
  const [stats, setStats] = useState<OfflineStorageStats | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setStats(await getOfflineStorageStats(scope));
  }, [scope]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const update = async (next: {
    retentionDays: OfflineRetentionDays;
    cacheTargetMb: OfflineCacheTargetMb;
  }) => {
    setBusy(true);
    try {
      await setOfflineStoragePreferences(scope, next);
      await refresh();
    } catch (error) {
      Alert.alert(
        'Storage Setting Not Saved',
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setBusy(false);
    }
  };

  const confirmClear = () => {
    Alert.alert(
      'Clear downloaded history?',
      'This removes complete server-history copies that can be downloaded again. Inspection summaries, Pending or Failed work, local drafts, and unsynced evidence are kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Safe Cache',
          style: 'destructive',
          onPress: () => {
            setBusy(true);
            void clearDownloadedInspectionHistory(scope)
              .then(refresh)
              .catch((error) => {
                Alert.alert(
                  'Cache Could Not Be Cleared',
                  error instanceof Error ? error.message : 'Please try again.'
                );
              })
              .finally(() => setBusy(false));
          },
        },
      ]
    );
  };

  if (!stats) {
    return (
      <SurfaceCard style={styles.card}>
        <Text style={styles.loading}>Calculating offline storage...</Text>
      </SurfaceCard>
    );
  }

  return (
    <SurfaceCard elevated style={styles.card}>
      <View style={styles.header}>
        <View style={styles.icon}>
          <Ionicons name="phone-portrait-outline" size={21} color={COLORS.primary} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Offline Storage</Text>
          <Text style={styles.description}>
            Recent inspection records are stored on this device for field access. Older summaries remain available offline.
          </Text>
        </View>
      </View>

      <View style={styles.metrics}>
        <Metric value={String(stats.summaryCount)} label="Summaries" />
        <Metric value={String(stats.fullDetailCount)} label="Full records" />
        <Metric value={formatBytes(stats.approximateBytes)} label="Approx. used" />
      </View>

      {stats.hasRecentWriteWarning ? (
        <View style={styles.warning}>
          <Ionicons name="warning-outline" size={18} color={COLORS.warning} />
          <Text style={styles.warningText}>
            Device storage was recently too low for some downloaded history. Active inspection work was preserved.
          </Text>
        </View>
      ) : null}

      <ChoiceGroup
        label="KEEP FULL RECORDS"
        options={OFFLINE_RETENTION_OPTIONS.map((days) => ({
          label: `${days} days`,
          value: days,
        }))}
        value={stats.retentionDays}
        disabled={busy}
        onChange={(retentionDays) =>
          void update({ retentionDays, cacheTargetMb: stats.cacheTargetMb })
        }
      />

      <ChoiceGroup
        label="CACHE TARGET"
        options={OFFLINE_CACHE_TARGET_OPTIONS_MB.map((size) => ({
          label: `${size} MB`,
          value: size,
        }))}
        value={stats.cacheTargetMb}
        disabled={busy}
        onChange={(cacheTargetMb) =>
          void update({ retentionDays: stats.retentionDays, cacheTargetMb })
        }
      />

      <Text style={styles.note}>
        The size is an estimate and a cleanup target, not a hard device quota. Pending, Failed, and active follow-up work never count against it.
      </Text>
      <Text style={styles.cleanupTime}>
        Last cleanup: {formatLocalDateTime(stats.lastCleanupAt, 'Not run yet')}
      </Text>
      <AppButton
        title="Clear Downloaded History"
        variant="outline"
        disabled={busy}
        onPress={confirmClear}
      />
    </SurfaceCard>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.metric}>
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function ChoiceGroup<T extends number>({
  label,
  options,
  value,
  disabled,
  onChange,
}: {
  label: string;
  options: { label: string; value: T }[];
  value: T;
  disabled: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.choiceGroup}>
      <Text style={styles.choiceLabel}>{label}</Text>
      <View style={styles.choices}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled }}
              disabled={disabled || selected}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.choice,
                selected && styles.choiceSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(0, bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const styles = StyleSheet.create({
  card: { gap: SPACING.lg },
  loading: { ...TYPOGRAPHY.body, color: COLORS.textSecondary },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md },
  icon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primarySoft },
  headerCopy: { flex: 1 },
  title: { ...TYPOGRAPHY.subheading, color: COLORS.text },
  description: { ...TYPOGRAPHY.caption, marginTop: 3, color: COLORS.textSecondary },
  metrics: { flexDirection: 'row', gap: SPACING.sm },
  metric: { flex: 1, minWidth: 0, padding: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.surfaceMuted },
  metricValue: { ...TYPOGRAPHY.subheading, color: COLORS.primary },
  metricLabel: { ...TYPOGRAPHY.tiny, marginTop: 2, color: COLORS.textMuted },
  warning: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, padding: SPACING.md, borderRadius: RADIUS.md, backgroundColor: COLORS.warningSoft },
  warningText: { ...TYPOGRAPHY.caption, flex: 1, color: COLORS.text },
  choiceGroup: { gap: SPACING.sm },
  choiceLabel: { ...TYPOGRAPHY.label, color: COLORS.textSecondary },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  choice: { minWidth: 70, flexGrow: 1, alignItems: 'center', paddingHorizontal: SPACING.sm, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.pill, backgroundColor: COLORS.surface },
  choiceSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  choiceText: { ...TYPOGRAPHY.caption, fontWeight: '700', color: COLORS.textSecondary },
  choiceTextSelected: { color: COLORS.primary },
  note: { ...TYPOGRAPHY.caption, color: COLORS.textMuted },
  cleanupTime: { ...TYPOGRAPHY.tiny, color: COLORS.textMuted },
  pressed: { opacity: 0.72 },
});
