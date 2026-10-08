import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { formatLocalDate } from '@/utils/dateTime';
import { isReinspectionOverdue } from '@/utils/reinspection';

type ReinspectionCardProps = {
  establishmentName: string;
  scheduledDate: string;
  onPress: () => void;
};

export default function ReinspectionCard({
  establishmentName,
  scheduledDate,
  onPress,
}: ReinspectionCardProps) {
  const overdue = isReinspectionOverdue(scheduledDate, 'pending');

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.iconContainer, overdue && styles.overdueIcon]}>
        <Ionicons
          name="refresh-outline"
          size={22}
          color={overdue ? COLORS.violation : COLORS.warning}
        />
      </View>

      <View style={styles.content}>
        <Text style={styles.name}>{establishmentName}</Text>

        <Text style={[styles.date, overdue && styles.overdueDate]}>
          {overdue ? 'Overdue' : 'Due'}: {formatLocalDate(scheduledDate)}
        </Text>
      </View>

      <Ionicons
        name="chevron-forward"
        size={20}
        color={COLORS.textMuted}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    gap: SPACING.md,
    ...SHADOWS.subtle,
  },

  pressed: {
    opacity: 0.7,
  },

  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.warningSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  overdueIcon: {
    backgroundColor: COLORS.violationSoft,
  },

  content: {
    flex: 1,
  },

  name: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },

  date: {
    marginTop: 4,
    fontSize: 13,
    color: COLORS.textSecondary,
  },

  overdueDate: {
    color: COLORS.violation,
    fontWeight: '700',
  },
});
