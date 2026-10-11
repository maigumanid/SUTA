import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import OptionSelector from '@/components/admin/OptionSelector';
import CompactFilterPanel from '@/components/common/CompactFilterPanel';
import CoverageMap from '@/components/planning/CoverageMap';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useNetwork } from '@/context/NetworkContext';
import { usePlaces } from '@/context/PlacesContext';
import { fetchBarangays } from '@/services/adminService';
import { fetchPlanningSnapshot } from '@/services/fieldPlanningService';
import { getCurrentFieldLocation } from '@/services/locationService';
import type { BarangayOption } from '@/types/admin';
import type {
  FieldCoordinate,
  MapStatusFilter,
  PlaceMapLocation,
  PlaceMapPoint,
  PlanningSnapshot,
} from '@/types/fieldPlanning';
import {
  buildMapLocations,
  buildMapPoints,
  distanceBetweenCoordinatesMeters,
  formatFieldDistance,
  placeMatchesMapFilter,
} from '@/utils/fieldPlanning';
import { formatPurok } from '@/utils/placeDisplay';

const STATUS_FILTERS: readonly { value: MapStatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'not_inspected', label: 'Not Yet Inspected' },
  { value: 'compliant', label: 'Compliant' },
  { value: 'non_compliant', label: 'Non-Compliant' },
  { value: 'high_risk', label: 'High Risk' },
  { value: 'reinspection', label: 'For Reinspection' },
  { value: 'needs_completion', label: 'Needs Completion' },
];

type NearMeState = 'idle' | 'loading' | 'ready' | 'denied' | 'unavailable';

export default function FieldMapScreen() {
  const { profile } = useAuth();
  const { isOnline } = useNetwork();
  const { places } = usePlaces();
  const [snapshot, setSnapshot] = useState<PlanningSnapshot>({ places: [], inspections: [], reinspections: [] });
  const [barangays, setBarangays] = useState<BarangayOption[]>([]);
  const [barangayId, setBarangayId] = useState('all');
  const [statusFilter, setStatusFilter] = useState<MapStatusFilter>('all');
  const [purokFilter, setPurokFilter] = useState('all');
  const [selectedLocationKey, setSelectedLocationKey] = useState<string | null>(null);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<FieldCoordinate | undefined>();
  const [nearMeState, setNearMeState] = useState<NearMeState>('idle');
  const [nearMeMessage, setNearMeMessage] = useState('');
  const [navigationMessage, setNavigationMessage] = useState('');
  const [coordinatesUnavailable, setCoordinatesUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const isAdmin = profile?.role === 'admin';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (!isAdmin && isOnline === false) {
      setSnapshot({ places, inspections: [], reinspections: [] });
      setCoordinatesUnavailable(true);
      setError('Live map points need a connection.');
      setLoading(false);
      return;
    }
    try {
      const [next, options] = await Promise.all([
        fetchPlanningSnapshot(isAdmin && barangayId !== 'all' ? barangayId : undefined),
        isAdmin && barangays.length === 0 ? fetchBarangays() : Promise.resolve(barangays),
      ]);
      setSnapshot(next);
      setBarangays(options);
      setCoordinatesUnavailable(false);
    } catch (loadError) {
      if (!isAdmin) {
        setSnapshot({ places, inspections: [], reinspections: [] });
        setCoordinatesUnavailable(true);
      }
      setError(loadError instanceof Error ? loadError.message : 'Map data could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [barangayId, barangays, isAdmin, isOnline, places]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const allPoints = useMemo(() => buildMapPoints(snapshot), [snapshot]);
  const purokOptions = useMemo(() => {
    const labels = new Map<string, string>();
    snapshot.places.forEach((place) => {
      const label = place.purok.trim();
      if (label) labels.set(label.toLocaleLowerCase(), label);
    });
    return [...labels.entries()]
      .map(([value, label]) => ({ value, label: formatPurok(label) }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [snapshot.places]);

  useEffect(() => {
    if (purokFilter !== 'all' && !purokOptions.some((option) => option.value === purokFilter)) {
      setPurokFilter('all');
    }
  }, [purokFilter, purokOptions]);

  const matchingPlaces = useMemo(() => snapshot.places.filter((place) =>
    placeMatchesMapFilter(place, statusFilter) &&
    (purokFilter === 'all' || place.purok.trim().toLocaleLowerCase() === purokFilter)
  ), [purokFilter, snapshot.places, statusFilter]);
  const matchingPlaceIds = useMemo(
    () => new Set(matchingPlaces.map((place) => place.id)),
    [matchingPlaces]
  );
  const points = useMemo(
    () => allPoints.filter((point) => matchingPlaceIds.has(point.place.id)),
    [allPoints, matchingPlaceIds]
  );
  const locations = useMemo(() => buildMapLocations(points), [points]);
  const unmappedCount = Math.max(matchingPlaces.length - points.length, 0);
  const selectedLocation = selectedLocationKey
    ? locations.find((location) => location.key === selectedLocationKey)
    : undefined;
  const selectedPoint = selectedLocation?.points.find(
    (point) => point.place.id === selectedPlaceId
  );

  useEffect(() => {
    if (selectedLocationKey && !selectedLocation) {
      setSelectedLocationKey(null);
      setSelectedPlaceId(null);
    } else if (selectedPlaceId && !selectedPoint) {
      setSelectedPlaceId(null);
    }
  }, [selectedLocation, selectedLocationKey, selectedPlaceId, selectedPoint]);

  const nearestPoint = useMemo(() => {
    if (!currentLocation || points.length === 0) return undefined;
    return points
      .map((point) => ({
        point,
        distance: distanceBetweenCoordinatesMeters(currentLocation, point),
      }))
      .sort((left, right) => left.distance - right.distance)[0];
  }, [currentLocation, points]);

  const selectLocation = (location: PlaceMapLocation) => {
    setNavigationMessage('');
    setSelectedLocationKey(location.key);
    setSelectedPlaceId(location.points.length === 1 ? location.points[0].place.id : null);
  };

  const locateMe = async () => {
    setNearMeState('loading');
    setNearMeMessage('');
    const result = await getCurrentFieldLocation();
    if (result.status === 'captured' && result.location) {
      setCurrentLocation({
        latitude: result.location.latitude,
        longitude: result.location.longitude,
      });
      setNearMeState('ready');
      return;
    }
    setCurrentLocation(undefined);
    if (result.status === 'permission_denied') {
      setNearMeState('denied');
      setNearMeMessage('Location permission was not granted. The map remains available.');
      return;
    }
    setNearMeState('unavailable');
    setNearMeMessage(
      result.status === 'services_disabled'
        ? 'Device location is turned off. The map remains available.'
        : 'Current location is unavailable. The map remains available.'
    );
  };

  const openPlace = (id: string) => {
    if (!isAdmin) router.push(`/place/${id}`);
  };

  const walkToPlace = async (point: PlaceMapPoint) => {
    const { latitude, longitude } = point;
    if (!isValidCoordinate(latitude, longitude)) return;
    setNavigationMessage('');
    const destination = `${latitude},${longitude}`;
    const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=walking`;
    const preferredUrl = Platform.OS === 'android'
      ? `google.navigation:q=${encodeURIComponent(destination)}&mode=w`
      : Platform.OS === 'ios'
        ? `http://maps.apple.com/?daddr=${encodeURIComponent(destination)}&dirflg=w`
        : webUrl;
    try {
      await Linking.openURL(preferredUrl);
    } catch {
      try {
        await Linking.openURL(webUrl);
      } catch {
        setNavigationMessage('Walking directions could not be opened on this device.');
      }
    }
  };

  const countSummary = coordinatesUnavailable
    ? `${matchingPlaces.length} matching place${matchingPlaces.length === 1 ? '' : 's'} · saved GPS unavailable offline`
    : `${matchingPlaces.length} matching place${matchingPlaces.length === 1 ? '' : 's'} · ${points.length} mapped · ${locations.length} map location${locations.length === 1 ? '' : 's'} · ${unmappedCount} without GPS`;
  const emptyLabel = coordinatesUnavailable
    ? 'Saved inspection GPS is unavailable offline'
    : matchingPlaces.length === 0
      ? 'No places match these filters'
      : 'Matching places have no saved inspection GPS';

  return <View style={styles.screen}><ScrollView ref={scrollRef} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" style={styles.back}><Ionicons name="arrow-back" size={22} color={COLORS.text} /></Pressable>
      <View style={styles.flex}><Text style={styles.title}>Field map</Text><Text style={styles.subtitle}>Shows real inspection-captured locations only.</Text></View>
    </View>

    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
      {STATUS_FILTERS.map((filter) => {
        const selected = statusFilter === filter.value;
        return <Pressable
          key={filter.value}
          accessibilityRole="button"
          accessibilityState={{ selected }}
          onPress={() => setStatusFilter(filter.value)}
          style={({ pressed }) => [styles.filterChip, selected && styles.filterChipSelected, pressed && styles.pressed]}
        >
          {selected ? <Ionicons name="checkmark" size={15} color={COLORS.textOnPrimary} /> : null}
          <Text style={[styles.filterChipText, selected && styles.filterChipTextSelected]}>{filter.label}</Text>
        </Pressable>;
      })}
    </ScrollView>

    {isAdmin || purokOptions.length > 0 ? <View style={styles.areaFilters}><CompactFilterPanel
      activeCount={Number(isAdmin && barangayId !== 'all') + Number(purokFilter !== 'all')}
      summary={[
        isAdmin && barangayId !== 'all' ? barangays.find((item) => item.id === barangayId)?.name : null,
        purokFilter !== 'all' ? purokOptions.find((item) => item.value === purokFilter)?.label : null,
      ].filter(Boolean).join(' · ') || 'All areas'}
      onClear={() => { if (isAdmin) setBarangayId('all'); setPurokFilter('all'); }}
    >
      {isAdmin ? <OptionSelector label="MAP SCOPE" value={barangayId} options={[{ value: 'all', label: 'All barangays' }, ...barangays.map((item) => ({ value: item.id, label: item.name }))]} onChange={setBarangayId} loading={loading && barangays.length === 0} /> : null}
      {purokOptions.length > 0 ? <View style={styles.purokRow}>
          <Text style={styles.purokLabel}>PUROK</Text>
          {[{ value: 'all', label: 'All' }, ...purokOptions].map((option) => {
            const selected = purokFilter === option.value;
            return <Pressable key={option.value} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => setPurokFilter(option.value)} style={({ pressed }) => [styles.purokChip, selected && styles.purokChipSelected, pressed && styles.pressed]}><Text style={[styles.purokChipText, selected && styles.purokChipTextSelected]}>{selected ? '✓ ' : ''}{option.label}</Text></Pressable>;
          })}
      </View> : null}
    </CompactFilterPanel></View> : null}

    <View style={styles.locationTools}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: nearMeState === 'ready', busy: nearMeState === 'loading' }}
        disabled={nearMeState === 'loading'}
        onPress={() => void locateMe()}
        style={({ pressed }) => [styles.nearMeButton, nearMeState === 'ready' && styles.nearMeButtonReady, pressed && styles.pressed]}
      >
        {nearMeState === 'loading' ? <ActivityIndicator size="small" color={COLORS.primary} /> : <Ionicons name={nearMeState === 'ready' ? 'checkmark-circle' : 'navigate-outline'} size={18} color={COLORS.primary} />}
        <Text style={styles.nearMeText}>{nearMeState === 'ready' ? 'Near me on' : 'Near me'}</Text>
      </Pressable>
      {nearestPoint ? <Text numberOfLines={1} style={styles.nearestText}>Nearest: {nearestPoint.point.place.name} · {formatFieldDistance(nearestPoint.distance)}</Text> : null}
    </View>

    {nearMeMessage ? <View style={styles.locationNotice}><Ionicons name="information-circle-outline" size={17} color={COLORS.info} /><Text style={styles.locationNoticeText}>{nearMeMessage}</Text></View> : null}
    {error ? <View style={styles.notice}><Ionicons name="cloud-offline-outline" size={20} color={COLORS.warning} /><Text style={styles.noticeText}>{error}</Text></View> : null}

    <View style={styles.mapFrame}>
      <View style={styles.mapMetaRow}><Text style={styles.mapMeta}>{countSummary}</Text>{loading ? <ActivityIndicator size="small" color={COLORS.primary} /> : null}</View>
      <CoverageMap
        points={points}
        onSelectLocation={selectLocation}
        userLocation={currentLocation}
        emptyLabel={emptyLabel}
      />
      <View style={styles.legend}><Legend color={COLORS.compliant} label="Compliant" /><Legend color={COLORS.warning} label="Reinspection" /><Legend color={COLORS.violation} label="High risk / non-compliant" /><Legend color={COLORS.info} label="Not inspected" />{currentLocation ? <Legend color={COLORS.indigo} label="Your location" /> : null}</View>
    </View>

    {selectedLocation ? (
      <View onLayout={(event) => {
        const previewY = event.nativeEvent.layout.y;
        requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: Math.max(previewY - 72, 0), animated: true }));
      }}>
        <PlacePreview
          canOpenPlace={!isAdmin}
          currentLocation={currentLocation}
          location={selectedLocation}
          navigationMessage={navigationMessage}
          selectedPoint={selectedPoint}
          onChoosePlace={setSelectedPlaceId}
          onClose={() => { setSelectedLocationKey(null); setSelectedPlaceId(null); setNavigationMessage(''); }}
          onOpenPlace={openPlace}
          onWalkToPlace={(point) => void walkToPlace(point)}
        />
      </View>
    ) : null}

    <Text style={styles.helper}>Only places with saved inspection GPS appear on the map.</Text>
  </ScrollView></View>;
}

function PlacePreview({
  location,
  selectedPoint,
  currentLocation,
  canOpenPlace,
  navigationMessage,
  onChoosePlace,
  onClose,
  onOpenPlace,
  onWalkToPlace,
}: {
  location: PlaceMapLocation;
  selectedPoint?: PlaceMapPoint;
  currentLocation?: FieldCoordinate;
  canOpenPlace: boolean;
  navigationMessage: string;
  onChoosePlace: (id: string | null) => void;
  onClose: () => void;
  onOpenPlace: (id: string) => void;
  onWalkToPlace: (point: PlaceMapPoint) => void;
}) {
  const orderedPoints = useMemo(() => [...location.points].sort((left, right) => {
    if (currentLocation) {
      return distanceBetweenCoordinatesMeters(currentLocation, left) -
        distanceBetweenCoordinatesMeters(currentLocation, right);
    }
    return left.place.name.localeCompare(right.place.name);
  }), [currentLocation, location.points]);

  return <View style={styles.preview}>
    <View style={styles.previewHeader}>
      <View style={styles.flex}>
        <Text style={styles.previewEyebrow}>{location.points.length > 1 ? `${location.points.length} places at this location` : 'Mapped place'}</Text>
        <Text style={styles.previewTitle}>{selectedPoint?.place.name ?? (location.points.length > 1 ? 'Choose a place' : location.points[0].place.name)}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Close place preview" hitSlop={8} onPress={onClose} style={styles.closePreview}><Ionicons name="close" size={21} color={COLORS.textSecondary} /></Pressable>
    </View>

    {!selectedPoint && location.points.length > 1 ? (
      <View style={styles.groupList}>
        {orderedPoints.map((point) => <Pressable
          key={point.place.id}
          accessibilityRole="button"
          onPress={() => onChoosePlace(point.place.id)}
          style={({ pressed }) => [styles.groupRow, pressed && styles.pressed]}
        >
          <View style={styles.flex}>
            <Text numberOfLines={1} style={styles.groupName}>{point.place.name}</Text>
            <Text style={styles.groupMeta}>{point.place.status}{currentLocation ? ` · ${formatFieldDistance(distanceBetweenCoordinatesMeters(currentLocation, point))}` : ''}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
        </Pressable>)}
      </View>
    ) : selectedPoint ? (
      <>
        {location.points.length > 1 ? <Pressable accessibilityRole="button" onPress={() => onChoosePlace(null)} style={styles.backToGroup}><Ionicons name="arrow-back" size={16} color={COLORS.primary} /><Text style={styles.backToGroupText}>Back to places here</Text></Pressable> : null}
        <View style={styles.placeMetaRow}>
          <StatusChip point={selectedPoint} />
          {currentLocation ? <Text style={styles.distanceText}>{formatFieldDistance(distanceBetweenCoordinatesMeters(currentLocation, selectedPoint))} away</Text> : null}
        </View>
        <Text style={styles.previewMeta}>{selectedPoint.place.representativeName || 'Representative not recorded'} · {formatPurok(selectedPoint.place.purok)}</Text>
        <Text numberOfLines={2} style={styles.previewAddress}>{selectedPoint.place.address}</Text>
        {navigationMessage ? <Text style={styles.navigationMessage}>{navigationMessage}</Text> : null}
        <View style={styles.previewActions}>
          {canOpenPlace ? <Pressable accessibilityRole="button" onPress={() => onOpenPlace(selectedPoint.place.id)} style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}><Ionicons name="document-text-outline" size={18} color={COLORS.primary} /><Text style={styles.secondaryActionText}>Open record</Text></Pressable> : null}
          <Pressable accessibilityRole="button" onPress={() => onWalkToPlace(selectedPoint)} style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}><Ionicons name="walk-outline" size={18} color={COLORS.textOnPrimary} /><Text style={styles.primaryActionText}>Walk to place</Text></Pressable>
        </View>
      </>
    ) : null}
  </View>;
}

function StatusChip({ point }: { point: PlaceMapPoint }) {
  const highRisk = point.place.riskLevel === 'High';
  const label = highRisk ? 'High Risk' : point.place.status;
  const tone = highRisk || point.place.status === 'Non-Compliant'
    ? { backgroundColor: COLORS.violationSoft, color: COLORS.violationDark }
    : point.place.status === 'For Reinspection'
      ? { backgroundColor: COLORS.warningSoft, color: COLORS.warningDark }
      : point.place.status === 'Compliant'
        ? { backgroundColor: COLORS.compliantSoft, color: COLORS.compliantDark }
        : { backgroundColor: COLORS.infoSoft, color: COLORS.infoDark };
  return <View style={[styles.statusChip, { backgroundColor: tone.backgroundColor }]}><Text style={[styles.statusChipText, { color: tone.color }]}>{label}</Text></View>;
}

function Legend({ color, label }: { color: string; label: string }) {
  return <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: color }]} /><Text style={styles.legendText}>{label}</Text></View>;
}

function isValidCoordinate(latitude: number, longitude: number) {
  return Number.isFinite(latitude) && Number.isFinite(longitude) &&
    latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: SPACING.lg, paddingBottom: SPACING.section },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.lg },
  back: { width: 44, height: 44, borderRadius: RADIUS.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  flex: { flex: 1, minWidth: 0 },
  title: { ...TYPOGRAPHY.display, color: COLORS.text },
  subtitle: { ...TYPOGRAPHY.bodySmall, color: COLORS.textSecondary, marginTop: 2 },
  filterRow: { gap: SPACING.sm, paddingBottom: SPACING.sm },
  filterChip: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, paddingHorizontal: SPACING.md, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  filterChipSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  filterChipText: { ...TYPOGRAPHY.caption, fontWeight: '700', color: COLORS.textSecondary },
  filterChipTextSelected: { color: COLORS.textOnPrimary },
  areaFilters: { marginBottom: SPACING.sm },
  purokRow: { minHeight: 36, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SPACING.xs },
  purokLabel: { width: '100%', ...TYPOGRAPHY.label, color: COLORS.textMuted },
  purokChip: { minHeight: 40, justifyContent: 'center', paddingHorizontal: SPACING.sm, borderRadius: RADIUS.pill, backgroundColor: COLORS.surfaceMuted },
  purokChipSelected: { backgroundColor: COLORS.primarySoft, borderWidth: 1, borderColor: COLORS.primary },
  purokChipText: { ...TYPOGRAPHY.tiny, fontWeight: '700', color: COLORS.textSecondary },
  purokChipTextSelected: { color: COLORS.primary },
  locationTools: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.sm },
  nearMeButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, paddingHorizontal: SPACING.md, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  nearMeButtonReady: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  nearMeText: { ...TYPOGRAPHY.caption, fontWeight: '800', color: COLORS.primary },
  nearestText: { ...TYPOGRAPHY.caption, flex: 1, color: COLORS.textSecondary },
  locationNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, paddingBottom: SPACING.sm },
  locationNoticeText: { ...TYPOGRAPHY.caption, flex: 1, color: COLORS.textSecondary },
  notice: { flexDirection: 'row', gap: SPACING.sm, padding: SPACING.md, marginBottom: SPACING.md, borderRadius: RADIUS.lg, backgroundColor: COLORS.warningSoft },
  noticeText: { ...TYPOGRAPHY.caption, flex: 1, color: COLORS.warningDark },
  mapFrame: { borderRadius: RADIUS.xxl, overflow: 'hidden', backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.card },
  mapMetaRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  mapMeta: { ...TYPOGRAPHY.caption, flex: 1, lineHeight: 17, fontWeight: '700', color: COLORS.textSecondary },
  legend: { flexDirection: 'row', flexWrap: 'wrap', rowGap: SPACING.sm, columnGap: SPACING.md, padding: SPACING.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { ...TYPOGRAPHY.tiny, color: COLORS.textSecondary },
  preview: { marginTop: SPACING.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, borderLeftWidth: 3, borderLeftColor: COLORS.primary, borderRadius: RADIUS.lg, backgroundColor: COLORS.surface },
  previewHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md },
  previewEyebrow: { ...TYPOGRAPHY.tiny, fontWeight: '800', color: COLORS.primary, textTransform: 'uppercase', letterSpacing: 0.6 },
  previewTitle: { ...TYPOGRAPHY.subheading, color: COLORS.text, marginTop: 2 },
  closePreview: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill },
  groupList: { marginTop: SPACING.sm },
  groupRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.divider, paddingVertical: SPACING.sm },
  groupName: { ...TYPOGRAPHY.bodySmall, fontWeight: '700', color: COLORS.text },
  groupMeta: { ...TYPOGRAPHY.tiny, color: COLORS.textSecondary, marginTop: 2 },
  backToGroup: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, alignSelf: 'flex-start', marginTop: SPACING.xs },
  backToGroupText: { ...TYPOGRAPHY.caption, fontWeight: '700', color: COLORS.primary },
  placeMetaRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.sm },
  statusChip: { alignSelf: 'flex-start', borderRadius: RADIUS.pill, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs },
  statusChipText: { ...TYPOGRAPHY.tiny, fontWeight: '800' },
  distanceText: { ...TYPOGRAPHY.tiny, color: COLORS.textSecondary },
  previewMeta: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginTop: SPACING.sm },
  previewAddress: { ...TYPOGRAPHY.bodySmall, color: COLORS.text, marginTop: SPACING.xs },
  navigationMessage: { ...TYPOGRAPHY.caption, color: COLORS.violation, marginTop: SPACING.sm },
  previewActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  secondaryAction: { minHeight: 44, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs, borderWidth: 1, borderColor: COLORS.primary, borderRadius: RADIUS.md, paddingHorizontal: SPACING.sm },
  secondaryActionText: { ...TYPOGRAPHY.caption, fontWeight: '800', color: COLORS.primary },
  primaryAction: { minHeight: 44, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs, borderRadius: RADIUS.md, paddingHorizontal: SPACING.sm, backgroundColor: COLORS.primary },
  primaryActionText: { ...TYPOGRAPHY.caption, fontWeight: '800', color: COLORS.textOnPrimary },
  helper: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, textAlign: 'center', marginTop: SPACING.md, paddingHorizontal: SPACING.md },
  pressed: { opacity: 0.72 },
});
