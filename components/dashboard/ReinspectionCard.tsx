import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS, RADIUS, SPACING } from '@/constants/theme';

type ReinspectionCardProps = {
  establishmentName: string;
  dueDate: string;
  onPress: () => void;
};

export default function ReinspectionCard({
  establishmentName,
  dueDate,
  onPress,
}: ReinspectionCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.iconContainer}>
        <Ionicons
          name="refresh-outline"
          size={22}
          color={COLORS.warning}
        />
      </View>

      <View style={styles.content}>
        <Text style={styles.name}>{establishmentName}</Text>

        <Text style={styles.date}>
          Reinspection due: {dueDate}
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
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    gap: SPACING.md,
  },

  pressed: {
    opacity: 0.7,
  },

  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
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
});
