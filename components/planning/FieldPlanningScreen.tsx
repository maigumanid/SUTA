import { Ionicons } from '@expo/vector-icons';
import { type Href, router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import OptionSelector from '@/components/admin/OptionSelector';
import EmptyState from '@/components/common/EmptyState';
import EntranceTransition from '@/components/common/EntranceTransition';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useNetwork } from '@/context/NetworkContext';
import { usePlaces } from '@/context/PlacesContext';
import { fetchBarangays } from '@/services/adminService';
import { fetchPlanningSnapshot } from '@/services/fieldPlanningService';
import { loadReinspections } from '@/services/reinspectionService';
import type { BarangayOption } from '@/types/admin';
import type { PlanningSnapshot, QueueCategory, WorkQueueItem } from '@/types/fieldPlanning';
import { buildCoverage, buildWorkQueue, filterWorkQueue } from '@/utils/fieldPlanning';
import { formatPurok } from '@/utils/placeDisplay';

const QUEUE_FILTERS: { value: QueueCategory; label: string }[] = [
  { value: 'all', label: 'Priority' },
  { value: 'follow_up', label: 'Follow-ups' },
  { value: 'risk', label: 'High risk' },
  { value: 'uninspected', label: 'Never inspected' },
  { value: 'incomplete', label: 'Needs details' },
];

export default function FieldPlanningScreen() {
  const { profile } = useAuth();
  const { isOnline } = useNetwork();
  const { places } = usePlaces();
  const [snapshot, setSnapshot] = useState<PlanningSnapshot>({ places: [], inspections: [], reinspections: [] });
  const [barangays, setBarangays] = useState<BarangayOption[]>([]);
  const [barangayId, setBarangayId] = useState('all');
  const [queueFilter, setQueueFilter] = useState<QueueCategory>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isAdmin = profile?.role === 'admin';

  const load = useCallback(async (pull = false) => {
    if (!profile) return;
    if (pull) setRefreshing(true);
    else setLoading(true);
    setError(null);
    if (!isAdmin && profile.role === 'bsi' && isOnline === false) {
      const localReinspections = await loadReinspections(
        { bsiUid: profile.uid, barangayId: profile.assignedBarangayId },
        false
      );
      setSnapshot({ places, inspections: [], reinspections: localReinspections.map((item) => ({ id: item.id, placeId: item.placeId, scheduledDate: item.scheduledDate, status: item.status })) });
      setError('Showing the field plan stored on this device. Map points and server updates need a connection.');
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const selectedBarangay = isAdmin && barangayId !== 'all' ? barangayId : undefined;
      const [nextSnapshot, nextBarangays] = await Promise.all([
        fetchPlanningSnapshot(selectedBarangay),
        isAdmin && barangays.length === 0 ? fetchBarangays() : Promise.resolve(barangays),
      ]);
      setSnapshot(nextSnapshot);
      setBarangays(nextBarangays);
    } catch (loadError) {
      if (!isAdmin && profile.role === 'bsi') {
        const localReinspections = await loadReinspections(
          { bsiUid: profile.uid, barangayId: profile.assignedBarangayId },
          false
        );
        setSnapshot({
          places,
          inspections: [],
          reinspections: localReinspections.map((item) => ({
            id: item.id,
            placeId: item.placeId,
            scheduledDate: item.scheduledDate,
            status: item.status,
          })),
        });
        setError('Showing the field plan stored on this device. Map points and server updates need a connection.');
      } else {
        setError(loadError instanceof Error ? loadError.message : 'The field plan could not be loaded.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [barangayId, barangays, isAdmin, isOnline, places, profile]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const coverage = useMemo(() => buildCoverage(snapshot), [snapshot]);
  const queue = useMemo(() => buildWorkQueue(snapshot), [snapshot]);
  const visibleQueue = useMemo(() => filterWorkQueue(queue, queueFilter), [queue, queueFilter]);
  const scopeName = isAdmin
    ? barangayId === 'all' ? profile?.jurisdictionName ?? 'Municipality-wide' : barangays.find((item) => item.id === barangayId)?.name ?? 'Selected barangay'
    : profile?.assignedBarangay ?? 'Assigned barangay';

  return (
    <View style={styles.screen}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} colors={[COLORS.primary]} tintColor={COLORS.primary} />}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}><Text style={styles.eyebrow}>FIELD PLAN · {scopeName.toUpperCase()}</Text><Text style={styles.title}>Coverage into action</Text><Text style={styles.subtitle}>See what remains, then move directly to the next useful task.</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Close field plan" onPress={() => router.back()} style={styles.close}><Ionicons name="close" size={24} color={COLORS.text} /></Pressable>
        </View>

        {isAdmin ? (
          <View style={styles.adminFilter}>
            <OptionSelector
              label="COVERAGE SCOPE"
              value={barangayId}
              options={[{ value: 'all', label: 'All barangays' }, ...barangays.map((item) => ({ value: item.id, label: item.name }))]}
              onChange={(value) => setBarangayId(value)}
              loading={loading && barangays.length === 0}
              errorMessage={null}
            />
          </View>
        ) : null}

        {loading && snapshot.places.length === 0 ? <View style={styles.loading}><ActivityIndicator color={COLORS.primary} /><Text style={styles.body}>Building today’s field plan…</Text></View> : (
          <>
            {error ? <View style={styles.notice}><Ionicons name={isOnline ? 'alert-circle-outline' : 'cloud-offline-outline'} size={20} color={COLORS.warning} /><Text style={styles.noticeText}>{error}</Text></View> : null}
            <EntranceTransition>
              <View style={styles.coverageHero}>
                <View style={styles.coverageTop}>
                  <View style={styles.ring}><View style={styles.ringInner}><Text style={styles.percent}>{coverage.completionPercent}%</Text><Text style={styles.ringLabel}>INSPECTED</Text></View></View>
                  <View style={styles.coverageCopy}><Text style={styles.coverageKicker}>REGISTER COVERAGE</Text><Text style={styles.coverageStatement}>{coverage.inspected} of {coverage.total} places have a completed inspection.</Text><Text style={styles.coverageHint}>{coverage.uninspected ? `${coverage.uninspected} still need a first visit.` : 'Every registered place has an inspection.'}</Text></View>
                </View>
                <View style={styles.ledger}>
                  <CoverageLine label="In scope" value={coverage.total} color={COLORS.text} />
                  <CoverageLine label="Never inspected" value={coverage.uninspected} color={COLORS.info} onPress={() => setQueueFilter('uninspected')} />
                  <CoverageLine label="Pending reinspections" value={coverage.pendingReinspections} color={COLORS.warning} onPress={() => setQueueFilter('follow_up')} />
                  <CoverageLine label="High risk / non-compliant" value={coverage.urgent} color={COLORS.violation} onPress={() => setQueueFilter('risk')} last />
                </View>
              </View>
            </EntranceTransition>

            <View style={styles.actionStrip}>
              <Pressable onPress={() => router.push('/field-map' as Href)} style={({ pressed }) => [styles.mapAction, pressed && styles.pressed]}><View style={styles.actionMotif}><Ionicons name="map" size={24} color={COLORS.primary} /><View style={styles.motifDot} /></View><View style={styles.flex}><Text style={styles.actionTitle}>Open coverage map</Text><Text style={styles.actionText}>Real captured inspection points and unmapped places</Text></View><Ionicons name="arrow-forward" size={20} color={COLORS.primary} /></Pressable>
              {!isAdmin ? <Pressable onPress={() => router.push('/place/import')} style={({ pressed }) => [styles.importAction, pressed && styles.pressed]}><Ionicons name="cloud-upload-outline" size={20} color={COLORS.white} /><Text style={styles.importActionText}>Import census list</Text></Pressable> : null}
            </View>

            <View style={styles.queueHeader}><View style={styles.flex}><Text style={styles.sectionTitle}>Smart work queue</Text><Text style={styles.body}>Prioritized fieldwork for this scope.</Text></View><View style={styles.queueCount}><Text style={styles.queueCountText}>{visibleQueue.length}</Text></View></View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
              {QUEUE_FILTERS.map((filter) => {
                const selected = queueFilter === filter.value;
                return <Pressable key={filter.value} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => setQueueFilter(filter.value)} style={[styles.filter, selected && styles.filterActive]}>
                  {selected ? <Ionicons name="checkmark" size={15} color={COLORS.white} /> : null}
                  <Text style={[styles.filterText, selected && styles.filterTextActive]}>{filter.label}</Text>
                </Pressable>;
              })}
            </ScrollView>
            <View style={styles.queueList}>
              {visibleQueue.map((item, index) => <EntranceTransition key={item.place.id} delay={Math.min(index * 35, 210)}><QueueRow item={item} isAdmin={isAdmin} /></EntranceTransition>)}
              {visibleQueue.length === 0 ? <EmptyState compact icon="checkmark-done-outline" title="No work in this view" description="Change the queue filter or pull down to refresh current field records." /> : null}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function CoverageLine({ label, value, color, onPress, last = false }: { label: string; value: number; color: string; onPress?: () => void; last?: boolean }) {
  return <Pressable disabled={!onPress} onPress={onPress} style={[styles.coverageLine, last && styles.coverageLineLast]}><View style={[styles.ledgerMark, { backgroundColor: color }]} /><Text style={styles.coverageLabel}>{label}</Text><Text style={[styles.coverageValue, { color }]}>{value}</Text>{onPress ? <Ionicons name="chevron-forward" size={17} color={COLORS.textMuted} /> : null}</Pressable>;
}

function QueueRow({ item, isAdmin }: { item: WorkQueueItem; isAdmin: boolean }) {
  const icon = item.category === 'follow_up' ? 'time' : item.category === 'risk' ? 'warning' : item.category === 'incomplete' ? 'create' : 'footsteps';
  const actionLabel = isAdmin
    ? 'Review record'
    : item.category === 'follow_up'
      ? 'Open follow-up'
      : item.category === 'incomplete'
        ? 'Complete profile'
        : item.category === 'uninspected'
          ? 'Start inspection'
          : 'Review record';
  const dangerStatus = item.category === 'risk';
  const warningStatus = item.category === 'follow_up';
  const act = () => {
    if (isAdmin) {
      router.push('/(admin)/admin-inspections');
    } else if (item.category === 'incomplete') {
      router.push(`/place/edit/${item.place.id}` as Href);
    } else {
      router.push(`/place/${item.place.id}`);
    }
  };
  return <Pressable accessibilityRole="button" onPress={act} style={({ pressed }) => [styles.queueRow, pressed && styles.pressed]}>
    <View style={styles.queueIcon}><Ionicons name={icon} size={18} color={dangerStatus ? COLORS.violation : COLORS.primary} /></View>
    <View style={styles.queueContent}>
      <View style={styles.queueTop}><Text numberOfLines={2} style={styles.placeName}>{item.place.name}</Text><View style={[styles.statusBadge, dangerStatus && styles.statusBadgeDanger, warningStatus && styles.statusBadgeWarning]}><Text numberOfLines={1} style={[styles.status, dangerStatus && styles.statusDanger, warningStatus && styles.statusWarning]}>{item.status}</Text></View></View>
      <Text numberOfLines={1} style={[styles.reason, dangerStatus && styles.reasonDanger, warningStatus && styles.reasonWarning]}>{item.reason}</Text>
      <Text numberOfLines={1} style={styles.location}>{item.place.representativeName || 'Representative not recorded'} · {formatPurok(item.place.purok)}</Text>
      <View style={styles.actionRow}><Text style={styles.actionLabel}>{actionLabel}</Text><Ionicons name="arrow-forward" size={17} color={COLORS.primary} /></View>
    </View>
  </Pressable>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background }, content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: SPACING.lg, paddingBottom: SPACING.section },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md, marginBottom: SPACING.xl }, headerCopy: { flex: 1 }, eyebrow: { ...TYPOGRAPHY.tiny, fontWeight: '800', letterSpacing: 1.1, color: COLORS.primary }, title: { ...TYPOGRAPHY.display, color: COLORS.text, marginTop: 2 }, subtitle: { ...TYPOGRAPHY.bodySmall, color: COLORS.textSecondary, marginTop: SPACING.xs },
  close: { width: 44, height: 44, borderRadius: RADIUS.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  adminFilter: { marginBottom: SPACING.xl }, loading: { minHeight: 280, alignItems: 'center', justifyContent: 'center', gap: SPACING.md }, body: { ...TYPOGRAPHY.bodySmall, color: COLORS.textSecondary, marginTop: 3 },
  notice: { flexDirection: 'row', gap: SPACING.sm, padding: SPACING.md, borderRadius: RADIUS.lg, backgroundColor: COLORS.warningSoft, marginBottom: SPACING.lg }, noticeText: { ...TYPOGRAPHY.caption, flex: 1, color: COLORS.warningDark },
  coverageHero: { backgroundColor: COLORS.primaryDeep, borderRadius: RADIUS.xxl, overflow: 'hidden', ...SHADOWS.card }, coverageTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.lg, padding: SPACING.xl },
  ring: { width: 112, height: 112, borderRadius: 56, borderWidth: 10, borderColor: COLORS.aqua, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-3deg' }] }, ringInner: { width: 78, height: 78, borderRadius: 39, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0A4F4C' }, percent: { ...TYPOGRAPHY.metric, color: COLORS.white }, ringLabel: { ...TYPOGRAPHY.tiny, fontSize: 9, letterSpacing: 0.8, color: '#BFE4DF' },
  coverageCopy: { flex: 1 }, coverageKicker: { ...TYPOGRAPHY.tiny, fontWeight: '800', letterSpacing: 1, color: COLORS.aqua }, coverageStatement: { ...TYPOGRAPHY.subheading, color: COLORS.white, marginTop: SPACING.xs }, coverageHint: { ...TYPOGRAPHY.caption, color: '#BFD3D0', marginTop: SPACING.xs },
  ledger: { backgroundColor: 'rgba(255,255,255,0.07)', paddingHorizontal: SPACING.lg }, coverageLine: { minHeight: 51, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.09)' }, coverageLineLast: { borderBottomWidth: 0 }, ledgerMark: { width: 7, height: 7, borderRadius: 4 }, coverageLabel: { ...TYPOGRAPHY.bodySmall, flex: 1, color: '#D9E6E3' }, coverageValue: { ...TYPOGRAPHY.subheading },
  actionStrip: { marginVertical: SPACING.xl, gap: SPACING.sm }, mapAction: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md, borderRadius: RADIUS.xl, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.primaryLight, ...SHADOWS.subtle }, actionMotif: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: COLORS.primaryMist, transform: [{ rotate: '-3deg' }] }, motifDot: { position: 'absolute', right: 3, top: 3, width: 9, height: 9, borderRadius: 5, backgroundColor: COLORS.warning }, actionTitle: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text }, actionText: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary }, importAction: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, borderRadius: RADIUS.lg, backgroundColor: COLORS.primary }, importActionText: { ...TYPOGRAPHY.button, color: COLORS.white },
  queueHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md }, sectionTitle: { ...TYPOGRAPHY.heading, color: COLORS.text }, queueCount: { minWidth: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primaryMist }, queueCountText: { ...TYPOGRAPHY.bodyMedium, color: COLORS.primary },
  filters: { gap: SPACING.sm, paddingVertical: SPACING.lg, paddingRight: SPACING.lg }, filter: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs, paddingHorizontal: SPACING.md, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface }, filterActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary }, filterText: { ...TYPOGRAPHY.caption, fontWeight: '700', color: COLORS.textSecondary }, filterTextActive: { color: COLORS.white },
  queueList: { gap: SPACING.sm }, queueRow: { minHeight: 100, flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, padding: SPACING.md, borderRadius: RADIUS.lg, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border }, queueIcon: { width: 22, height: 28, alignItems: 'center', justifyContent: 'center' }, queueContent: { flex: 1, minWidth: 0 }, queueTop: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm }, placeName: { ...TYPOGRAPHY.bodyMedium, flex: 1, color: COLORS.text }, statusBadge: { maxWidth: 120, minHeight: 24, justifyContent: 'center', paddingHorizontal: SPACING.sm, borderRadius: RADIUS.pill, backgroundColor: COLORS.primarySoft }, statusBadgeDanger: { backgroundColor: COLORS.violationSoft }, statusBadgeWarning: { backgroundColor: COLORS.warningSoft }, status: { ...TYPOGRAPHY.tiny, fontWeight: '800', color: COLORS.primary }, statusDanger: { color: COLORS.violation }, statusWarning: { color: COLORS.warningDark }, reason: { ...TYPOGRAPHY.caption, fontWeight: '700', color: COLORS.primary, marginTop: 3 }, reasonDanger: { color: COLORS.violation }, reasonWarning: { color: COLORS.warningDark }, location: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginTop: 2 }, actionRow: { minHeight: 30, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, marginTop: SPACING.xs }, actionLabel: { ...TYPOGRAPHY.caption, fontWeight: '800', color: COLORS.primary },
  flex: { flex: 1 }, pressed: { opacity: 0.72 },
});

