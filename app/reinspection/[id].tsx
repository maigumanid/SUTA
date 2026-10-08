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
import ReinspectionCalendarAction from '@/components/reinspection/ReinspectionCalendarAction';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useNetwork } from '@/context/NetworkContext';
import { usePlaces } from '@/context/PlacesContext';
import {
  fetchInspectionHistoryForPlace,
  fetchStoredInspectionById,
  mergeInspectionHistory,
} from '@/services/inspectionHistoryService';
import {
  getStoredInspectionById,
  getStoredInspections,
  StoredInspection,
} from '@/storage/inspectionStorage';
import {
  getCachedInspectionById,
  getCachedInspectionHistoryForPlace,
} from '@/storage/inspectionHistoryCache';
import {
  getReinspections,
  ReinspectionRecord,
  saveReinspectionSchedule,
} from '@/storage/reinspectionStorage';
import {
  loadReinspections,
  uploadReinspection,
} from '@/services/reinspectionService';
import {
  getReinspectionCalendarState,
  saveReinspectionCalendarEvent,
} from '@/services/reinspectionCalendarService';
import { formatLocalDate, formatLocalDateTime } from '@/utils/dateTime';
import { getInspectionResultLabel } from '@/utils/inspectionDisplay';
import { isReinspectionOverdue } from '@/utils/reinspection';
import {
  calculateInspectionRisk,
  getRiskClassification,
} from '@/utils/riskClassification';

export default function ReinspectionScreen() {
  const { getPlaceById } = usePlaces();
  const { profile } = useAuth();
  const { isOnline } = useNetwork();
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
  const [calendarRefreshToken, setCalendarRefreshToken] =
    useState(0);
  const [scheduleFeedback, setScheduleFeedback] = useState<{
    message: string;
    tone: 'success' | 'warning';
  } | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setIsLoading(true);

    const scope = {
      bsiUid: profile.uid,
      barangayId: profile.assignedBarangayId,
    };

    let schedules: ReinspectionRecord[];
    try {
      schedules = await loadReinspections(scope, isOnline !== false);
    } catch (error) {
      console.error('Unable to refresh reinspections:', error);
      schedules = await getReinspections(scope);
    }

    let schedule = schedules.find((candidate) => candidate.id === id);
    const sourceInspectionId = schedule?.originalInspectionId ?? id;
    let original =
      (await getStoredInspectionById(sourceInspectionId, scope)) ??
      (await getCachedInspectionById(sourceInspectionId, scope));

    if (!original && isOnline !== false) {
      try {
        original = await fetchStoredInspectionById(
          schedule?.originalInspectionId ?? id,
          scope
        );
      } catch (error) {
        console.error('Unable to load reinspection source:', error);
      }
    }

    if (!original) {
      const [localInspections, cachedInspections] = await Promise.all([
        getStoredInspections(scope).then((records) =>
          records.filter((inspection) => inspection.placeId === id)
        ),
        getCachedInspectionHistoryForPlace(id, scope),
      ]);
      const deviceInspections = mergeInspectionHistory(
        localInspections,
        cachedInspections
      );
      let inspections = deviceInspections;

      if (isOnline !== false) {
        try {
          inspections = mergeInspectionHistory(
            deviceInspections,
            await fetchInspectionHistoryForPlace(id, scope)
          );
        } catch (error) {
          console.error('Unable to load place reinspection history:', error);
        }
      }

      const candidate = inspections.find(
        (inspection) => inspection.result === 'for_reinspection'
      );
      if (candidate && 'findings' in candidate) {
        original = candidate;
      } else if (candidate && isOnline !== false) {
        try {
          original = await fetchStoredInspectionById(candidate.id, scope);
        } catch (error) {
          console.error('Unable to load complete reinspection source:', error);
        }
      }
    }

    if (original && !schedule) {
      schedule = schedules.find(
        (candidate) => candidate.originalInspectionId === original?.id
      );
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
  }, [id, isOnline, profile]);

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

    const confirmedDate = new Date(date);
    confirmedDate.setHours(12, 0, 0, 0);
    setSelectedDate(confirmedDate);
    setHasChosenDate(true);
    void saveSchedule(confirmedDate);
  };

  const saveSchedule = async (date: Date) => {
    if (!source || !profile) {
      return;
    }

    setIsSaving(true);
    setScheduleFeedback(null);

    try {
      const saved = await saveReinspectionSchedule({
        bsiUid: profile.uid,
        barangayId: profile.assignedBarangayId,
        originalInspectionId: source.id,
        placeId: source.placeId,
        scheduledDate: date.toISOString(),
      });
      setRecord(saved);
      const upload = uploadReinspection(saved).catch((uploadError) => {
        console.error('Reinspection upload deferred:', uploadError);
      });

      let trackedCalendar = null;
      try {
        trackedCalendar = await getReinspectionCalendarState(
          profile.uid,
          saved.id
        );
      } catch (calendarStateError) {
        console.error('Unable to read the tracked calendar event:', calendarStateError);
        setScheduleFeedback({
          message: 'Schedule updated. Calendar needs update.',
          tone: 'warning',
        });
        setCalendarRefreshToken((current) => current + 1);
        await upload;
        return;
      }

      if (trackedCalendar) {
        try {
          const scheduledPlace = getPlaceById(saved.placeId);
          await saveReinspectionCalendarEvent({
            userId: profile.uid,
            reinspectionId: saved.id,
            scheduledDate: saved.scheduledDate,
            placeName: scheduledPlace?.name ?? 'Scheduled place',
            address: scheduledPlace
              ? [scheduledPlace.purok, scheduledPlace.address]
                  .filter(Boolean)
                  .join(', ')
              : undefined,
            barangay: scheduledPlace?.barangay ?? profile.assignedBarangay,
            originalResult: getInspectionResultLabel(source.result),
            riskLevel: getRiskClassification(calculateInspectionRisk(source).level).label,
          });
          setScheduleFeedback({
            message: 'Schedule and calendar updated.',
            tone: 'success',
          });
        } catch (calendarError) {
          console.error('Calendar update deferred:', calendarError);
          setScheduleFeedback({
            message: 'Schedule updated. Calendar needs update.',
            tone: 'warning',
          });
        }
      } else {
        setScheduleFeedback({
          message: record ? 'Schedule updated.' : 'Reinspection scheduled.',
          tone: 'success',
        });
      }

      setCalendarRefreshToken((current) => current + 1);
      await upload;
    } catch (error) {
      console.error(
        'Unable to schedule reinspection:',
        error
      );
      Alert.alert(
        'Schedule Not Saved',
        'Please try again. The original inspection has not been changed.'
      );
      if (record) {
        setSelectedDate(new Date(record.scheduledDate));
        setHasChosenDate(true);
      } else {
        setHasChosenDate(false);
      }
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

  if (!profile) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Sign-in required</Text>
        <Text style={styles.emptyText}>
          Sign in again to view this reinspection schedule.
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
  const isOverdue = record
    ? isReinspectionOverdue(record.scheduledDate, record.status)
    : false;
  const risk = calculateInspectionRisk(source);

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
        <View style={[styles.card, styles.placeCard]}>
          <View style={styles.placeHeader}>
            <View style={styles.placeIcon}><Ionicons name="business-outline" size={24} color={COLORS.primary} /></View>
            <View style={styles.flex}>
              <Text style={styles.cardLabel}>PLACE REQUIRING FOLLOW-UP</Text>
              <Text style={styles.placeName}>{place?.name ?? 'Place not available'}</Text>
              <Text style={styles.secondaryText}>Original inspection: {formatLocalDateTime(source.inspectionDate)}</Text>
            </View>
          </View>
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
                  ? `${isOverdue ? 'Overdue since' : 'Scheduled for'} ${formatLocalDate(record.scheduledDate)}`
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
            disabled={isCompleted || isSaving}
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

          {isSaving ? (
            <View style={styles.saveStatus}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.secondaryText}>Saving schedule...</Text>
            </View>
          ) : scheduleFeedback ? (
            <View style={styles.saveStatus}>
              <Ionicons
                name={scheduleFeedback.tone === 'success' ? 'checkmark-circle' : 'alert-circle'}
                size={18}
                color={scheduleFeedback.tone === 'success' ? COLORS.compliant : COLORS.warning}
              />
              <Text style={scheduleFeedback.tone === 'success' ? styles.successText : styles.warningText}>
                {scheduleFeedback.message}
              </Text>
            </View>
          ) : (
            <Text style={styles.secondaryText}>Selecting a date saves the schedule immediately.</Text>
          )}
        </View>
        )}

        {record && !isCompleted && (
          <>
            <ReinspectionCalendarAction
              userId={profile.uid}
              reinspectionId={record.id}
              scheduledDate={record.scheduledDate}
              placeName={place?.name ?? 'Scheduled place'}
              address={
                place
                  ? [place.purok, place.address]
                      .filter(Boolean)
                      .join(', ')
                  : undefined
              }
              barangay={place?.barangay ?? profile.assignedBarangay}
              originalResult={getInspectionResultLabel(source.result)}
              riskLevel={getRiskClassification(risk.level).label}
              refreshToken={calendarRefreshToken}
            />
            <AppButton
              title="Conduct Reinspection"
              onPress={conductReinspection}
            />
          </>
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
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primarySoft,
  },
  title: { ...TYPOGRAPHY.title, color: COLORS.text },
  secondaryText: { fontSize: 12, lineHeight: 18, color: COLORS.textSecondary },
  content: { gap: SPACING.lg, padding: SPACING.lg, paddingBottom: 50 },
  card: {
    gap: SPACING.sm,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.surface,
    ...SHADOWS.subtle,
  },
  placeCard: { backgroundColor: COLORS.primarySoft, borderColor: COLORS.primaryLight },
  placeHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  placeIcon: { width: 48, height: 48, borderRadius: RADIUS.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface },
  cardLabel: { fontSize: 10, fontWeight: '800', color: COLORS.primary },
  placeName: { ...TYPOGRAPHY.subheading, color: COLORS.text },
  sectionTitle: { ...TYPOGRAPHY.subheading, color: COLORS.text },
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
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.background,
  },
  dateText: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  saveStatus: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, minHeight: 24 },
  successText: { flex: 1, fontSize: 12, lineHeight: 18, color: COLORS.compliant },
  warningText: { flex: 1, fontSize: 12, lineHeight: 18, color: COLORS.warning },
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
