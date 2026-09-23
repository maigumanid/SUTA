import { Ionicons } from '@expo/vector-icons';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import RiskBadge from './RiskBadge';

import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { Place } from '@/types/place';

type PlaceCardProps = {
  place: Place;
  onPress: () => void;
};

export default function PlaceCard({
  place,
  onPress,
}: PlaceCardProps) {
  const isHousehold =
    place.placeType === 'Household / Residence';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons
            name={
              isHousehold
                ? 'home-outline'
                : 'business-outline'
            }
            size={22}
            color={COLORS.primary}
          />
        </View>

        <View style={styles.content}>
          <Text style={styles.name}>
            {place.name}
          </Text>

          <Text style={styles.type}>
            {place.placeType}
          </Text>
        </View>

        <RiskBadge level={place.riskLevel} />
      </View>

      <View style={styles.infoRow}>
        <Ionicons
          name="person-outline"
          size={16}
          color={COLORS.textSecondary}
        />

        <Text style={styles.infoText}>
          {place.representativeName}
        </Text>
      </View>

      <View style={styles.infoRow}>
        <Ionicons
          name="location-outline"
          size={16}
          color={COLORS.textSecondary}
        />

        <Text style={styles.infoText}>
          {place.purok}
        </Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.status}>
          {place.status}
        </Text>

        <Ionicons
          name="chevron-forward"
          size={20}
          color={COLORS.textMuted}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.sm,
  },

  pressed: {
    opacity: 0.7,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },

  iconContainer: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primarySoft,
  },

  content: {
    flex: 1,
  },

  name: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },

  type: {
    marginTop: 2,
    fontSize: 12,
    color: COLORS.textSecondary,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },

  infoText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textSecondary,
  },

  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    paddingTop: SPACING.sm,
    marginTop: 2,
  },

  status: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
});
