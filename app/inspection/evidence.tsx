import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import AppButton from '@/components/common/AppButton';
import EvidencePreviewGallery from '@/components/inspection/EvidencePreviewGallery';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useInspection } from '@/context/InspectionContext';
import {
  deleteEvidencePhoto,
  EvidenceSource,
  selectEvidencePhoto,
} from '@/services/evidenceService';
import {
  FindingCategory,
  InspectionFinding,
} from '@/types/householdInspection';

export default function EvidenceScreen() {
  const { tour } = useLocalSearchParams<{
    tour?: string;
  }>();
  const {
    draftInspection,
    setDraftInspection,
  } = useInspection();

  const [findings, setFindings] = useState<
    InspectionFinding[]
  >(draftInspection?.findings ?? []);
  const [activeFindingId, setActiveFindingId] =
    useState<string | null>(null);

  if (!draftInspection) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons
          name="images-outline"
          size={48}
          color={COLORS.textMuted}
        />
        <Text style={styles.emptyTitle}>
          No inspection found
        </Text>
        <Text style={styles.emptyText}>
          Complete the checklist and findings before attaching evidence.
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

  const updateFindings = (
    nextFindings: InspectionFinding[]
  ) => {
    setFindings(nextFindings);
    setDraftInspection({
      ...draftInspection,
      findings: nextFindings,
    });
  };

  const addEvidence = async (
    findingId: string,
    source: EvidenceSource
  ) => {
    if (activeFindingId) {
      return;
    }

    setActiveFindingId(findingId);
    const result = await selectEvidencePhoto(source);
    setActiveFindingId(null);

    if (result.status === 'canceled') {
      return;
    }

    if (result.status === 'permission_denied') {
      Alert.alert(
        'Camera Permission Required',
        'SUTA cannot capture evidence without camera permission.',
        result.canAskAgain
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

    if (result.status === 'error') {
      Alert.alert(
        'Evidence Not Saved',
        result.message
      );
      return;
    }

    updateFindings(
      findings.map((finding) =>
        finding.id === findingId
          ? {
              ...finding,
              evidence: [
                ...finding.evidence,
                result.attachment,
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
            updateFindings(
              findings.map((finding) =>
                finding.id === findingId
                  ? {
                      ...finding,
                      evidence:
                        finding.evidence.filter(
                          (item) =>
                            item.id !== evidenceId
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
    setDraftInspection({
      ...draftInspection,
      findings,
    });

    router.push({
      pathname: '/inspection/summary',
      params: {
        ...(tour === 'true'
          ? { tour: 'true' }
          : {}),
      },
    });
  };

  return (
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
            Photo Evidence
          </Text>
          <Text style={styles.headerSubtitle}>
            Attach photos to the correct finding
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.infoCard}>
          <Ionicons
            name="information-circle-outline"
            size={22}
            color={COLORS.info}
          />
          <Text style={styles.infoText}>
            Evidence is optional. Photos are stored on this device with the inspection and can be synchronized later.
          </Text>
        </View>

        {findings.map((finding, index) => (
          <View
            key={finding.id}
            style={styles.findingCard}
          >
            <Text style={styles.findingNumber}>
              Finding {index + 1} · {finding.evidence.length} {finding.evidence.length === 1 ? 'photo' : 'photos'}
            </Text>
            <Text style={styles.category}>
              {getCategoryLabel(finding.category)}
            </Text>
            <Text style={styles.details}>
              {finding.details}
            </Text>

            <EvidencePreviewGallery
              evidence={finding.evidence}
              onRemove={(evidence) => removeEvidence(finding.id, evidence.id, evidence.uri)}
            />

            <View style={styles.actions}>
              <EvidenceButton
                icon="camera-outline"
                label="Take Photo"
                disabled={activeFindingId !== null}
                onPress={() =>
                  void addEvidence(
                    finding.id,
                    'camera'
                  )
                }
              />
              <EvidenceButton
                icon="images-outline"
                label="Choose Photo"
                disabled={activeFindingId !== null}
                onPress={() =>
                  void addEvidence(
                    finding.id,
                    'library'
                  )
                }
              />
            </View>

            {activeFindingId === finding.id && (
              <Text style={styles.savingText}>
                Preparing evidence photo...
              </Text>
            )}
          </View>
        ))}

        <AppButton
          title="Continue to Review"
          onPress={continueToReview}
          disabled={activeFindingId !== null}
        />
      </ScrollView>
    </View>
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
  switch (category) {
    case 'safe_water_supply':
      return 'Safe Water Supply';
    case 'sanitation':
      return 'Sanitation';
    default:
      return 'Other';
  }
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
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.infoSoft,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textSecondary,
  },
  findingCard: {
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
  },
  findingNumber: {
    ...TYPOGRAPHY.bodyMedium,
    fontSize: 14,
    color: COLORS.text,
  },
  category: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.violation,
  },
  details: {
    ...TYPOGRAPHY.caption,
    marginTop: SPACING.sm,
    lineHeight: 19,
    color: COLORS.text,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
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
    ...TYPOGRAPHY.label,
    fontSize: 12,
    color: COLORS.primary,
  },
  savingText: {
    marginTop: SPACING.sm,
    textAlign: 'center',
    fontSize: 11,
    color: COLORS.textSecondary,
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
