import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';

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
  userLocation,
  emptyLabel = 'No saved inspection GPS yet',
}: CoverageMapProps) {
  const mapRef = useRef<MapView>(null);
  const [mapReady, setMapReady] = useState(false);
  const locations = useMemo(() => buildMapLocations(points), [points]);
  const calculatedRegion = useMemo(() => regionForLocations(locations), [locations]);
  const userRegion = userLocation ? {
    ...userLocation,
    latitudeDelta: 0.012,
    longitudeDelta: 0.012,
  } : undefined;
  const retainedRegion = useRef<Region | undefined>(calculatedRegion ?? userRegion);

  if (!retainedRegion.current && (calculatedRegion || userRegion)) {
    retainedRegion.current = calculatedRegion ?? userRegion;
  }

  const fitLocations = useCallback(() => {
    if (!mapRef.current || locations.length === 0) return;
    if (locations.length === 1) {
      mapRef.current.animateToRegion({
        latitude: locations[0].latitude,
        longitude: locations[0].longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }, 250);
      return;
    }
    mapRef.current.fitToCoordinates(
      locations.map(({ latitude, longitude }) => ({ latitude, longitude })),
      {
        edgePadding: { top: 56, right: 44, bottom: 56, left: 44 },
        animated: true,
      }
    );
  }, [locations]);

  useEffect(() => {
    if (mapReady) fitLocations();
  }, [fitLocations, mapReady]);

  const recenterOnUser = useCallback(() => {
    if (!mapRef.current || !userLocation) return;
    mapRef.current.animateToRegion({
      ...userLocation,
      latitudeDelta: 0.012,
      longitudeDelta: 0.012,
    }, 250);
  }, [userLocation]);

  useEffect(() => {
    if (mapReady && userLocation) recenterOnUser();
  }, [mapReady, recenterOnUser, userLocation]);

  if (!retainedRegion.current) {
    return <View style={styles.empty}><Text style={styles.emptyTitle}>{emptyLabel}</Text></View>;
  }

  return <View style={styles.mapShell}>
    <MapView
      ref={mapRef}
      style={styles.map}
      initialRegion={retainedRegion.current}
      onMapReady={() => setMapReady(true)}
      showsUserLocation={false}
      toolbarEnabled={false}
    >
      {locations.map((location) => <Marker
        key={location.key}
        identifier={`location-${location.key}`}
        coordinate={{ latitude: location.latitude, longitude: location.longitude }}
        pinColor={markerColor(location.points)}
        zIndex={markerPriority(location.points)}
        accessibilityLabel={markerAccessibilityLabel(location)}
        onPress={() => onSelectLocation(location)}
      />)}
      {userLocation ? <Marker
        identifier="current-device-location"
        coordinate={userLocation}
        pinColor={COLORS.indigo}
        zIndex={0}
        title="Your location"
      /> : null}
    </MapView>

    {locations.length === 0 ? (
      <View pointerEvents="none" style={styles.zeroOverlay}>
        <Text style={styles.zeroText}>{emptyLabel}</Text>
      </View>
    ) : null}

    {userLocation ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Recenter map on my location"
        onPress={recenterOnUser}
        style={({ pressed }) => [styles.recenter, pressed && styles.pressed]}
      >
        <Ionicons name="locate" size={21} color={COLORS.primary} />
      </Pressable>
    ) : null}
  </View>;
}

function regionForLocations(locations: PlaceMapLocation[]): Region | undefined {
  if (locations.length === 0) return undefined;
  const latitudes = locations.map((location) => location.latitude);
  const longitudes = locations.map((location) => location.longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  return {
    latitude: (minLatitude + maxLatitude) / 2,
    longitude: (minLongitude + maxLongitude) / 2,
    latitudeDelta: Math.max((maxLatitude - minLatitude) * 1.5, 0.02),
    longitudeDelta: Math.max((maxLongitude - minLongitude) * 1.5, 0.02),
  };
}

function markerAccessibilityLabel(location: PlaceMapLocation) {
  return location.points.length === 1
    ? `Map location for ${location.points[0].place.name}`
    : `${location.points.length} places at this location`;
}

function markerPriority(points: PlaceMapPoint[]) {
  if (points.some((point) => point.place.riskLevel === 'High' || point.place.status === 'Non-Compliant')) return 4;
  if (points.some((point) => point.place.status === 'For Reinspection')) return 3;
  if (points.some((point) => point.place.status === 'Compliant')) return 2;
  return 1;
}

function markerColor(points: PlaceMapPoint[]) {
  const priority = markerPriority(points);
  if (priority === 4) return COLORS.violation;
  if (priority === 3) return COLORS.warning;
  if (priority === 2) return COLORS.compliant;
  return COLORS.info;
}

const styles = StyleSheet.create({
  mapShell: { position: 'relative' },
  map: { width: '100%', height: 460 },
  empty: { height: 360, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl, backgroundColor: COLORS.primarySoft },
  emptyTitle: { ...TYPOGRAPHY.subheading, color: COLORS.text, textAlign: 'center' },
  zeroOverlay: { position: 'absolute', left: SPACING.md, right: SPACING.md, top: SPACING.md, alignItems: 'center', padding: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: 'rgba(255,255,255,0.92)' },
  zeroText: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, textAlign: 'center' },
  recenter: { position: 'absolute', right: SPACING.md, bottom: SPACING.md, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  pressed: { opacity: 0.72 },
});
