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
import { getPlaceById } from '@/data/places';
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

export default function ReinspectionScreen() {
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
    setIsLoading(true);

    let schedule = await getReinspectionById(id);
    let original = schedule
      ? await getStoredInspectionById(
          schedule.originalInspectionId
        )
      : await getStoredInspectionById(id);

    if (!schedule && original) {
      schedule =
        await getReinspectionForInspection(
          original.id
        );
    }

    if (!original) {
      const inspections =
        await getStoredInspections();
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
            original.id
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
  }, [id]);

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
    if (!source || !hasChosenDate) {
      return;
    }

    setIsSaving(true);

    try {
      const saved = await saveReinspectionSchedule({
        originalInspectionId: source.id,
        placeId: source.placeId,
        scheduledDate: selectedDate.toISOString(),
      });
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
          title="Go Back"
          onPress={() => router.back()}
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
          onPress={() => router.back()}
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
            Schedule and conduct a follow-up
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
            {place?.name ?? `Place ${source.placeId}`}
          </Text>
          <Text style={styles.secondaryText}>
            Original inspection: {formatDate(source.inspectionDate)}
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
              {isCompleted ? 'Completed' : 'Pending'}
            </Text>
          </View>
        </View>

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
                ? formatDate(
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
                  ? 'Update Schedule'
                  : 'Save Schedule'
              }
              onPress={saveSchedule}
              disabled={!hasChosenDate}
              loading={isSaving}
            />
          )}
        </View>

        {record && !isCompleted && (
          <AppButton
            title="Conduct Reinspection"
            onPress={conductReinspection}
          />
        )}

        {isCompleted && (
          <View style={styles.completedNotice}>
            <Ionicons
              name="checkmark-circle"
              size={23}
              color={COLORS.compliant}
            />
            <Text style={styles.completedText}>
              This follow-up was completed on {formatDate(record.completedAt)}. The original inspection remains in local history.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function formatDate(value?: string) {
  if (!value) {
    return 'Unknown date';
  }

  return new Date(value).toLocaleDateString('en-PH', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
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
