import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import type {
  FieldCoordinate,
  PlaceMapLocation,
  PlaceMapPoint,
} from '@/types/fieldPlanning';
import { buildMapLocations } from '@/utils/fieldPlanning';

type CoverageMapProps = {
  points: PlaceMapPoint[];
  onSelectLocation: (location: PlaceMapLocation) => void;
  userLocation?: FieldCoordinate;
  emptyLabel?: string;
};

export default function CoverageMap({
  points,
  onSelectLocation,
  emptyLabel = 'No saved inspection GPS yet',
}: CoverageMapProps) {
  const locations = buildMapLocations(points);

  return <View style={styles.fallback}>
    <Ionicons name="map-outline" size={30} color={COLORS.primary} />
    <Text style={styles.title}>Map available on Android and iOS</Text>
    <Text style={styles.text}>
      {locations.length === 0
        ? emptyLabel
        : `${points.length} mapped place${points.length === 1 ? '' : 's'} across ${locations.length} location${locations.length === 1 ? '' : 's'}`}
    </Text>
    {locations.length > 0 ? (
      <ScrollView style={styles.locationList} contentContainerStyle={styles.locationListContent}>
        {locations.map((location) => (
          <Pressable
            key={location.key}
            accessibilityRole="button"
            onPress={() => onSelectLocation(location)}
            style={({ pressed }) => [styles.locationRow, pressed && styles.pressed]}
          >
            <Text numberOfLines={1} style={styles.locationName}>
              {location.points.length === 1
                ? location.points[0].place.name
                : `${location.points.length} places at this location`}
            </Text>
            <Ionicons name="chevron-forward" size={17} color={COLORS.primary} />
          </Pressable>
        ))}
      </ScrollView>
    ) : null}
  </View>;
}

const styles = StyleSheet.create({
  fallback: { minHeight: 300, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl, backgroundColor: COLORS.primarySoft },
  title: { ...TYPOGRAPHY.subheading, color: COLORS.text, textAlign: 'center', marginTop: SPACING.md },
  text: { ...TYPOGRAPHY.bodySmall, color: COLORS.textSecondary, textAlign: 'center', marginTop: SPACING.xs, maxWidth: 420 },
  locationList: { width: '100%', maxWidth: 440, maxHeight: 180, marginTop: SPACING.md },
  locationListContent: { gap: SPACING.xs },
  locationRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.md, borderRadius: RADIUS.md, backgroundColor: COLORS.surface },
  locationName: { ...TYPOGRAPHY.caption, flex: 1, fontWeight: '700', color: COLORS.text },
  pressed: { opacity: 0.72 },
});
