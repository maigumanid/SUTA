import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import AppButton from '@/components/common/AppButton';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import {
  getReinspectionCalendarStatus,
  saveReinspectionCalendarEvent,
  type ReinspectionCalendarInput,
  type ReinspectionCalendarStatus,
} from '@/services/reinspectionCalendarService';

type Props = ReinspectionCalendarInput & { refreshToken?: number };

const STATUS_COPY: Record<ReinspectionCalendarStatus, string> = {
  not_added: 'Not added to calendar',
  added: 'Added to calendar',
  updated: 'Updated in calendar',
  needs_update: 'Needs calendar update',
};

export default function ReinspectionCalendarAction(props: Props) {
  const [status, setStatus] = useState<ReinspectionCalendarStatus>('not_added');
  const [isSaving, setIsSaving] = useState(false);
  const { userId, reinspectionId, scheduledDate, refreshToken } = props;

  useEffect(() => {
    let active = true;
    void getReinspectionCalendarStatus({ userId, reinspectionId, scheduledDate })
      .then((result) => {
        if (active) setStatus(result.status);
      })
      .catch(() => {
        if (active) setStatus('needs_update');
      });
    return () => {
      active = false;
    };
  }, [refreshToken, reinspectionId, scheduledDate, userId]);

  const saveCalendarEvent = async () => {
    setIsSaving(true);
    try {
      const result = await saveReinspectionCalendarEvent(props);
      setStatus(result.status);
      Alert.alert(
        result.status === 'added' ? 'Added to Calendar' : 'Calendar Updated',
        result.status === 'added'
          ? 'The all-day reinspection event was created with a reminder one day before.'
          : 'The existing calendar event was updated to the current reinspection schedule.'
      );
    } catch (error) {
      Alert.alert(
        'Calendar Unavailable',
        error instanceof Error ? error.message : 'The calendar reminder could not be saved.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const current = status === 'added' || status === 'updated';
  return (
    <View style={styles.card}>
      <View style={styles.headingRow}>
        <View style={[styles.icon, current && styles.iconCurrent]}>
          <Ionicons
            name={current ? 'calendar-clear' : 'calendar-outline'}
            size={20}
            color={current ? COLORS.white : COLORS.primary}
          />
        </View>
        <View style={styles.headingText}>
          <Text style={styles.title}>Device Calendar Reminder</Text>
          <Text style={[styles.status, current && styles.success, status === 'needs_update' && styles.warning]}>
            {STATUS_COPY[status]}
          </Text>
        </View>
      </View>
      <Text style={styles.body}>
        SUTA creates one all-day event and keeps its date aligned with this active schedule.
      </Text>
      {status === 'needs_update' ? (
        <Text style={styles.warning}>
          The schedule changed or the tracked event is no longer available. Save the current date to restore it.
        </Text>
      ) : null}
      <AppButton
        title={status === 'needs_update' ? 'Update Calendar Event' : current ? 'Calendar Event Is Current' : 'Add to Calendar'}
        variant="outline"
        disabled={current}
        loading={isSaving}
        onPress={() => void saveCalendarEvent()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: SPACING.sm, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, backgroundColor: COLORS.surface },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  headingText: { flex: 1 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primarySoft },
  iconCurrent: { backgroundColor: COLORS.primary },
  title: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  status: { marginTop: 2, fontSize: 12, fontWeight: '700', color: COLORS.textMuted },
  body: { fontSize: 12, lineHeight: 18, color: COLORS.textSecondary },
  warning: { fontSize: 12, lineHeight: 18, color: COLORS.warning },
  success: { color: COLORS.compliant },
});
