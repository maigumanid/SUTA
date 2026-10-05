import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import AdminPage, { adminStyles } from '@/components/admin/AdminPage';
import OptionSelector from '@/components/admin/OptionSelector';
import AppButton from '@/components/common/AppButton';
import ReportPreview from '@/components/reports/ReportPreview';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useInspectionSync } from '@/context/InspectionSyncContext';
import { fetchAdminBsis, fetchBarangays } from '@/services/adminService';
import { fetchInspectionRecords } from '@/services/inspectionRecordService';
import { fetchBsiActivityReport, fetchInspectionReport, fetchPriorityPlaces, fetchReinspectionReport, fetchRepeatedNonCompliancePlaces, fetchReportSummary, getReportInspectorOptions } from '@/services/reportService';
import type { AdminBsiSummary, BarangayOption } from '@/types/admin';
import { PLACE_TYPES } from '@/types/place';
import { DEFAULT_REPORT_FILTERS, type ReportFilters, type ReportKind, type ReportViewModel } from '@/types/report';
import { formatLocalDate } from '@/utils/dateTime';
import { shareReportPdf } from '@/utils/reportPdf';
import { buildActivityViewModel, buildInspectionViewModel, buildPriorityViewModel, buildReinspectionViewModel, buildSummaryViewModel, reportScope, riskLabel } from '@/utils/reportViewModel';

const EXPORT_LIMIT = 500;
const reports: { kind: ReportKind; title: string; short: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { kind: 'municipal_summary', title: 'Municipal/City Sanitation Summary', short: 'Executive coverage, results, risk, workforce, and barangay table.', icon: 'business-outline' },
  { kind: 'barangay_summary', title: 'Barangay Sanitation Report', short: 'One barangay’s status, priority cases, activity, and BSI assignment.', icon: 'location-outline' },
  { kind: 'inspection_results', title: 'Inspection Results Report', short: 'Detailed professional inspection register.', icon: 'clipboard-outline' },
  { kind: 'priority_places', title: 'High-Risk / Non-Compliant Places Report', short: 'Operational priority cases ordered by urgency.', icon: 'warning-outline' },
  { kind: 'reinspections', title: 'Reinspection Monitoring Report', short: 'Overdue, pending, and completed follow-up work.', icon: 'refresh-outline' },
  { kind: 'bsi_activity', title: 'BSI Activity Report', short: 'Operational workload without rankings or grades.', icon: 'people-outline' },
];

function DateFilter({ label, value, onChange }: { label: string; value?: string; onChange: (value?: string) => void }) {
  const [open, setOpen] = useState(false);
  const handleChange = (event: DateTimePickerEvent, date?: Date) => { setOpen(false); if (event.type === 'set' && date) onChange(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`); };
  return <View style={styles.dateField}><Text style={styles.filterLabel}>{label}</Text><View style={styles.dateRow}><Pressable style={styles.dateButton} onPress={() => setOpen(true)}><Text style={value ? styles.dateValue : styles.datePlaceholder}>{value ? formatLocalDate(value) : 'Any date'}</Text><Ionicons name="calendar-outline" size={20} color={COLORS.primary} /></Pressable>{value ? <Pressable accessibilityLabel={`Clear ${label}`} onPress={() => onChange(undefined)}><Ionicons name="close-circle" size={25} color={COLORS.textMuted} /></Pressable> : null}</View>{open ? <DateTimePicker value={value ? new Date(`${value}T00:00:00`) : new Date()} mode="date" onChange={handleChange} /> : null}</View>;
}

export default function AdminReportsScreen() {
  const { profile } = useAuth(); const { isOnline } = useInspectionSync();
  const [kind, setKind] = useState<ReportKind>('municipal_summary'); const [filters, setFilters] = useState<ReportFilters>(DEFAULT_REPORT_FILTERS);
  const [barangays, setBarangays] = useState<BarangayOption[]>([]); const [bsis, setBsis] = useState<AdminBsiSummary[]>([]);
  const [report, setReport] = useState<ReportViewModel | null>(null); const [page, setPage] = useState(0); const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false); const [exporting, setExporting] = useState(false); const [error, setError] = useState<string | null>(null); const requestId = useRef(0);
  const [includePhotoEvidence, setIncludePhotoEvidence] = useState(false);
  const definition = reports.find((item) => item.kind === kind) ?? reports[0]; const jurisdiction = profile?.jurisdictionName ?? 'Municipal/City Sanitation Jurisdiction';

  const loadOptions = useCallback(async () => { try { const [directory, inspectors] = await Promise.all([fetchBarangays(), fetchAdminBsis()]); setBarangays(directory); setBsis(inspectors); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to load report filters.'); } }, []);
  useFocusEffect(useCallback(() => { void loadOptions(); }, [loadOptions]));
  const inspectors = useMemo(() => getReportInspectorOptions(bsis, filters.barangayId), [bsis, filters.barangayId]);
  const labels = useMemo(() => ({ barangay: barangays.find((item) => item.id === filters.barangayId)?.name ?? 'All barangays', inspector: bsis.find((item) => item.id === filters.bsiId)?.name ?? 'All BSIs' }), [barangays, bsis, filters.barangayId, filters.bsiId]);
  const relevant = useMemo<(keyof ReportFilters)[]>(() => kind === 'municipal_summary' ? ['barangayId'] : kind === 'barangay_summary' ? ['barangayId'] : kind === 'inspection_results' ? ['barangayId', 'bsiId', 'placeType', 'result', 'riskLevel', 'inspectionType'] : kind === 'priority_places' ? ['barangayId', 'placeType', 'result', 'riskLevel'] : kind === 'reinspections' ? ['barangayId', 'reinspectionStatus'] : ['barangayId', 'bsiId', 'accountStatus'], [kind]);

  const buildReport = useCallback(async (nextPage: number, exportMode = false) => {
    if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) throw new Error('The start date must not be later than the end date.');
    if (kind === 'barangay_summary' && filters.barangayId === 'all') return null;
    const size = exportMode ? EXPORT_LIMIT : kind === 'municipal_summary' ? 25 : 15; const scope = reportScope(filters, labels, relevant);
    const attachRecords = async (view: ReportViewModel, ids: string[], matchingTotal: number) => { const uniqueIds = [...new Set(ids)]; return { ...view, inspectionRecords: await fetchInspectionRecords(uniqueIds), layoutKind: kind, includePhotoEvidence, generatedBy: 'admin' as const, ...(view.totalCount === undefined ? { exportedCount: uniqueIds.length, totalCount: matchingTotal } : {}) }; };
    if (kind === 'municipal_summary') { const actionFilters = { ...filters, reinspectionStatus: 'overdue' }; const [summary, priority, overdue, repeated, inspections] = await Promise.all([fetchReportSummary(filters, barangays), fetchPriorityPlaces(filters, 0, exportMode ? EXPORT_LIMIT : 15), fetchReinspectionReport(actionFilters, 0, exportMode ? EXPORT_LIMIT : 15), fetchRepeatedNonCompliancePlaces(filters, exportMode ? EXPORT_LIMIT : 15), fetchInspectionReport(filters, 0, size)]); return attachRecords(buildSummaryViewModel({ title: definition.title, jurisdiction, filters, scope, summary, priority: priority.rows, reinspections: overdue.rows, repeatedNonCompliance: repeated }), inspections.rows.map((row) => row.id), inspections.total); }
    if (kind === 'barangay_summary') { const [summary, recent, priority] = await Promise.all([fetchReportSummary(filters, barangays), fetchInspectionReport(filters, 0, size), fetchPriorityPlaces(filters, 0, exportMode ? EXPORT_LIMIT : 15)]); return attachRecords(buildSummaryViewModel({ title: definition.title, jurisdiction, filters, scope, summary, recent: recent.rows, priority: priority.rows, barangayMode: true, includeWorkforce: true }), recent.rows.map((row) => row.id), recent.total); }
    if (kind === 'inspection_results') { const data = await fetchInspectionReport(filters, nextPage, size); setTotal(data.total); return attachRecords(buildInspectionViewModel(definition.title, jurisdiction, filters, scope, data.rows, data.total), data.rows.map((row) => row.id), data.total); }
    if (kind === 'priority_places') { const data = await fetchPriorityPlaces(filters, nextPage, size); setTotal(data.total); return attachRecords(buildPriorityViewModel(definition.title, jurisdiction, filters, scope, data.rows, data.total), data.rows.flatMap((row) => row.latestInspectionId ? [row.latestInspectionId] : []), data.total); }
    if (kind === 'reinspections') { const data = await fetchReinspectionReport(filters, nextPage, size); setTotal(data.total); const view = buildReinspectionViewModel(definition.title, jurisdiction, filters, scope, data.rows, data.total); return attachRecords(view, data.rows.flatMap((row) => [row.originalInspectionId, ...(row.completedInspectionId ? [row.completedInspectionId] : [])]), data.total); }
    const data = await fetchBsiActivityReport(filters, nextPage, size); setTotal(data.total);
    const activityIds: string[] = []; let activityInspectionTotal = 0;
    for (const bsi of data.rows) {
      const remaining = Math.max(0, size - activityIds.length);
      const inspections = await fetchInspectionReport({ ...filters, barangayId: 'all', bsiId: bsi.bsiId }, 0, Math.max(1, remaining));
      activityInspectionTotal += inspections.total;
      if (remaining) activityIds.push(...inspections.rows.slice(0, remaining).map((row) => row.id));
    }
    return attachRecords(buildActivityViewModel(definition.title, jurisdiction, filters, scope, data.rows, data.total), activityIds, activityInspectionTotal);
  }, [barangays, definition.title, filters, includePhotoEvidence, jurisdiction, kind, labels, relevant]);

  const loadPreview = useCallback(async (nextPage = 0) => { if (isOnline === false) { setReport(null); setError('Reports require an internet connection.'); return; } const id = ++requestId.current; setLoading(true); setError(null); try { const next = await buildReport(nextPage); if (id !== requestId.current) return; setReport(next); setPage(nextPage); if (!next && kind === 'barangay_summary') setError('Select a barangay to preview this report.'); } catch (caught) { if (id === requestId.current) { setReport(null); setError(caught instanceof Error ? caught.message : 'Unable to prepare the report.'); } } finally { if (id === requestId.current) setLoading(false); } }, [buildReport, isOnline, kind]);
  useEffect(() => { const timer = setTimeout(() => { void loadPreview(0); }, 400); return () => clearTimeout(timer); }, [loadPreview]);

  const update = <K extends keyof ReportFilters>(key: K, value: ReportFilters[K]) => { setFilters((current) => { const next = { ...current, [key]: value }; if (key === 'barangayId' && current.bsiId !== 'all' && !bsis.some((item) => item.id === current.bsiId && (value === 'all' || item.barangayId === value))) next.bsiId = 'all'; return next; }); setPage(0); };
  const chooseKind = (next: ReportKind) => { setKind(next); setIncludePhotoEvidence(next === 'priority_places'); setPage(0); setTotal(0); setReport(null); setError(null); setFilters((current) => ({ ...DEFAULT_REPORT_FILTERS, startDate: current.startDate, endDate: current.endDate, barangayId: current.barangayId })); };
  const exportPdf = async () => { setExporting(true); try { const complete = await buildReport(0, true); if (!complete) throw new Error('Complete the required report filters first.'); await shareReportPdf(complete); } catch (caught) { Alert.alert('Unable to Export PDF', caught instanceof Error ? caught.message : 'Please try again.'); } finally { setExporting(false); } };
  const paginated = !['municipal_summary', 'barangay_summary'].includes(kind); const previewSize = 15;

  return <AdminPage title="Reports" subtitle="Choose a report, set only its relevant scope, then preview and export." refreshing={loading} onRefresh={() => void loadPreview(page)}>
    {isOnline === false ? <View style={styles.offline}><Ionicons name="cloud-offline-outline" size={20} color={COLORS.offline} /><Text style={styles.offlineText}>Reports require connectivity.</Text></View> : null}
    <Text style={adminStyles.sectionTitle}>Report Type</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catalog}>{reports.map((item) => <Pressable key={item.kind} style={[styles.reportCard, kind === item.kind && styles.reportCardSelected]} onPress={() => chooseKind(item.kind)}><Ionicons name={item.icon} size={22} color={COLORS.primary} /><Text style={styles.reportName}>{item.title}</Text><Text style={styles.reportDescription}>{item.short}</Text></Pressable>)}</ScrollView>
    <Text style={adminStyles.sectionTitle}>Report Scope</Text><Text style={adminStyles.caption}>The preview refreshes automatically when a filter changes.</Text>
    <View style={styles.dateFilters}><DateFilter label="FROM" value={filters.startDate} onChange={(value) => update('startDate', value)} /><DateFilter label="TO" value={filters.endDate} onChange={(value) => update('endDate', value)} /></View>
    {relevant.includes('barangayId') ? <OptionSelector label="BARANGAY" value={filters.barangayId} options={[{ value: 'all', label: kind === 'barangay_summary' ? 'Select barangay' : 'All barangays' }, ...barangays.map((item) => ({ value: item.id, label: item.name }))]} onChange={(value) => update('barangayId', value)} /> : null}
    {relevant.includes('bsiId') ? <OptionSelector label="INSPECTOR" value={filters.bsiId} options={[{ value: 'all', label: 'All BSIs' }, ...inspectors.map((item) => ({ value: item.id, label: `${item.name}${item.active ? '' : ' (Inactive)'}` }))]} onChange={(value) => update('bsiId', value)} /> : null}
    {relevant.includes('placeType') ? <OptionSelector label="PLACE TYPE" value={filters.placeType} options={[{ value: 'all', label: 'All place types' }, ...PLACE_TYPES.map((value) => ({ value, label: value }))]} onChange={(value) => update('placeType', value)} /> : null}
    {relevant.includes('result') ? <OptionSelector label="RESULT / STATUS" value={filters.result} options={[{ value: 'all', label: 'All results' }, { value: 'compliant', label: 'Compliant' }, { value: 'non_compliant', label: 'Non-Compliant' }, { value: 'for_reinspection', label: 'For Reinspection' }]} onChange={(value) => update('result', value)} /> : null}
    {relevant.includes('riskLevel') ? <OptionSelector label="RISK" value={filters.riskLevel} options={['all', 'Low', 'Moderate', 'High', 'Unclassified'].map((value) => ({ value, label: value === 'all' ? 'All risk levels' : riskLabel(value) }))} onChange={(value) => update('riskLevel', value)} /> : null}
    {relevant.includes('inspectionType') ? <OptionSelector label="INSPECTION TYPE" value={filters.inspectionType} options={[{ value: 'all', label: 'All types' }, { value: 'inspection', label: 'Ordinary inspections' }, { value: 'reinspection', label: 'Reinspections' }]} onChange={(value) => update('inspectionType', value)} /> : null}
    {relevant.includes('reinspectionStatus') ? <OptionSelector label="STATUS" value={filters.reinspectionStatus} options={[{ value: 'all', label: 'All statuses' }, { value: 'overdue', label: 'Overdue' }, { value: 'pending', label: 'Pending' }, { value: 'completed', label: 'Completed' }]} onChange={(value) => update('reinspectionStatus', value)} /> : null}
    {relevant.includes('accountStatus') ? <OptionSelector label="ACCOUNT STATUS" value={filters.accountStatus} options={[{ value: 'all', label: 'All accounts' }, { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} onChange={(value) => update('accountStatus', value)} /> : null}
    <View style={styles.evidenceToggle}><View style={styles.evidenceText}><Text style={styles.filterLabel}>INCLUDE PHOTO EVIDENCE</Text><Text style={adminStyles.caption}>Checklist answers and complete findings are always included. Photos are private and added only when enabled.</Text></View><Switch value={includePhotoEvidence} onValueChange={setIncludePhotoEvidence} trackColor={{ false: COLORS.border, true: COLORS.primaryLight }} thumbColor={includePhotoEvidence ? COLORS.primary : COLORS.surface} /></View>
    {loading ? <Text style={styles.preparing}>Preparing report preview…</Text> : null}{error ? <Text style={adminStyles.error}>{error}</Text> : null}
    {report ? <>
      <Text style={adminStyles.sectionTitle}>Report Preview</Text>
      <ReportPreview report={report} onOpen={(link) => router.push(link.kind === 'bsi' ? { pathname: '/admin/bsi/[id]', params: { id: link.id } } : { pathname: '/admin/inspection/[id]', params: { id: link.id } })} />
      {paginated ? <View style={styles.pagination}><AppButton title="Previous" variant="outline" disabled={page === 0 || loading} onPress={() => void loadPreview(page - 1)} /><Text style={adminStyles.caption}>Page {page + 1} · {total} matching records</Text><AppButton title="Next" variant="outline" disabled={(page + 1) * previewSize >= total || loading} onPress={() => void loadPreview(page + 1)} /></View> : null}
      <AppButton title={`Export PDF${total > EXPORT_LIMIT ? ` (first ${EXPORT_LIMIT})` : ''}`} loading={exporting} onPress={() => void exportPdf()} />
      <Text style={styles.exportNote}>PDF includes the complete filtered dataset up to {EXPORT_LIMIT} records; any cap is stated in the report.</Text>
    </> : null}
  </AdminPage>;
}

const styles = StyleSheet.create({
  catalog: { gap: SPACING.md, paddingRight: SPACING.lg }, reportCard: { width: 230, minHeight: 145, padding: SPACING.lg, gap: SPACING.sm, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, backgroundColor: COLORS.surface }, reportCardSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft }, reportName: { ...TYPOGRAPHY.subheading, color: COLORS.text }, reportDescription: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary },
  offline: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.md, borderRadius: RADIUS.md, backgroundColor: COLORS.offlineSoft }, offlineText: { ...TYPOGRAPHY.body, color: COLORS.offline }, dateFilters: { gap: SPACING.md }, dateField: { gap: SPACING.xs }, filterLabel: { ...TYPOGRAPHY.label, color: COLORS.textSecondary }, dateRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }, dateButton: { flex: 1, minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, backgroundColor: COLORS.surface }, dateValue: { ...TYPOGRAPHY.body, color: COLORS.text }, datePlaceholder: { ...TYPOGRAPHY.body, color: COLORS.textMuted }, evidenceToggle: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, backgroundColor: COLORS.surface }, evidenceText: { flex: 1, gap: SPACING.xs }, preparing: { ...TYPOGRAPHY.body, color: COLORS.primary, textAlign: 'center', padding: SPACING.md }, pagination: { gap: SPACING.sm, alignItems: 'center' }, exportNote: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, textAlign: 'center' },
});
