import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { type Href, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import OptionSelector from '@/components/admin/OptionSelector';
import AppButton from '@/components/common/AppButton';
import EntranceTransition from '@/components/common/EntranceTransition';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useNetwork } from '@/context/NetworkContext';
import { usePlaces } from '@/context/PlacesContext';
import { importPlaces } from '@/services/placeService';
import {
  IMPORT_FIELDS,
  IMPORT_FIELD_LABELS,
  type ColumnMapping,
  type ParsedCsv,
  parseCsv,
  reviewImportRows,
  suggestedColumnMapping,
} from '@/utils/placeImport';

type Step = 'select' | 'map' | 'review' | 'result';
type ReviewFilter = 'attention' | 'ready' | 'all';
const MAX_ROWS = 500;
const MAX_FILE_BYTES = 2 * 1024 * 1024;

export default function PlaceImportScreen() {
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const { isOnline } = useNetwork();
  const { places, refreshPlaces } = usePlaces();
  const [step, setStep] = useState<Step>('select');
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('attention');
  const [allowedDuplicates, setAllowedDuplicates] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState({ imported: 0, invalid: 0, duplicates: 0, starter: 0 });

  const reviewed = useMemo(
    () => parsed && mapping ? reviewImportRows(parsed, mapping, places) : [],
    [mapping, parsed, places]
  );
  const importable = reviewed.filter(
    (row) => row.issues.length === 0 && (!row.duplicateOf || allowedDuplicates.has(row.rowNumber))
  );
  const attention = reviewed.filter((row) => row.issues.length > 0 || row.duplicateOf || !row.complete);
  const visibleRows = (reviewFilter === 'attention'
    ? attention
    : reviewFilter === 'ready'
      ? importable
      : reviewed).slice(0, 100);

  const selectFile = async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'text/plain'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (picked.canceled) return;
      const asset = picked.assets[0];
      if (asset.size && asset.size > MAX_FILE_BYTES) {
        Alert.alert('CSV too large', 'Choose a CSV smaller than 2 MB.');
        return;
      }
      if (!asset.name.toLowerCase().endsWith('.csv')) {
        Alert.alert('CSV required', 'SUTA accepts comma-separated CSV files in this phase.');
        return;
      }
      const csvText = asset.file ? await asset.file.text() : await new File(asset.uri).text();
      const nextParsed = parseCsv(csvText);
      if (nextParsed.rows.length > MAX_ROWS) {
        Alert.alert('Too many rows', `Import up to ${MAX_ROWS} places at a time so review remains safe on a phone.`);
        return;
      }
      setFileName(asset.name);
      setParsed(nextParsed);
      setMapping(suggestedColumnMapping(nextParsed.headers));
      setAllowedDuplicates(new Set());
      setStep('map');
    } catch (error) {
      Alert.alert('Unable to read CSV', error instanceof Error ? error.message : 'The selected file could not be read.');
    }
  };

  const continueToReview = () => {
    if (!mapping?.name || !mapping.address) {
      Alert.alert('Map required fields', 'Choose the CSV columns for place / household name and address.');
      return;
    }
    if (mapping.name === mapping.address) {
      Alert.alert('Check the mapping', 'Name and address must come from different CSV columns.');
      return;
    }
    setReviewFilter('attention');
    setStep('review');
  };

  const runImport = async () => {
    if (!user || !profile || profile.role !== 'bsi') return;
    if (!isOnline) {
      Alert.alert('Connection required', 'CSV review works locally, but saving the reviewed batch requires a connection.');
      return;
    }
    if (importable.length === 0) {
      Alert.alert('Nothing ready to import', 'Resolve the mapping or review duplicate rows first.');
      return;
    }

    setImporting(true);
    try {
      const batchId = `import_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const imported = await importPlaces(
        importable.map((row) => row.data),
        user.uid,
        profile.assignedBarangayId,
        profile.assignedBarangay,
        batchId
      );
      await refreshPlaces();
      setResult({
        imported: imported.length,
        invalid: reviewed.filter((row) => row.issues.length > 0).length,
        duplicates: reviewed.filter((row) => row.duplicateOf && !allowedDuplicates.has(row.rowNumber)).length,
        starter: importable.filter((row) => !row.complete).length,
      });
      setStep('result');
    } catch (error) {
      Alert.alert('Import not completed', error instanceof Error ? error.message : 'No reviewed rows could be saved.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(SPACING.section, insets.bottom + SPACING.xxl) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => step === 'select' ? router.back() : setStep(step === 'review' ? 'map' : 'select')} style={styles.back}>
            <Ionicons name="arrow-back" size={22} color={COLORS.text} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>CENSUS ONBOARDING</Text>
            <Text style={styles.title}>Bring the barangay list into the field</Text>
          </View>
        </View>

        <StepRail current={step} />

        {step === 'select' ? (
          <EntranceTransition>
            <View style={styles.hero}>
              <View style={styles.routeMotif}><View style={styles.routeLine} /><View style={styles.routeDotA} /><View style={styles.routeDotB} /><Ionicons name="document-text" size={32} color={COLORS.primary} /></View>
              <Text style={styles.heroTitle}>Start with the source list</Text>
              <Text style={styles.heroText}>Select a CSV from the health center or census team. Nothing is saved until you map, validate, and review the rows.</Text>
              <AppButton title="Select CSV file" onPress={selectFile} disabled={profile?.role !== 'bsi'} style={styles.primaryAction} />
              <Text style={styles.limitText}>Required columns: name and address · Up to {MAX_ROWS} rows / 2 MB</Text>
            </View>
            <View style={styles.guide}>
              <Text style={styles.sectionTitle}>Accepted starter fields</Text>
              <Text style={styles.body}>Name and address are required. Representative, purok, contact number, place type, and notes are optional. Missing representative or purok creates a clearly marked starter record.</Text>
              <View style={styles.formatNote}><Ionicons name="information-circle" size={20} color={COLORS.info} /><Text style={styles.formatText}>CSV is supported in this bounded pass. XLSX is intentionally excluded to avoid a large spreadsheet parser and keep on-device review predictable.</Text></View>
            </View>
          </EntranceTransition>
        ) : null}

        {step === 'map' && parsed && mapping ? (
          <EntranceTransition>
            <View style={styles.fileBanner}>
              <View style={styles.fileIcon}><Ionicons name="document-text" size={22} color={COLORS.primary} /></View>
              <View style={styles.flex}><Text style={styles.fileName}>{fileName}</Text><Text style={styles.meta}>{parsed.rows.length} rows · {parsed.headers.length} columns detected</Text></View>
              <Pressable onPress={selectFile}><Text style={styles.link}>Change</Text></Pressable>
            </View>
            <Text style={styles.sectionTitle}>Match the columns</Text>
            <Text style={styles.body}>SUTA made a best guess from the header names. Confirm the two required fields and map any optional data you have.</Text>
            <View style={styles.mappingList}>
              {IMPORT_FIELDS.map((field) => (
                <OptionSelector
                  key={field}
                  label={`${IMPORT_FIELD_LABELS[field].toUpperCase()}${field === 'name' || field === 'address' ? ' *' : ''}`}
                  value={mapping[field]}
                  options={[{ value: '', label: 'Not included' }, ...parsed.headers.map((header) => ({ value: header, label: header }))]}
                  onChange={(value) => setMapping((current) => current ? { ...current, [field]: value } : current)}
                />
              ))}
            </View>
            <AppButton title="Validate mapped rows" onPress={continueToReview} style={styles.primaryAction} />
          </EntranceTransition>
        ) : null}

        {step === 'review' ? (
          <EntranceTransition>
            <View style={styles.summaryBand}>
              <SummaryStat value={importable.length} label="Ready" tone="good" />
              <SummaryStat value={reviewed.filter((row) => !row.complete && row.issues.length === 0).length} label="Starter" tone="warn" />
              <SummaryStat value={reviewed.filter((row) => row.duplicateOf).length} label="Duplicates" tone="info" />
              <SummaryStat value={reviewed.filter((row) => row.issues.length > 0).length} label="Invalid" tone="bad" />
            </View>
            <View style={styles.reviewHeading}><View style={styles.flex}><Text style={styles.sectionTitle}>Review before import</Text><Text style={styles.body}>Potential duplicates stay excluded unless you explicitly include them.</Text></View></View>
            <View style={styles.filters}>
              {(['attention', 'ready', 'all'] as ReviewFilter[]).map((filter) => (
                <Pressable key={filter} onPress={() => setReviewFilter(filter)} style={[styles.filter, reviewFilter === filter && styles.filterActive]}>
                  <Text style={[styles.filterText, reviewFilter === filter && styles.filterTextActive]}>{filter === 'attention' ? 'Needs attention' : filter === 'ready' ? 'Ready' : 'All rows'}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.rowList}>
              {visibleRows.map((row) => {
                const duplicateIncluded = allowedDuplicates.has(row.rowNumber);
                return (
                  <View key={row.rowNumber} style={[styles.reviewRow, row.issues.length > 0 && styles.reviewInvalid]}>
                    <View style={styles.rowTop}><Text style={styles.rowNumber}>ROW {row.rowNumber}</Text><Text style={styles.rowState}>{row.issues.length ? 'INVALID' : row.duplicateOf ? (duplicateIncluded ? 'INCLUDED' : 'POSSIBLE DUPLICATE') : row.complete ? 'READY' : 'STARTER'}</Text></View>
                    <Text style={styles.rowName}>{row.data.name || 'Missing name'}</Text>
                    <Text style={styles.rowAddress}>{row.data.address || 'Missing address'}{row.data.purok ? ` · ${row.data.purok}` : ''}</Text>
                    {row.issues.map((issue) => <Text key={issue} style={styles.issue}>• {issue}</Text>)}
                    {!row.complete && row.issues.length === 0 ? <Text style={styles.starterNote}>Will be marked “Needs completion”</Text> : null}
                    {row.duplicateOf ? (
                      <Pressable onPress={() => setAllowedDuplicates((current) => {
                        const next = new Set(current);
                        if (next.has(row.rowNumber)) next.delete(row.rowNumber); else next.add(row.rowNumber);
                        return next;
                      })} style={styles.duplicateAction}>
                        <Text style={styles.duplicateText}>{row.duplicateOf} · {duplicateIncluded ? 'Exclude again' : 'Import anyway'}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
              {visibleRows.length === 0 ? <Text style={styles.emptyText}>No rows in this review view.</Text> : null}
              {(reviewFilter === 'all' ? reviewed : reviewFilter === 'ready' ? importable : attention).length > 100 ? <Text style={styles.limitText}>Showing the first 100 rows in this view. The full validated batch will be imported.</Text> : null}
            </View>
            <AppButton title={`Import ${importable.length} reviewed place${importable.length === 1 ? '' : 's'}`} onPress={runImport} loading={importing} disabled={importable.length === 0 || !isOnline} style={styles.primaryAction} />
            {!isOnline ? <Text style={styles.offlineText}>Reconnect to save this reviewed batch. Your selected file has not been uploaded.</Text> : null}
          </EntranceTransition>
        ) : null}

        {step === 'result' ? (
          <EntranceTransition>
            <View style={styles.resultHero}>
              <View style={styles.successMark}><Ionicons name="checkmark" size={34} color={COLORS.white} /></View>
              <Text style={styles.heroTitle}>Census batch added</Text>
              <Text style={styles.heroText}>{result.imported} place records are now part of {profile?.assignedBarangay}. They can be searched, completed, queued, and inspected.</Text>
            </View>
            <View style={styles.resultLedger}>
              <LedgerRow label="Imported" value={result.imported} />
              <LedgerRow label="Marked for completion" value={result.starter} />
              <LedgerRow label="Invalid rows skipped" value={result.invalid} />
              <LedgerRow label="Potential duplicates skipped" value={result.duplicates} />
            </View>
            <View style={styles.resultActions}>
              <AppButton title="Open Field Plan" onPress={() => router.replace('/field-planning' as Href)} />
              <AppButton title="View all places" variant="outline" onPress={() => router.replace('/(tabs)/establishments')} />
            </View>
          </EntranceTransition>
        ) : null}
      </ScrollView>
    </View>
  );
}

function StepRail({ current }: { current: Step }) {
  const steps: Step[] = ['select', 'map', 'review', 'result'];
  const active = steps.indexOf(current);
  return <View style={styles.stepRail}>{steps.map((step, index) => <View key={step} style={styles.stepItem}><View style={[styles.stepDot, index <= active && styles.stepDotActive]}>{index < active ? <Ionicons name="checkmark" size={12} color={COLORS.white} /> : <Text style={[styles.stepNumber, index <= active && styles.stepNumberActive]}>{index + 1}</Text>}</View>{index < steps.length - 1 ? <View style={[styles.stepLine, index < active && styles.stepLineActive]} /> : null}</View>)}</View>;
}

function SummaryStat({ value, label, tone }: { value: number; label: string; tone: 'good' | 'warn' | 'info' | 'bad' }) {
  return <View style={styles.summaryStat}><Text style={[styles.summaryValue, styles[`tone_${tone}`]]}>{value}</Text><Text style={styles.summaryLabel}>{label}</Text></View>;
}

function LedgerRow({ label, value }: { label: string; value: number }) {
  return <View style={styles.ledgerRow}><Text style={styles.body}>{label}</Text><Text style={styles.ledgerValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  content: { width: '100%', maxWidth: 700, alignSelf: 'center', padding: SPACING.lg, paddingBottom: SPACING.section },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md, marginBottom: SPACING.xl },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.lg, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  headerCopy: { flex: 1 }, eyebrow: { ...TYPOGRAPHY.tiny, fontWeight: '800', letterSpacing: 1.2, color: COLORS.primary },
  title: { ...TYPOGRAPHY.title, marginTop: 3, color: COLORS.text },
  stepRail: { flexDirection: 'row', marginBottom: SPACING.xxl, paddingHorizontal: SPACING.sm },
  stepItem: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  stepDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surfaceMuted, borderWidth: 1, borderColor: COLORS.border },
  stepDotActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  stepNumber: { ...TYPOGRAPHY.tiny, color: COLORS.textMuted }, stepNumberActive: { color: COLORS.white, fontWeight: '800' },
  stepLine: { flex: 1, height: 2, backgroundColor: COLORS.border }, stepLineActive: { backgroundColor: COLORS.aqua },
  hero: { alignItems: 'center', padding: SPACING.xxl, borderRadius: RADIUS.xxl, backgroundColor: COLORS.primarySoft, borderWidth: 1, borderColor: COLORS.primaryLight, overflow: 'hidden' },
  routeMotif: { width: 112, height: 88, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md },
  routeLine: { position: 'absolute', width: 92, height: 46, borderWidth: 2, borderColor: COLORS.aqua, borderRadius: 24, transform: [{ rotate: '-10deg' }] },
  routeDotA: { position: 'absolute', left: 2, bottom: 14, width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.warning },
  routeDotB: { position: 'absolute', right: 3, top: 9, width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.aqua },
  heroTitle: { ...TYPOGRAPHY.heading, color: COLORS.text, textAlign: 'center' },
  heroText: { ...TYPOGRAPHY.bodySmall, color: COLORS.textSecondary, textAlign: 'center', marginTop: SPACING.sm, maxWidth: 460 },
  primaryAction: { alignSelf: 'stretch', marginTop: SPACING.xl },
  limitText: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, textAlign: 'center', marginTop: SPACING.md },
  guide: { marginTop: SPACING.xxl }, sectionTitle: { ...TYPOGRAPHY.heading, color: COLORS.text },
  body: { ...TYPOGRAPHY.bodySmall, color: COLORS.textSecondary, marginTop: SPACING.xs },
  formatNote: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg, padding: SPACING.md, borderRadius: RADIUS.lg, backgroundColor: COLORS.infoSoft },
  formatText: { ...TYPOGRAPHY.caption, flex: 1, color: COLORS.infoDark },
  fileBanner: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md, marginBottom: SPACING.xl, borderRadius: RADIUS.xl, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.subtle },
  fileIcon: { width: 44, height: 44, borderRadius: RADIUS.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primarySoft },
  flex: { flex: 1 }, fileName: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text }, meta: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary }, link: { ...TYPOGRAPHY.caption, fontWeight: '800', color: COLORS.primary },
  mappingList: { gap: SPACING.lg, marginTop: SPACING.xl },
  summaryBand: { flexDirection: 'row', paddingVertical: SPACING.lg, borderRadius: RADIUS.xl, backgroundColor: COLORS.primaryDeep, marginBottom: SPACING.xl },
  summaryStat: { flex: 1, alignItems: 'center', paddingHorizontal: SPACING.xs }, summaryValue: { ...TYPOGRAPHY.metric, fontSize: 26, color: COLORS.white }, summaryLabel: { ...TYPOGRAPHY.tiny, color: 'rgba(255,255,255,0.72)', textAlign: 'center' },
  tone_good: { color: '#A7E1C1' }, tone_warn: { color: '#F5D58E' }, tone_info: { color: '#A9DCE4' }, tone_bad: { color: '#F3B0AA' },
  reviewHeading: { flexDirection: 'row', gap: SPACING.md }, filters: { flexDirection: 'row', gap: SPACING.sm, marginVertical: SPACING.lg },
  filter: { minHeight: 38, justifyContent: 'center', paddingHorizontal: SPACING.md, borderRadius: RADIUS.pill, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  filterActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary }, filterText: { ...TYPOGRAPHY.caption, fontWeight: '700', color: COLORS.textSecondary }, filterTextActive: { color: COLORS.white },
  rowList: { gap: SPACING.sm }, reviewRow: { padding: SPACING.md, borderRadius: RADIUS.lg, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  reviewInvalid: { borderColor: '#F0C8C4', backgroundColor: '#FFFAF9' }, rowTop: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACING.sm },
  rowNumber: { ...TYPOGRAPHY.tiny, fontWeight: '800', letterSpacing: 0.8, color: COLORS.textMuted }, rowState: { ...TYPOGRAPHY.tiny, fontWeight: '800', color: COLORS.primary },
  rowName: { ...TYPOGRAPHY.bodyMedium, color: COLORS.text, marginTop: SPACING.xs }, rowAddress: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary }, issue: { ...TYPOGRAPHY.caption, color: COLORS.violation, marginTop: 2 },
  starterNote: { ...TYPOGRAPHY.caption, color: COLORS.warningDark, marginTop: SPACING.xs }, duplicateAction: { marginTop: SPACING.sm, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, borderRadius: RADIUS.md, backgroundColor: COLORS.infoSoft }, duplicateText: { ...TYPOGRAPHY.caption, fontWeight: '700', color: COLORS.infoDark },
  emptyText: { ...TYPOGRAPHY.bodySmall, color: COLORS.textMuted, textAlign: 'center', padding: SPACING.xl }, offlineText: { ...TYPOGRAPHY.caption, color: COLORS.offline, textAlign: 'center', marginTop: SPACING.sm },
  resultHero: { alignItems: 'center', paddingVertical: SPACING.xxl }, successMark: { width: 68, height: 68, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.compliant, marginBottom: SPACING.lg, transform: [{ rotate: '-4deg' }] },
  resultLedger: { paddingHorizontal: SPACING.lg, borderRadius: RADIUS.xl, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border }, ledgerRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: COLORS.divider }, ledgerValue: { ...TYPOGRAPHY.subheading, color: COLORS.text },
  resultActions: { gap: SPACING.md, marginTop: SPACING.xxl, paddingHorizontal: SPACING.xs, paddingBottom: SPACING.md },
});

