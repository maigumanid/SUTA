import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
} from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import AppButton from '@/components/common/AppButton';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { usePlaces } from '@/context/PlacesContext';
import { useAuth } from '@/context/AuthContext';
import {
  getStoredInspectionById,
  getStoredInspections,
  StoredInspection,
} from '@/storage/inspectionStorage';
import {
  getReinspectionById,
  getReinspectionForInspection,
  ReinspectionRecord,
  saveReinspectionSchedule,
} from '@/storage/reinspectionStorage';
import { uploadReinspection } from '@/services/reinspectionService';
import { formatLocalDate, formatLocalDateTime } from '@/utils/dateTime';

export default function ReinspectionScreen() {
  const { getPlaceById } = usePlaces();
  const { profile } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [source, setSource] =
    useState<StoredInspection | null>(null);
  const [record, setRecord] =
    useState<ReinspectionRecord | null>(null);
  const [selectedDate, setSelectedDate] =
    useState(new Date());
  const [hasChosenDate, setHasChosenDate] =
    useState(false);
  const [showPicker, setShowPicker] =
    useState(false);
  const [isLoading, setIsLoading] =
    useState(true);
  const [isSaving, setIsSaving] =
    useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    setIsLoading(true);

    const scope = {
      bsiUid: profile.uid,
      barangayId: profile.assignedBarangayId,
    };

    let schedule = await getReinspectionById(id, scope);
    let original = schedule
      ? await getStoredInspectionById(
          schedule.originalInspectionId,
          scope
        )
      : await getStoredInspectionById(id, scope);

    if (!schedule && original) {
      schedule =
        await getReinspectionForInspection(
          original.id,
          scope
        );
    }

    if (!original) {
      const inspections =
        await getStoredInspections(scope);
      original =
        inspections.find(
          (inspection) =>
            inspection.placeId === id &&
            inspection.result ===
              'for_reinspection'
        ) ?? null;

      if (original) {
        schedule =
          await getReinspectionForInspection(
            original.id,
            scope
          );
      }
    }

    setSource(original ?? null);
    setRecord(schedule ?? null);

    if (schedule) {
      setSelectedDate(
        new Date(schedule.scheduledDate)
      );
      setHasChosenDate(true);
    }

    setIsLoading(false);
  }, [id, profile]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const handleDateChange = (
    event: DateTimePickerEvent,
    date?: Date
  ) => {
    setShowPicker(false);

    if (event.type !== 'set' || !date) {
      return;
    }

    date.setHours(12, 0, 0, 0);
    setSelectedDate(date);
    setHasChosenDate(true);
  };

  const saveSchedule = async () => {
    if (!source || !hasChosenDate || !profile) {
      return;
    }

    setIsSaving(true);

    try {
      const saved = await saveReinspectionSchedule({
        bsiUid: profile.uid,
        barangayId: profile.assignedBarangayId,
        originalInspectionId: source.id,
        placeId: source.placeId,
        scheduledDate: selectedDate.toISOString(),
      });
      try {
        await uploadReinspection(saved);
      } catch (uploadError) {
        console.error('Reinspection upload deferred:', uploadError);
      }
      setRecord(saved);
      Alert.alert(
        'Reinspection Scheduled',
        'The follow-up inspection schedule was saved on this device.'
      );
    } catch (error) {
      console.error(
        'Unable to schedule reinspection:',
        error
      );
      Alert.alert(
        'Schedule Not Saved',
        'Please try again. The original inspection has not been changed.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const conductReinspection = () => {
    if (!source || !record) {
      return;
    }

    router.push({
      pathname: '/inspection/new',
      params: {
        placeId: source.placeId,
        reinspectionId: record.id,
        originalInspectionId: source.id,
      },
    });
  };

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
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
        />
        <Text style={styles.secondaryText}>
          Loading reinspection...
        </Text>
      </View>
    );
  }

  if (!source) {
    return (
      <View style={styles.center}>
        <Ionicons
          name="calendar-outline"
          size={48}
          color={COLORS.textMuted}
        />
        <Text style={styles.emptyTitle}>
          No reinspection source found
        </Text>
        <Text style={styles.emptyText}>
          Save an inspection with a For Reinspection result before scheduling its follow-up.
        </Text>
        <AppButton
          title="Back to Places"
          onPress={goBack}
        />
      </View>
    );
  }

  const place = getPlaceById(source.placeId);
  const isCompleted = record?.status === 'completed';

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          onPress={goBack}
          style={styles.backButton}
        >
          <Ionicons
            name="arrow-back"
            size={23}
            color={COLORS.text}
          />
        </Pressable>
        <View style={styles.flex}>
          <Text style={styles.title}>
            Reinspection
          </Text>
          <Text style={styles.secondaryText}>
            {isCompleted
              ? 'Review the completed follow-up'
              : record
                ? 'Review or change the follow-up schedule'
                : 'Schedule the required follow-up'}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.cardLabel}>
            PLACE
          </Text>
          <Text style={styles.placeName}>
            {place?.name ?? 'Place not available'}
          </Text>
          <Text style={styles.secondaryText}>
            Original inspection: {formatLocalDateTime(source.inspectionDate)}
          </Text>
          <View
            style={[
              styles.statusBadge,
              isCompleted
                ? styles.completedBadge
                : styles.pendingBadge,
            ]}
          >
            <Text style={styles.statusText}>
              {isCompleted
                ? `Completed ${formatLocalDateTime(record.completedAt)}`
                : record
                  ? `Scheduled for ${formatLocalDate(record.scheduledDate)}`
                  : 'Required - Not yet scheduled'}
            </Text>
          </View>
        </View>

        {!isCompleted && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Follow-up Date
          </Text>
          <Text style={styles.secondaryText}>
            Select the date when this place should be inspected again.
          </Text>

          <Pressable
            disabled={isCompleted}
            onPress={() => setShowPicker(true)}
            style={styles.dateButton}
          >
            <Ionicons
              name="calendar-outline"
              size={21}
              color={COLORS.primary}
            />
            <Text style={styles.dateText}>
              {hasChosenDate
                ? formatLocalDate(
                    selectedDate.toISOString()
                  )
                : 'Choose reinspection date'}
            </Text>
          </Pressable>

          {showPicker && (
            <DateTimePicker
              value={selectedDate}
              mode="date"
              minimumDate={new Date()}
              onChange={handleDateChange}
            />
          )}

          {!isCompleted && (
            <AppButton
              title={
                record
                  ? 'Change Schedule'
                  : 'Schedule Reinspection'
              }
              onPress={saveSchedule}
              disabled={!hasChosenDate}
              loading={isSaving}
            />
          )}
        </View>
        )}

        {record && !isCompleted && (
          <AppButton
            title="Conduct Reinspection"
            onPress={conductReinspection}
          />
        )}

        {isCompleted && (
          <>
            <View style={styles.completedNotice}>
              <Ionicons
                name="checkmark-circle"
                size={23}
                color={COLORS.compliant}
              />
              <Text style={styles.completedText}>
                This follow-up was completed on {formatLocalDateTime(record.completedAt)}. The original inspection remains in local history.
              </Text>
            </View>
            {record.completedInspectionId ? (
              <AppButton
                title="View Reinspection"
                onPress={() => {
                  const completedInspectionId =
                    record.completedInspectionId;

                  if (!completedInspectionId) {
                    return;
                  }

                  router.push({
                    pathname: '/inspection/[id]',
                    params: { id: completedInspectionId },
                  });
                }}
              />
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
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
  secondaryText: { fontSize: 12, lineHeight: 18, color: COLORS.textSecondary },
  content: { gap: SPACING.lg, padding: SPACING.lg, paddingBottom: 50 },
  card: {
    gap: SPACING.sm,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
  },
  cardLabel: { fontSize: 10, fontWeight: '800', color: COLORS.primary },
  placeName: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.pill },
  pendingBadge: { backgroundColor: COLORS.warningSoft },
  completedBadge: { backgroundColor: COLORS.compliantSoft },
  statusText: { fontSize: 11, fontWeight: '700', color: COLORS.text },
  dateButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.background,
  },
  dateText: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  completedNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.compliantSoft,
  },
  completedText: { flex: 1, fontSize: 12, lineHeight: 18, color: COLORS.text },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    padding: SPACING.xl,
    backgroundColor: COLORS.background,
  },
  emptyTitle: { fontSize: 19, fontWeight: '700', color: COLORS.text },
  emptyText: { maxWidth: 330, textAlign: 'center', fontSize: 13, lineHeight: 20, color: COLORS.textSecondary },
});
