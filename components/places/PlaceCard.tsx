import { Ionicons } from '@expo/vector-icons';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import RiskBadge from './RiskBadge';

import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { Place } from '@/types/place';
import { formatPurok } from '@/utils/placeDisplay';

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
  const purokLabel = formatPurok(place.purok);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${place.name}, ${place.status}, ${place.riskLevel} risk`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.header}>
        <View style={styles.content}>
          <Text numberOfLines={2} style={styles.name}>
            {place.name}
          </Text>
        </View>

        <RiskBadge level={place.riskLevel} />
      </View>

      <View style={styles.typeRow}>
        <Ionicons name={isHousehold ? 'home-outline' : 'business-outline'} size={15} color={COLORS.primary} />
        <Text style={styles.type}>{place.placeType}</Text>
        {place.profileStatus === 'starter' ? <View style={styles.starterBadge}><Ionicons name="create-outline" size={12} color={COLORS.warningDark} /><Text style={styles.starterBadgeText}>Needs completion</Text></View> : null}
      </View>

      <View style={styles.infoRow}>
        <Ionicons
          name="person-outline"
          size={16}
          color={COLORS.textSecondary}
        />

        <Text numberOfLines={2} style={styles.infoText}>
          {place.representativeName || 'Representative not recorded'}
        </Text>
      </View>

      <View style={styles.infoRow}>
        <Ionicons
          name="location-outline"
          size={16}
          color={COLORS.textSecondary}
        />

        <Text style={styles.infoText}>
          {purokLabel}
        </Text>
      </View>

      <View style={styles.footer}>
        <View style={[styles.statusGroup, place.status === 'Non-Compliant' && styles.statusGroupDanger, place.status === 'For Reinspection' && styles.statusGroupWarning]}>
          <Text style={[styles.status, place.status === 'Non-Compliant' && styles.statusDanger, place.status === 'For Reinspection' && styles.statusWarning]}>{place.status}</Text>
        </View>

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
    borderRadius: RADIUS.xl,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
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

  content: {
    flex: 1,
  },

  name: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.text,
  },

  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  type: {
    ...TYPOGRAPHY.caption,
    marginTop: 2,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  starterBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 'auto', paddingHorizontal: 7, paddingVertical: 3, borderRadius: RADIUS.pill, backgroundColor: COLORS.warningSoft },
  starterBadgeText: { fontSize: 10, fontWeight: '800', color: COLORS.warningDark },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },

  infoText: {
    ...TYPOGRAPHY.caption,
    flex: 1,
    color: COLORS.textSecondary,
  },

  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    paddingTop: SPACING.sm,
  },

  statusGroup: { minHeight: 28, justifyContent: 'center', paddingHorizontal: SPACING.sm, borderRadius: RADIUS.pill, backgroundColor: COLORS.primarySoft },
  statusGroupDanger: { backgroundColor: COLORS.violationSoft },
  statusGroupWarning: { backgroundColor: COLORS.warningSoft },

  status: {
    ...TYPOGRAPHY.label,
    fontSize: 12,
    color: COLORS.primary,
  },
  statusDanger: { color: COLORS.violation },
  statusWarning: { color: COLORS.warning },
});
