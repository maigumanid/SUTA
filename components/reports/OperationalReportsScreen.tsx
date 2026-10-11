import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, usePathname } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import AdminPage, { adminStyles } from '@/components/admin/AdminPage';
import OptionSelector from '@/components/admin/OptionSelector';
import AppButton from '@/components/common/AppButton';
import ScreenContainer from '@/components/common/ScreenContainer';
import ReportPreview from '@/components/reports/ReportPreview';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useInspectionSync } from '@/context/InspectionSyncContext';
import { fetchAdminBsis, fetchBarangays } from '@/services/adminService';
import { fetchInspectionRecords } from '@/services/inspectionRecordService';
import {
  fetchCompleteCurrentSanitationRegister,
  fetchCompletePlaceInspectionHistory,
  fetchCurrentSanitationRegister,
  fetchMunicipalCurrentSummary,
  fetchPlaceInspectionHistory,
  fetchReportPlaces,
  fetchReportPuroks,
  getReportInspectorOptions,
} from '@/services/reportService';
import type { AdminBsiSummary, BarangayOption } from '@/types/admin';
import { PLACE_TYPES } from '@/types/place';
import {
  DEFAULT_REPORT_FILTERS,
  type ReportFilters,
  type ReportKind,
  type ReportPlaceOption,
  type ReportViewModel,
} from '@/types/report';
import { formatLocalDate } from '@/utils/dateTime';
import { shareReportCsv } from '@/utils/reportCsv';
import { shareReportPdf } from '@/utils/reportPdf';
import {
  buildCurrentRegisterViewModel,
  buildMunicipalSummaryViewModel,
  buildPlaceHistoryViewModel,
  currentRegisterTitle,
  reportScope,
  riskLabel,
} from '@/utils/reportViewModel';

const PREVIEW_SIZE = 20;
const definitions: { kind: ReportKind; title: string; description: string; icon: keyof typeof Ionicons.glyphMap; adminOnly?: boolean }[] = [
  { kind: 'current_register', title: 'Current Sanitation Register', description: 'One current row per place.', icon: 'clipboard-outline' },
  { kind: 'place_history', title: 'Place Inspection History', description: 'Chronological records for one place.', icon: 'time-outline' },
  { kind: 'municipal_summary', title: 'Municipal/City Consolidated Summary', description: 'Current totals by barangay.', icon: 'business-outline', adminOnly: true },
];

function DateFilter({ label, value, onChange }: { label: string; value?: string; onChange: (value?: string) => void }) {
  const [open, setOpen] = useState(false);
  const select = (event: DateTimePickerEvent, date?: Date) => {
    setOpen(false);
    if (event.type === 'set' && date) {
      onChange(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`);
    }
  };
  return <View style={styles.dateField}><Text style={styles.label}>{label}</Text><View style={styles.dateRow}><Pressable style={styles.dateButton} onPress={() => setOpen(true)}><Text style={value ? styles.value : styles.placeholder}>{value ? formatLocalDate(value) : 'All time'}</Text><Ionicons name="calendar-outline" size={20} color={COLORS.primary} /></Pressable>{value ? <Pressable accessibilityLabel={`Clear ${label}`} onPress={() => onChange(undefined)}><Ionicons name="close-circle" size={25} color={COLORS.textMuted} /></Pressable> : null}</View>{open ? <DateTimePicker value={value ? new Date(`${value}T00:00:00`) : new Date()} mode="date" onChange={select} /> : null}</View>;
}

export default function OperationalReportsScreen({ role }: { role: 'admin' | 'bsi' }) {
  const isAdmin = role === 'admin';
  const pathname = usePathname();
  const { profile } = useAuth();
  const { isOnline } = useInspectionSync();
  const [kind, setKind] = useState<ReportKind>('current_register');
  const [filters, setFilters] = useState<ReportFilters>(DEFAULT_REPORT_FILTERS);
  const [barangays, setBarangays] = useState<BarangayOption[]>([]);
  const [bsis, setBsis] = useState<AdminBsiSummary[]>([]);
  const [puroks, setPuroks] = useState<string[]>([]);
  const [places, setPlaces] = useState<ReportPlaceOption[]>([]);
  const [report, setReport] = useState<ReportViewModel | null>(null);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [includePhotoEvidence, setIncludePhotoEvidence] = useState(false);

  const assignedBarangayId = profile?.assignedBarangayId ?? '';
  const assignedBarangayName = profile?.assignedBarangay ?? 'Assigned barangay';
  const jurisdiction = profile?.jurisdictionName ?? (isAdmin ? 'Municipal/City Sanitation Jurisdiction' : assignedBarangayName);
  const effectiveFilters = useMemo(() => isAdmin ? filters : {
    ...filters,
    barangayId: assignedBarangayId,
    bsiId: 'all',
  }, [assignedBarangayId, filters, isAdmin]);
  const availableDefinitions = useMemo(() => definitions.filter((item) => isAdmin || !item.adminOnly), [isAdmin]);

  const loadDirectories = useCallback(async () => {
    if (isOnline === false) return;
    try {
      if (isAdmin) {
        const [directory, inspectors] = await Promise.all([fetchBarangays(), fetchAdminBsis()]);
        setBarangays(directory);
        setBsis(inspectors);
      } else if (assignedBarangayId) {
        setBarangays([{ id: assignedBarangayId, name: assignedBarangayName }]);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load report options.');
    }
  }, [assignedBarangayId, assignedBarangayName, isAdmin, isOnline]);
  useFocusEffect(useCallback(() => { void loadDirectories(); }, [loadDirectories]));

  useEffect(() => {
    if (isOnline === false || (!isAdmin && !assignedBarangayId)) return;
    let active = true;
    Promise.all([
      fetchReportPuroks(effectiveFilters.barangayId),
      fetchReportPlaces(effectiveFilters.barangayId, effectiveFilters.purok),
    ]).then(([nextPuroks, nextPlaces]) => {
      if (!active) return;
      setPuroks(nextPuroks);
      setPlaces(nextPlaces);
    }).catch((caught) => {
      if (active) setError(caught instanceof Error ? caught.message : 'Unable to load place filters.');
    });
    return () => { active = false; };
  }, [assignedBarangayId, effectiveFilters.barangayId, effectiveFilters.purok, isAdmin, isOnline]);

  const inspectors = useMemo(() => getReportInspectorOptions(bsis, effectiveFilters.barangayId), [bsis, effectiveFilters.barangayId]);
  const labels = useMemo(() => ({
    barangay: barangays.find((item) => item.id === effectiveFilters.barangayId)?.name
      ?? (effectiveFilters.barangayId === 'all' ? 'All barangays' : assignedBarangayName),
    inspector: bsis.find((item) => item.id === effectiveFilters.bsiId)?.name
      ?? (effectiveFilters.bsiId === 'all' ? 'All BSIs' : 'Selected BSI'),
    place: places.find((item) => item.id === effectiveFilters.placeId)?.name,
  }), [assignedBarangayName, barangays, bsis, effectiveFilters, places]);

  const buildReport = useCallback(async (nextPage: number, exportMode = false) => {
    if (effectiveFilters.startDate && effectiveFilters.endDate && effectiveFilters.startDate > effectiveFilters.endDate) {
      throw new Error('The start date must not be later than the end date.');
    }
    if (kind === 'place_history' && effectiveFilters.placeId === 'all') {
      throw new Error('Select a place or household before previewing its inspection history.');
    }
    const scope = reportScope(effectiveFilters, labels);
    if (kind === 'current_register') {
      const data = exportMode
        ? await fetchCompleteCurrentSanitationRegister(effectiveFilters)
        : await fetchCurrentSanitationRegister(effectiveFilters, nextPage, PREVIEW_SIZE);
      const view = buildCurrentRegisterViewModel({
        title: isAdmin && effectiveFilters.barangayId === 'all'
          ? 'Municipal/City Sanitary Inspection Register'
          : currentRegisterTitle(effectiveFilters),
        jurisdiction,
        filters: effectiveFilters,
        scope,
        rows: data.rows,
        total: data.total,
        generatedBy: role,
        isPreview: !exportMode,
      });
      if (exportMode) {
        view.inspectionRecords = await fetchInspectionRecords(data.rows.flatMap((row) => row.inspectionId ? [row.inspectionId] : []));
      }
      view.includePhotoEvidence = includePhotoEvidence;
      view.preparedBy = role === 'bsi' ? profile?.name ?? 'Barangay Sanitary Inspector' : undefined;
      view.isPreview = !exportMode;
      if (!exportMode) {
        view.previewPage = nextPage;
        view.previewPageSize = PREVIEW_SIZE;
      }
      setTotal(data.total);
      return view;
    }
    if (kind === 'place_history') {
      const data = exportMode
        ? await fetchCompletePlaceInspectionHistory(effectiveFilters)
        : await fetchPlaceInspectionHistory(effectiveFilters, nextPage, PREVIEW_SIZE);
      const view = buildPlaceHistoryViewModel({
        title: 'Place Inspection History',
        jurisdiction,
        filters: effectiveFilters,
        scope,
        rows: data.rows,
        total: data.total,
        generatedBy: role,
        isPreview: !exportMode,
      });
      if (exportMode) view.inspectionRecords = await fetchInspectionRecords(data.rows.map((row) => row.id));
      view.includePhotoEvidence = includePhotoEvidence;
      view.preparedBy = role === 'bsi' ? profile?.name ?? 'Barangay Sanitary Inspector' : undefined;
      view.isPreview = !exportMode;
      if (!exportMode) {
        view.previewPage = nextPage;
        view.previewPageSize = PREVIEW_SIZE;
      }
      setTotal(data.total);
      return view;
    }
    const data = await fetchMunicipalCurrentSummary(effectiveFilters, barangays);
    const view = buildMunicipalSummaryViewModel({
      title: 'Municipal/City Sanitation Consolidated Summary',
      jurisdiction,
      filters: effectiveFilters,
      scope,
      data,
    });
    view.isPreview = !exportMode;
    setTotal(data.summary.places);
    return view;
  }, [barangays, effectiveFilters, includePhotoEvidence, isAdmin, jurisdiction, kind, labels, profile?.name, role]);

  const loadPreview = useCallback(async (nextPage = 0) => {
    if (isOnline === false) {
      setReport(null);
      setError('Reports require an internet connection. Offline inspection work remains available.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setReport(await buildReport(nextPage));
      setPage(nextPage);
    } catch (caught) {
      setReport(null);
      setError(caught instanceof Error ? caught.message : 'Unable to prepare the report.');
    } finally {
      setLoading(false);
    }
  }, [buildReport, isOnline]);

  const update = <K extends keyof ReportFilters>(key: K, value: ReportFilters[K]) => {
    setFilters((current) => {
      const next = { ...current, [key]: value };
      if (key === 'barangayId') {
        next.purok = 'all';
        next.placeId = 'all';
        if (current.bsiId !== 'all' && !bsis.some((item) => item.id === current.bsiId && (value === 'all' || item.barangayId === value))) next.bsiId = 'all';
      }
      if (key === 'purok') next.placeId = 'all';
      return next;
    });
    setReport(null);
    setPage(0);
  };
  const chooseKind = (next: ReportKind) => {
    setKind(next);
    setIncludePhotoEvidence(false);
    setReport(null);
    setPage(0);
    setTotal(0);
    setError(null);
    setFilters((current) => ({ ...DEFAULT_REPORT_FILTERS, barangayId: current.barangayId, startDate: current.startDate, endDate: current.endDate }));
  };
  const exportPdf = async () => {
    setExporting(true);
    try { await shareReportPdf(await buildReport(0, true)); }
    catch (caught) { Alert.alert('Unable to Export PDF', caught instanceof Error ? caught.message : 'Please try again.'); }
    finally { setExporting(false); }
  };
  const exportCsv = async () => {
    if (isOnline === false) {
      Alert.alert('Connection required', 'CSV export uses the complete synced report. Reconnect and try again.');
      return;
    }
    setExportingCsv(true);
    try { await shareReportCsv(await buildReport(0, true)); }
    catch (caught) { Alert.alert('Unable to Export CSV', caught instanceof Error ? caught.message : 'Please try again.'); }
    finally { setExportingCsv(false); }
  };
  const switchToRegister = () => { setKind('current_register'); setReport(null); setPage(0); };
  const paginated = kind !== 'municipal_summary';
  const content = <>
    {isOnline === false ? <View style={styles.offline}><Ionicons name="cloud-offline-outline" size={20} color={COLORS.offline} /><Text style={styles.offlineText}>Reports require connectivity.</Text></View> : null}
    <Text style={isAdmin ? adminStyles.sectionTitle : styles.heading}>Report Mode</Text>
    <View style={styles.catalog}>{availableDefinitions.map((item) => {
      const selected = item.kind === kind;
      return <Pressable key={item.kind} accessibilityRole="button" accessibilityState={{ selected }} style={({ pressed }) => [styles.card, selected && styles.selected, pressed && styles.pressed]} onPress={() => chooseKind(item.kind)}>
        <View style={[styles.selectionRail, selected && styles.selectionRailActive]} />
        <Ionicons name={item.icon} size={21} color={selected ? COLORS.primary : COLORS.textMuted} />
        <View style={styles.cardCopy}><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.body}>{item.description}</Text></View>
        {selected ? <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} /> : <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />}
      </Pressable>;
    })}</View>
    <Text style={isAdmin ? adminStyles.sectionTitle : styles.heading}>Report Filters</Text>
    <Text style={styles.body}>Choose the scope and records to include.</Text>
    {isAdmin ? <OptionSelector label="BARANGAY" value={filters.barangayId} options={[{ value: 'all', label: 'Municipality-wide' }, ...barangays.map((item) => ({ value: item.id, label: item.name }))]} onChange={(value) => update('barangayId', value)} /> : <View style={styles.fixedScope}><Text style={styles.label}>BARANGAY</Text><Text style={styles.value}>{assignedBarangayName}</Text></View>}
    <OptionSelector label="PUROK" value={filters.purok} options={[{ value: 'all', label: 'All puroks' }, ...puroks.map((value) => ({ value, label: value }))]} onChange={(value) => update('purok', value)} />
    {kind === 'place_history' ? <OptionSelector label="PLACE / HOUSEHOLD" value={filters.placeId} options={[{ value: 'all', label: 'Select a place or household' }, ...places.map((item) => ({ value: item.id, label: `${item.name} · ${item.purok}` }))]} onChange={(value) => update('placeId', value)} /> : null}
    {isAdmin && kind !== 'place_history' ? <OptionSelector label="INSPECTOR / BSI" value={filters.bsiId} options={[{ value: 'all', label: 'All BSIs' }, ...inspectors.map((item) => ({ value: item.id, label: item.name }))]} onChange={(value) => update('bsiId', value)} /> : null}
    {kind !== 'place_history' ? <>
      <OptionSelector label="STATUS" value={filters.result} options={[{ value: 'all', label: 'All statuses' }, { value: 'compliant', label: 'Compliant' }, { value: 'non_compliant', label: 'Non-Compliant' }]} onChange={(value) => update('result', value)} />
      <OptionSelector label="RISK" value={filters.riskLevel} options={['all', 'Low', 'Moderate', 'High', 'Unclassified'].map((value) => ({ value, label: value === 'all' ? 'All risk levels' : riskLabel(value) }))} onChange={(value) => update('riskLevel', value)} />
      <OptionSelector label="REINSPECTION" value={filters.reinspectionStatus} options={[{ value: 'all', label: 'All states' }, { value: 'for_reinspection', label: 'For Reinspection' }, { value: 'pending', label: 'Pending' }, { value: 'overdue', label: 'Overdue' }, { value: 'completed', label: 'Completed' }]} onChange={(value) => update('reinspectionStatus', value)} />
      <OptionSelector label="PLACE TYPE" value={filters.placeType} options={[{ value: 'all', label: 'All place types' }, ...PLACE_TYPES.map((value) => ({ value, label: value }))]} onChange={(value) => update('placeType', value)} />
    </> : <OptionSelector label="INSPECTION TYPE" value={filters.inspectionType} options={[{ value: 'all', label: 'All inspections and reinspections' }, { value: 'inspection', label: 'Initial and regular inspections' }, { value: 'reinspection', label: 'Reinspections' }]} onChange={(value) => update('inspectionType', value)} />}
    <View style={styles.dateFilters}><DateFilter label="FROM" value={filters.startDate} onChange={(value) => update('startDate', value)} /><DateFilter label="TO" value={filters.endDate} onChange={(value) => update('endDate', value)} /></View>
    {kind !== 'municipal_summary' ? <View style={styles.optionToggle}><View style={styles.optionText}><Text style={styles.label}>INCLUDE PHOTO EVIDENCE</Text><Text style={styles.body}>Off by default. Full checklist, findings, remarks, and result/risk details are always included.</Text></View><Switch value={includePhotoEvidence} onValueChange={setIncludePhotoEvidence} trackColor={{ false: COLORS.border, true: COLORS.primaryLight }} thumbColor={includePhotoEvidence ? COLORS.primary : COLORS.surface} /></View> : null}
    <AppButton title="Preview Report" loading={loading} onPress={() => void loadPreview(0)} />
    {error ? <Text style={isAdmin ? adminStyles.error : styles.error}>{error}</Text> : null}
    {report ? <><Text style={isAdmin ? adminStyles.sectionTitle : styles.heading}>Report Preview</Text><ReportPreview report={report} onOpen={(link) => router.push({ pathname: isAdmin ? '/admin/inspection/[id]' : '/inspection/[id]', params: { id: link.id } })} />
      {paginated ? <View style={styles.pagination}><AppButton title="Previous" variant="outline" disabled={page === 0 || loading} onPress={() => void loadPreview(page - 1)} /><Text style={styles.body}>Page {page + 1} · {total.toLocaleString()} matching {kind === 'current_register' ? 'places' : 'records'}</Text><AppButton title="Next" variant="outline" disabled={(page + 1) * PREVIEW_SIZE >= total || loading} onPress={() => void loadPreview(page + 1)} /></View> : <AppButton title="Open Current Register Drilldown" variant="outline" onPress={switchToRegister} />}
      <View style={styles.exportActions}>
        <AppButton title="Export Complete PDF" loading={exporting} onPress={() => void exportPdf()} style={styles.exportAction} />
        <AppButton title="Export CSV" variant="outline" loading={exportingCsv} onPress={() => void exportCsv()} style={styles.exportAction} />
      </View><Text style={styles.note}>{kind === 'municipal_summary' ? 'This aggregate export intentionally omits household checklists. Use Current Sanitation Register for record-level detail.' : kind === 'current_register' ? 'PDF is the formal record. CSV exports the same filtered current register for spreadsheet work.' : 'Preview stays compact. Export retrieves every matching selected record in backend batches and includes its full inspection detail.'}</Text>
    </> : null}
  </>;

  if (isAdmin) return <AdminPage title="Reports" subtitle="Current place status, complete place history, and municipal consolidation." refreshing={loading} onRefresh={() => void loadPreview(page)}>{content}</AdminPage>;
  return <ScreenContainer><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}><View style={styles.header}>{!pathname.includes('/reports') ? <Pressable accessibilityLabel="Back" onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={COLORS.text} /></Pressable> : null}<View><Text style={styles.title}>Reports</Text><Text style={styles.subtitle}>{assignedBarangayName}</Text></View></View>{content}</ScrollView></ScreenContainer>;
}

const styles = StyleSheet.create({
  content: { paddingTop: SPACING.xxl, paddingBottom: SPACING.section, gap: SPACING.xl },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  title: { ...TYPOGRAPHY.display, fontSize: 29, lineHeight: 35, color: COLORS.text },
  subtitle: { ...TYPOGRAPHY.bodySmall, color: COLORS.textSecondary },
  heading: { ...TYPOGRAPHY.heading, color: COLORS.text },
  catalog: { overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.xl, backgroundColor: COLORS.surface },
  card: { minHeight: 72, position: 'relative', flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  selected: { backgroundColor: COLORS.primarySoft },
  selectionRail: { position: 'absolute', left: 0, top: SPACING.sm, bottom: SPACING.sm, width: 3, borderRadius: RADIUS.pill, backgroundColor: COLORS.transparent },
  selectionRailActive: { backgroundColor: COLORS.primary },
  cardCopy: { flex: 1, minWidth: 0 },
  cardTitle: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text },
  body: { ...TYPOGRAPHY.bodySmall, color: COLORS.textSecondary },
  fixedScope: { gap: SPACING.xs, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, backgroundColor: COLORS.surface },
  label: { ...TYPOGRAPHY.label, color: COLORS.textSecondary },
  dateFilters: { gap: SPACING.md },
  dateField: { gap: SPACING.xs },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  dateButton: { flex: 1, minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, backgroundColor: COLORS.surface },
  value: { ...TYPOGRAPHY.body, color: COLORS.text },
  placeholder: { ...TYPOGRAPHY.body, color: COLORS.textMuted },
  optionToggle: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.xl, backgroundColor: COLORS.surface, ...SHADOWS.subtle },
  optionText: { flex: 1, gap: SPACING.xs },
  offline: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.md, borderRadius: RADIUS.lg, backgroundColor: COLORS.offlineSoft },
  offlineText: { ...TYPOGRAPHY.body, color: COLORS.offline },
  error: { ...TYPOGRAPHY.body, color: COLORS.violation },
  pagination: { gap: SPACING.sm, alignItems: 'center' },
  exportActions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  exportAction: { flexGrow: 1, minWidth: 150 },
  note: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, textAlign: 'center' },
  pressed: { opacity: 0.72 },
});
