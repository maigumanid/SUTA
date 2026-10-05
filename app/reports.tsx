import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import OptionSelector from '@/components/admin/OptionSelector';
import AppButton from '@/components/common/AppButton';
import ScreenContainer from '@/components/common/ScreenContainer';
import ReportPreview from '@/components/reports/ReportPreview';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useInspectionSync } from '@/context/InspectionSyncContext';
import { fetchInspectionRecords } from '@/services/inspectionRecordService';
import { fetchInspectionReport, fetchPriorityPlaces, fetchReinspectionReport, fetchReportSummary } from '@/services/reportService';
import { DEFAULT_REPORT_FILTERS, type BsiReportKind, type ReportFilters, type ReportViewModel } from '@/types/report';
import { formatLocalDate } from '@/utils/dateTime';
import { shareReportPdf } from '@/utils/reportPdf';
import { buildInspectionViewModel, buildReinspectionViewModel, buildSummaryViewModel, reportScope } from '@/utils/reportViewModel';

const EXPORT_LIMIT = 500;
const definitions: { kind: BsiReportKind; title: string; description: string }[] = [
  { kind: 'my_activity', title: 'My Inspection Activity', description: 'Your inspections, outcomes, risk, and follow-up work.' },
  { kind: 'assigned_barangay_summary', title: 'Barangay Inspection Summary', description: 'Sanitation coverage and priorities in your assigned barangay.' },
  { kind: 'pending_reinspections', title: 'Pending / Overdue Reinspections', description: 'Authorized follow-up work for your assigned barangay.' },
];

function omitReportColumn(report: ReportViewModel, sectionTitle: string, column: string) {
  const section = report.sections.find((item) => item.title === sectionTitle);
  if (!section) return report;
  const index = section.columns.indexOf(column);
  if (index < 0) return report;
  section.columns = section.columns.filter((_, columnIndex) => columnIndex !== index);
  section.rows = section.rows.map((row) => row.filter((_, columnIndex) => columnIndex !== index));
  return report;
}

function DateFilter({ label, value, onChange }: { label: string; value?: string; onChange: (value?: string) => void }) {
  const [open, setOpen] = useState(false); const select = (event: DateTimePickerEvent, date?: Date) => { setOpen(false); if (event.type === 'set' && date) onChange(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`); };
  return <View style={styles.dateField}><Text style={styles.label}>{label}</Text><View style={styles.dateRow}><Pressable style={styles.dateButton} onPress={() => setOpen(true)}><Text style={value ? styles.value : styles.placeholder}>{value ? formatLocalDate(value) : 'Any date'}</Text><Ionicons name="calendar-outline" size={20} color={COLORS.primary} /></Pressable>{value ? <Pressable onPress={() => onChange(undefined)}><Ionicons name="close-circle" size={25} color={COLORS.textMuted} /></Pressable> : null}</View>{open ? <DateTimePicker value={value ? new Date(`${value}T00:00:00`) : new Date()} mode="date" onChange={select} /> : null}</View>;
}

export default function BsiReportsScreen() {
  const { user, profile } = useAuth(); const { isOnline } = useInspectionSync(); const [kind, setKind] = useState<BsiReportKind>('my_activity');
  const [filters, setFilters] = useState<ReportFilters>({ ...DEFAULT_REPORT_FILTERS, reinspectionStatus: 'pending' }); const [report, setReport] = useState<ReportViewModel | null>(null); const [loading, setLoading] = useState(false); const [exporting, setExporting] = useState(false); const [error, setError] = useState<string | null>(null);
  const [includePhotoEvidence, setIncludePhotoEvidence] = useState(false);
  const definition = definitions.find((item) => item.kind === kind) ?? definitions[0]; const barangayId = profile?.assignedBarangayId ?? ''; const barangayName = profile?.assignedBarangay ?? 'Assigned barangay'; const jurisdiction = profile?.jurisdictionName ?? barangayName;
  const scopedFilters = useMemo(() => ({ ...filters, barangayId, bsiId: kind === 'my_activity' ? user?.uid ?? '' : 'all', reinspectionStatus: kind === 'pending_reinspections' ? filters.reinspectionStatus : 'all' }), [barangayId, filters, kind, user?.uid]);
  const scope = useMemo(() => reportScope(scopedFilters, { barangay: barangayName, inspector: kind === 'my_activity' ? profile?.name ?? 'Current BSI' : 'Authorized barangay records' }, kind === 'my_activity' ? ['barangayId', 'bsiId'] : kind === 'pending_reinspections' ? ['barangayId', 'reinspectionStatus'] : ['barangayId']), [barangayName, kind, profile?.name, scopedFilters]);

  const build = useCallback(async (exportMode = false) => {
    const limit = exportMode ? EXPORT_LIMIT : 20;
    const attachRecords = async (view: ReportViewModel, ids: string[], matchingTotal: number) => { const uniqueIds = [...new Set(ids)]; return { ...view, inspectionRecords: await fetchInspectionRecords(uniqueIds), layoutKind: kind, includePhotoEvidence, generatedBy: 'bsi' as const, preparedBy: profile?.name ?? 'Barangay Sanitary Inspector', ...(view.totalCount === undefined ? { exportedCount: uniqueIds.length, totalCount: matchingTotal } : {}) }; };
    if (kind === 'my_activity') { const [data, followUps] = await Promise.all([fetchInspectionReport(scopedFilters, 0, limit), fetchReinspectionReport({ ...scopedFilters, reinspectionStatus: 'all' }, 0, limit)]); const view = buildInspectionViewModel(definition.title, jurisdiction, scopedFilters, scope, data.rows, data.total); view.metrics.push({ label: 'Non-Compliant', value: String(data.rows.filter((row) => row.result === 'non_compliant').length) }, { label: 'For Reinspection', value: String(data.rows.filter((row) => row.result === 'for_reinspection').length) }, { label: 'Low / Moderate / High Risk', value: `${data.rows.filter((row) => row.riskLevel === 'Low').length} / ${data.rows.filter((row) => row.riskLevel === 'Moderate').length} / ${data.rows.filter((row) => row.riskLevel === 'High').length}` }, { label: 'Follow-ups Completed / Pending', value: `${followUps.rows.filter((row) => row.status === 'Completed').length} / ${followUps.rows.filter((row) => row.status !== 'Completed').length}` }); return attachRecords(view, data.rows.map((row) => row.id), data.total); }
    if (kind === 'assigned_barangay_summary') { const barangays = [{ id: barangayId, name: barangayName }]; const [summary, recent, priority] = await Promise.all([fetchReportSummary(scopedFilters, barangays), fetchInspectionReport(scopedFilters, 0, limit), fetchPriorityPlaces(scopedFilters, 0, limit)]); const view = omitReportColumn(buildSummaryViewModel({ title: definition.title, jurisdiction, filters: scopedFilters, scope, summary, recent: recent.rows, priority: priority.rows, barangayMode: true, includeWorkforce: false }), 'Recent Inspections', 'Inspector'); return attachRecords(view, recent.rows.map((row) => row.id), recent.total); }
    const data = await fetchReinspectionReport(scopedFilters, 0, limit); const view = buildReinspectionViewModel(definition.title, jurisdiction, scopedFilters, scope, data.rows, data.total); omitReportColumn(view, 'Overdue', 'Assigned BSI'); omitReportColumn(view, 'Pending', 'Assigned BSI'); omitReportColumn(view, 'Completed', 'Assigned BSI'); return attachRecords(view, data.rows.flatMap((row) => [row.originalInspectionId, ...(row.completedInspectionId ? [row.completedInspectionId] : [])]), data.total);
  }, [barangayId, barangayName, definition.title, includePhotoEvidence, jurisdiction, kind, profile?.name, scope, scopedFilters]);
  const load = useCallback(async () => { if (!user || !barangayId) return; if (isOnline === false) { setReport(null); setError('Reports require an internet connection. Your offline inspection workflow is unchanged.'); return; } setLoading(true); setError(null); try { setReport(await build()); } catch (caught) { setReport(null); setError(caught instanceof Error ? caught.message : 'Unable to prepare the report.'); } finally { setLoading(false); } }, [barangayId, build, isOnline, user]);
  useEffect(() => { const timer = setTimeout(() => { void load(); }, 400); return () => clearTimeout(timer); }, [load]);
  const updateDate = (key: 'startDate' | 'endDate', value?: string) => setFilters((current) => ({ ...current, [key]: value }));
  const exportPdf = async () => { setExporting(true); try { await shareReportPdf(await build(true)); } catch (caught) { Alert.alert('Unable to Export PDF', caught instanceof Error ? caught.message : 'Please try again.'); } finally { setExporting(false); } };

  return <ScreenContainer><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
    <View style={styles.header}><Pressable accessibilityLabel="Back" style={styles.back} onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={COLORS.text} /></Pressable><View style={styles.headerText}><Text style={styles.title}>Reports</Text><Text style={styles.subtitle}>Your assigned barangay: {barangayName}</Text></View></View>
    {isOnline === false ? <View style={styles.offline}><Ionicons name="cloud-offline-outline" size={20} color={COLORS.offline} /><Text style={styles.offlineText}>Reports require connectivity.</Text></View> : null}
    <Text style={styles.heading}>Report Type</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catalog}>{definitions.map((item) => <Pressable key={item.kind} style={[styles.card, item.kind === kind && styles.selected]} onPress={() => setKind(item.kind)}><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.body}>{item.description}</Text></Pressable>)}</ScrollView>
    <Text style={styles.heading}>Report Scope</Text><Text style={styles.scope}>Barangay scope is fixed by your authorized profile and enforced by Supabase RLS.</Text><DateFilter label="FROM" value={filters.startDate} onChange={(value) => updateDate('startDate', value)} /><DateFilter label="TO" value={filters.endDate} onChange={(value) => updateDate('endDate', value)} />
    {kind === 'pending_reinspections' ? <OptionSelector label="STATUS" value={filters.reinspectionStatus} options={[{ value: 'pending', label: 'Pending and upcoming' }, { value: 'overdue', label: 'Overdue' }, { value: 'all', label: 'All authorized reinspections' }]} onChange={(value) => setFilters((current) => ({ ...current, reinspectionStatus: value }))} /> : null}
    <View style={styles.evidenceToggle}><View style={styles.evidenceText}><Text style={styles.label}>INCLUDE PHOTO EVIDENCE</Text><Text style={styles.scope}>Complete checklists and findings are always included. Enable this only when the submitted report requires photos.</Text></View><Switch value={includePhotoEvidence} onValueChange={setIncludePhotoEvidence} trackColor={{ false: COLORS.border, true: COLORS.primaryLight }} thumbColor={includePhotoEvidence ? COLORS.primary : COLORS.surface} /></View>
    {loading ? <Text style={styles.preparing}>Preparing report preview…</Text> : null}{error ? <Text style={styles.error}>{error}</Text> : null}{report ? <><ReportPreview report={report} /><AppButton title="Export PDF" loading={exporting} onPress={() => void exportPdf()} /><Text style={styles.note}>PDF includes up to {EXPORT_LIMIT} matching records and states any applied cap.</Text></> : null}
  </ScrollView></ScreenContainer>;
}

const styles = StyleSheet.create({
  content: { paddingVertical: SPACING.xl, gap: SPACING.lg }, header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md }, back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, headerText: { flex: 1 }, title: { ...TYPOGRAPHY.display, color: COLORS.text }, subtitle: { ...TYPOGRAPHY.body, color: COLORS.textSecondary }, heading: { ...TYPOGRAPHY.heading, color: COLORS.text }, catalog: { gap: SPACING.md, paddingRight: SPACING.lg }, card: { width: 225, minHeight: 115, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.lg, gap: SPACING.sm }, selected: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft }, cardTitle: { ...TYPOGRAPHY.subheading, color: COLORS.text }, body: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary }, scope: { ...TYPOGRAPHY.body, color: COLORS.textSecondary }, dateField: { gap: SPACING.xs }, label: { ...TYPOGRAPHY.label, color: COLORS.textSecondary }, dateRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }, dateButton: { flex: 1, minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, backgroundColor: COLORS.surface }, value: { ...TYPOGRAPHY.body, color: COLORS.text }, placeholder: { ...TYPOGRAPHY.body, color: COLORS.textMuted }, evidenceToggle: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, backgroundColor: COLORS.surface }, evidenceText: { flex: 1, gap: SPACING.xs }, offline: { flexDirection: 'row', gap: SPACING.sm, padding: SPACING.md, borderRadius: RADIUS.md, backgroundColor: COLORS.offlineSoft }, offlineText: { ...TYPOGRAPHY.body, color: COLORS.offline }, preparing: { ...TYPOGRAPHY.body, color: COLORS.primary, textAlign: 'center' }, error: { ...TYPOGRAPHY.body, color: COLORS.violation }, note: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, textAlign: 'center' },
});
