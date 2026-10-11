import { Ionicons } from '@expo/vector-icons';
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
} from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import AppButton from '@/components/common/AppButton';
import KeyboardSafeView from '@/components/common/KeyboardSafeView';
import EvidencePreviewGallery from '@/components/inspection/EvidencePreviewGallery';
import InspectionProgress from '@/components/inspection/InspectionProgress';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useInspection } from '@/context/InspectionContext';
import { useNetwork } from '@/context/NetworkContext';
import { usePlaces } from '@/context/PlacesContext';
import { fetchStoredInspectionById } from '@/services/inspectionHistoryService';
import { getStoredInspectionById, type StoredInspection } from '@/storage/inspectionStorage';
import { getCachedInspectionById } from '@/storage/inspectionHistoryCache';
import {
  FindingCategory,
  InspectionFinding,
  InspectionResult,
} from '@/types/householdInspection';
import {
  deleteEvidencePhoto,
  type EvidenceSource,
  selectEvidencePhoto,
} from '@/services/evidenceService';

const RESULT_OPTIONS: {
  value: InspectionResult;
  label: string;
  description: string;
  color: string;
}[] = [
  {
    value: 'compliant',
    label: 'Compliant',
    description: 'No findings requiring corrective action were recorded.',
    color: COLORS.compliant,
  },
  {
    value: 'non_compliant',
    label: 'Non-Compliant',
    description: 'One or more sanitary findings were recorded.',
    color: COLORS.violation,
  },
  {
    value: 'for_reinspection',
    label: 'For Reinspection',
    description: 'Findings require a scheduled follow-up inspection.',
    color: COLORS.warning,
  },
];

const CATEGORY_OPTIONS: {
  value: FindingCategory;
  label: string;
}[] = [
  {
    value: 'safe_water_supply',
    label: 'Safe Water Supply',
  },
  {
    value: 'sanitation',
    label: 'Sanitation',
  },
  {
    value: 'other',
    label: 'Other',
  },
];

export default function ViolationsScreen() {
  const { profile } = useAuth();
  const { isOnline } = useNetwork();
  const { getPlaceById } = usePlaces();
  const { tour } = useLocalSearchParams<{
    tour?: string;
  }>();

  const {
    draftInspection,
    setDraftInspection,
  } = useInspection();

  const [result, setResult] =
    useState<InspectionResult | undefined>(
      draftInspection?.result
    );

  const [findings, setFindings] = useState<
    InspectionFinding[]
  >(draftInspection?.findings ?? []);

  const [category, setCategory] =
    useState<FindingCategory | undefined>();
  const [details, setDetails] = useState('');
  const [remarks, setRemarks] = useState(
    draftInspection?.remarks ?? ''
  );
  const [formError, setFormError] = useState('');
  const [activeFindingId, setActiveFindingId] =
    useState<string | null>(null);
  const [originalInspection, setOriginalInspection] = useState<StoredInspection | null>(null);

  useEffect(() => {
    setDraftInspection((current) =>
      current
        ? {
            ...current,
            result,
            findings,
            remarks,
          }
        : current
    );
  }, [findings, remarks, result, setDraftInspection]);

  useFocusEffect(
    useCallback(() => {
      setResult(draftInspection?.result);
      setFindings(draftInspection?.findings ?? []);
      setRemarks(draftInspection?.remarks ?? '');
    }, [draftInspection])
  );

  useEffect(() => {
    const originalInspectionId = draftInspection?.reinspectionOfInspectionId;
    if (!originalInspectionId || !profile) {
      setOriginalInspection(null);
      return;
    }
    let active = true;
    const scope = { bsiUid: profile.uid, barangayId: profile.assignedBarangayId };
    void (async () => {
      try {
        let original = await getStoredInspectionById(originalInspectionId, scope);
        if (!original) original = await getCachedInspectionById(originalInspectionId, scope);
        if (!original && isOnline !== false) original = await fetchStoredInspectionById(originalInspectionId, scope);
        if (active) setOriginalInspection(original);
      } catch (error) {
        console.warn('Unable to load original finding evidence:', error);
        if (active) setOriginalInspection(null);
      }
    })();
    return () => { active = false; };
  }, [draftInspection?.reinspectionOfInspectionId, isOnline, profile]);

  if (!draftInspection) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons
          name="alert-circle-outline"
          size={48}
          color={COLORS.textMuted}
        />
        <Text style={styles.emptyTitle}>
          No inspection found
        </Text>
        <Text style={styles.emptyText}>
          Complete the household checklist before recording findings.
        </Text>
        <AppButton
          title="Go to Places"
          onPress={() =>
            router.replace('/(tabs)/establishments')
          }
        />
      </View>
    );
  }

  const place = getPlaceById(draftInspection.placeId);

  const addFinding = () => {
    if (!category || !details.trim()) {
      setFormError(
        'Select a category and enter the finding details.'
      );
      return;
    }

    setFindings((current) => [
      ...current,
      {
        id: `finding_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 7)}`,
        category,
        details: details.trim(),
        evidence: [],
      },
    ]);
    setCategory(undefined);
    setDetails('');
    setFormError('');
  };

  const removeFinding = (findingId: string) => {
    if (findings.find((finding) => finding.id === findingId)?.correctiveAction) return;
    findings
      .find((finding) => finding.id === findingId)
      ?.evidence.forEach((evidence) =>
        deleteEvidencePhoto(evidence.uri)
      );

    setFindings((current) =>
      current.filter(
        (finding) => finding.id !== findingId
      )
    );
  };

  const updateCorrectiveAction = (findingId: string, changes: Partial<NonNullable<InspectionFinding['correctiveAction']>>) => {
    setFindings((current) => current.map((finding) => finding.id === findingId && finding.correctiveAction
      ? { ...finding, correctiveAction: { ...finding.correctiveAction, ...changes } }
      : finding));
  };

  const addEvidence = async (
    findingId: string,
    source: EvidenceSource
  ) => {
    if (activeFindingId) {
      return;
    }

    setActiveFindingId(findingId);
    const selection = await selectEvidencePhoto(source);
    setActiveFindingId(null);

    if (selection.status === 'canceled') {
      return;
    }

    if (selection.status === 'permission_denied') {
      Alert.alert(
        'Camera Permission Required',
        'SUTA cannot capture evidence without camera permission.',
        selection.canAskAgain
          ? [{ text: 'OK' }]
          : [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Open Settings',
                onPress: () => {
                  void Linking.openSettings();
                },
              },
            ]
      );
      return;
    }

    if (selection.status === 'error') {
      Alert.alert('Evidence Not Saved', selection.message);
      return;
    }

    setFindings((current) =>
      current.map((finding) =>
        finding.id === findingId
          ? {
              ...finding,
              evidence: [
                ...finding.evidence,
                selection.attachment,
              ],
            }
          : finding
      )
    );
  };

  const removeEvidence = (
    findingId: string,
    evidenceId: string,
    uri: string
  ) => {
    Alert.alert(
      'Remove Evidence',
      'Remove this photo from the finding?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            deleteEvidencePhoto(uri);
            setFindings((current) =>
              current.map((finding) =>
                finding.id === findingId
                  ? {
                      ...finding,
                      evidence: finding.evidence.filter(
                        (item) => item.id !== evidenceId
                      ),
                    }
                  : finding
              )
            );
          },
        },
      ]
    );
  };

  const continueToReview = () => {
    if (category || details.trim()) {
      Alert.alert(
        'Finding Not Added',
        'Complete and add the current finding, or clear its category and details before continuing.'
      );
      return;
    }

    if (!result) {
      Alert.alert(
        'Select Inspection Result',
        'Choose the final inspection result before continuing.'
      );
      return;
    }

    const unresolvedEntries = findings.filter((finding) => !finding.correctiveAction);
    if (
      result === 'compliant' &&
      unresolvedEntries.length > 0
    ) {
      Alert.alert(
        'Result Does Not Match Findings',
        'Remove the recorded findings or select a non-compliant result.'
      );
      return;
    }

    if (
      result !== 'compliant' &&
      findings.length === 0
    ) {
      Alert.alert(
        'Finding Required',
        'Record at least one finding for a non-compliant or reinspection result.'
      );
      return;
    }

    setDraftInspection((current) =>
      current
        ? {
            ...current,
            result,
            findings,
            remarks,
          }
        : current
    );

    requestAnimationFrame(() => {
      router.push({
        pathname: '/inspection/summary',
        params: {
          ...(tour === 'true'
            ? { tour: 'true' }
            : {}),
        },
      });
    });
  };

  return (
    <KeyboardSafeView>
      <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name="arrow-back"
            size={23}
            color={COLORS.text}
          />
        </Pressable>

        <View style={styles.flex}>
          <Text style={styles.headerTitle}>
            Findings & Result
          </Text>
          <Text style={styles.headerSubtitle}>
            Record concerns only when applicable
          </Text>
        </View>
      </View>

      <ScrollView
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <InspectionProgress currentStep={4} placeName={place?.name} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Inspection Result
          </Text>
          <Text style={styles.helpText}>
            Select the outcome supported by the completed inspection and recorded findings.
          </Text>

          <View style={styles.optionList}>
            {RESULT_OPTIONS.map((option) => {
              const selected =
                result === option.value;

              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() =>
                    setResult(option.value)
                  }
                  style={({ pressed }) => [
                    styles.resultOption,
                    selected && {
                      borderColor: option.color,
                      backgroundColor:
                        option.value === 'compliant'
                          ? COLORS.compliantSoft
                          : option.value ===
                              'for_reinspection'
                            ? COLORS.warningSoft
                            : COLORS.violationSoft,
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons
                    name={
                      selected
                        ? 'radio-button-on'
                        : 'radio-button-off'
                    }
                    size={22}
                    color={
                      selected
                        ? option.color
                        : COLORS.textMuted
                    }
                  />
                  <View style={styles.flex}>
                    <Text style={styles.optionTitle}>
                      {option.label}
                    </Text>
                    <Text style={styles.optionText}>
                      {option.description}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <View style={styles.flex}>
              <Text style={styles.sectionTitle}>
                Findings / Violations
              </Text>
              <Text style={styles.helpText}>
                Required only for Non-Compliant or For Reinspection.
              </Text>
            </View>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>
                {findings.length}
              </Text>
            </View>
          </View>

          {findings.map((finding, index) => (
            <View
              key={finding.id}
              style={styles.findingCard}
            >
              <View style={styles.findingHeader}>
                <Text style={styles.findingTitle}>
                  Finding {index + 1}
                </Text>
                <View style={styles.findingHeaderActions}>
                  <Text style={styles.evidenceCount}>{finding.evidence.length} {finding.evidence.length === 1 ? 'photo' : 'photos'}</Text>
                  {finding.correctiveAction ? <Text style={styles.correctiveStatus}>{finding.correctiveAction.status}</Text> : <Pressable accessibilityRole="button" accessibilityLabel={`Remove finding ${index + 1}`} onPress={() => removeFinding(finding.id)} hitSlop={10}><Ionicons name="trash-outline" size={20} color={COLORS.violation} /></Pressable>}
                </View>
              </View>
              <Text style={styles.findingMetaLabel}>FINDING CATEGORY</Text>
              <Text style={styles.categoryLabel}>
                {getCategoryLabel(finding.category)}
              </Text>
              <Text style={styles.findingMetaLabel}>SPECIFIC FINDING</Text>
              <Text style={styles.findingDetails}>
                {finding.details}
              </Text>

              {finding.correctiveAction ? (() => {
                const beforeFinding = originalInspection?.findings.find((item) => item.id === finding.correctiveAction?.originalFindingId);
                return <View style={styles.correctiveSection}>
                  <View style={styles.comparisonHeader}><View style={styles.comparisonRule} /><Text style={styles.fieldLabel}>BEFORE · ORIGINAL EVIDENCE</Text><View style={styles.comparisonRule} /></View>
                  {beforeFinding?.evidence.length ? <EvidencePreviewGallery evidence={beforeFinding.evidence} /> : <Text style={styles.emptyEvidence}>No original evidence attached.</Text>}
                  <Text style={styles.fieldLabel}>CURRENT CORRECTIVE STATUS</Text>
                  <View style={styles.correctiveOptions}>{(['Unresolved', 'Partially Corrected', 'Corrected'] as const).map((status) => <Pressable key={status} accessibilityRole="radio" accessibilityState={{ selected: finding.correctiveAction?.status === status }} onPress={() => updateCorrectiveAction(finding.id, { status })} style={[styles.correctiveOption, finding.correctiveAction?.status === status && styles.correctiveOptionSelected]}><Text style={[styles.correctiveOptionText, finding.correctiveAction?.status === status && styles.correctiveOptionTextSelected]}>{status}</Text></Pressable>)}</View>
                  <View style={styles.comparisonHeader}><View style={styles.comparisonRule} /><Text style={styles.fieldLabel}>AFTER · FOLLOW-UP EVIDENCE</Text><View style={styles.comparisonRule} /></View>
                  {finding.evidence.length ? <EvidencePreviewGallery evidence={finding.evidence} onRemove={(attachment) => removeEvidence(finding.id, attachment.id, attachment.uri)} /> : <Text style={styles.emptyEvidence}>No follow-up evidence added.</Text>}
                  <View style={styles.evidenceActions}>
                    <EvidenceButton icon="camera-outline" label="Take Photo" disabled={activeFindingId !== null} onPress={() => void addEvidence(finding.id, 'camera')} />
                    <EvidenceButton icon="images-outline" label="Choose Photo" disabled={activeFindingId !== null} onPress={() => void addEvidence(finding.id, 'library')} />
                  </View>
                  <Text style={styles.fieldLabel}>VERIFICATION NOTE · OPTIONAL</Text>
                  <TextInput value={finding.correctiveAction.verificationNote ?? ''} onChangeText={(value) => updateCorrectiveAction(finding.id, { verificationNote: value })} placeholder="Add a concise note if needed" placeholderTextColor={COLORS.textMuted} multiline textAlignVertical="top" style={styles.verificationInput} />
                </View>;
              })() : null}

              {!finding.correctiveAction ? <View style={styles.evidenceSection}>
                <Text style={styles.fieldLabel}>
                  Evidence · {finding.evidence.length}
                </Text>

                <Text style={styles.helpText}>
                  Optional photos remain attached to this finding.
                </Text>

                <EvidencePreviewGallery
                  evidence={finding.evidence}
                  onRemove={(attachment) =>
                    removeEvidence(
                      finding.id,
                      attachment.id,
                      attachment.uri
                    )
                  }
                />

                <View style={styles.evidenceActions}>
                  <EvidenceButton
                    icon="camera-outline"
                    label="Take Photo"
                    disabled={activeFindingId !== null}
                    onPress={() => {
                      void addEvidence(finding.id, 'camera');
                    }}
                  />
                  <EvidenceButton
                    icon="images-outline"
                    label="Choose Photo"
                    disabled={activeFindingId !== null}
                    onPress={() => {
                      void addEvidence(finding.id, 'library');
                    }}
                  />
                </View>

                {activeFindingId === finding.id && (
                  <Text style={styles.preparingEvidence}>
                    Preparing evidence photo...
                  </Text>
                )}
              </View> : null}
            </View>
          ))}

          <View style={styles.formCard}>
            <Text style={styles.fieldLabel}>
              Finding Category
            </Text>
            <View style={styles.categoryOptions}>
              {CATEGORY_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: category === option.value }}
                  onPress={() => {
                    setCategory((current) =>
                      current === option.value
                        ? undefined
                        : option.value
                    );
                    setFormError('');
                  }}
                  style={({ pressed }) => [
                    styles.categoryChip,
                    category === option.value &&
                      styles.categoryChipSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      category === option.value &&
                        styles.categoryChipTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>
              Specific Finding / Notes
            </Text>
            <Text style={styles.helpText}>
              You may use the phone keyboard’s voice-dictation button.
            </Text>
            <TextInput
              value={details}
              onChangeText={(value) => {
                setDetails(value);
                setFormError('');
              }}
              placeholder="Describe the observed condition and required corrective action..."
              placeholderTextColor={COLORS.textMuted}
              multiline
              textAlignVertical="top"
              style={[
                styles.input,
                formError !== '' && styles.inputError,
              ]}
            />

            {formError !== '' && (
              <Text style={styles.errorText}>
                {formError}
              </Text>
            )}

            <AppButton
              title="+ Add Finding"
              variant="outline"
              onPress={addFinding}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Remarks
          </Text>
          <Text style={styles.helpText}>
            Add any other relevant observations from the household visit. This is optional.
          </Text>
          <TextInput
            value={remarks}
            onChangeText={setRemarks}
            placeholder="Enter remarks if applicable..."
            placeholderTextColor={COLORS.textMuted}
            multiline
            textAlignVertical="top"
            style={styles.input}
          />
        </View>

        <AppButton
          title="Continue to Review"
          onPress={continueToReview}
        />
      </ScrollView>
      </View>
    </KeyboardSafeView>
  );
}

function EvidenceButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.evidenceButton,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Ionicons
        name={icon}
        size={19}
        color={COLORS.primary}
      />
      <Text style={styles.evidenceButtonText}>
        {label}
      </Text>
    </Pressable>
  );
}

function getCategoryLabel(
  category: FindingCategory
) {
  return (
    CATEGORY_OPTIONS.find(
      (option) => option.value === category
    )?.label ?? 'Other'
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  backButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primarySoft,
  },
  headerTitle: {
    ...TYPOGRAPHY.heading,
    fontSize: 19,
    color: COLORS.text,
  },
  headerSubtitle: {
    ...TYPOGRAPHY.caption,
    marginTop: 2,
    color: COLORS.textSecondary,
  },
  content: {
    width: '100%',
    maxWidth: 700,
    alignSelf: 'center',
    gap: SPACING.lg,
    padding: SPACING.lg,
    paddingBottom: 50,
  },
  section: {
    gap: SPACING.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  sectionTitle: {
    ...TYPOGRAPHY.subheading,
    fontSize: 16,
    color: COLORS.text,
  },
  helpText: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 17,
    color: COLORS.textSecondary,
  },
  optionList: {
    gap: SPACING.sm,
  },
  resultOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
  },
  optionTitle: {
    ...TYPOGRAPHY.bodyMedium,
    fontSize: 14,
    color: COLORS.text,
  },
  optionText: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 16,
    color: COLORS.textSecondary,
  },
  countBadge: {
    minWidth: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: COLORS.primarySoft,
  },
  countText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primary,
  },
  findingCard: {
    padding: SPACING.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.violation,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceElevated,
  },
  findingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  findingTitle: {
    ...TYPOGRAPHY.label,
    color: COLORS.text,
  },
  categoryLabel: {
    marginTop: SPACING.xs,
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.violation,
  },
  findingDetails: {
    ...TYPOGRAPHY.caption,
    marginTop: SPACING.sm,
    lineHeight: 19,
    color: COLORS.text,
  },
  findingHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  evidenceCount: { fontSize: 10, fontWeight: '700', color: COLORS.textSecondary },
  correctiveStatus: { fontSize: 10, fontWeight: '800', color: COLORS.primary },
  findingMetaLabel: { marginTop: SPACING.sm, fontSize: 9, fontWeight: '800', letterSpacing: 0.7, color: COLORS.textMuted },
  correctiveSection: { gap: SPACING.sm, marginTop: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.divider },
  comparisonHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.xs },
  comparisonRule: { flex: 1, height: 1, backgroundColor: COLORS.border },
  emptyEvidence: { fontSize: 11, color: COLORS.textMuted, fontStyle: 'italic' },
  correctiveOptions: { gap: 6 },
  correctiveOption: { minHeight: 40, justifyContent: 'center', paddingHorizontal: SPACING.md, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, backgroundColor: COLORS.background },
  correctiveOptionSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  correctiveOptionText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  correctiveOptionTextSelected: { color: COLORS.primary, fontWeight: '800' },
  verificationInput: { minHeight: 68, padding: SPACING.sm, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, backgroundColor: COLORS.background, fontSize: 13, lineHeight: 18, color: COLORS.text },
  evidenceSection: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  evidenceActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  evidenceButton: {
    flex: 1,
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
  },
  evidenceButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  preparingEvidence: {
    marginTop: SPACING.sm,
    textAlign: 'center',
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  formCard: {
    gap: SPACING.sm,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  categoryOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.background,
  },
  categoryChipSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primarySoft,
  },
  categoryChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  categoryChipTextSelected: {
    color: COLORS.primary,
  },
  input: {
    minHeight: 120,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.background,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.text,
  },
  inputError: {
    borderColor: COLORS.violation,
  },
  errorText: {
    fontSize: 11,
    color: COLORS.violation,
  },
  disabled: {
    opacity: 0.5,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    padding: SPACING.xl,
    backgroundColor: COLORS.background,
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: COLORS.text,
  },
  emptyText: {
    maxWidth: 320,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.textSecondary,
  },
  pressed: {
    opacity: 0.7,
  },
});
