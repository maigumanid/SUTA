import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';

import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useInspection } from '@/context/InspectionContext';
import AppButton from '@/components/common/AppButton';

import {
  BinaryField,
  FieldError,
  InspectionChoice,
  InspectionDateField,
  YesNoField,
} from '@/components/inspection/InspectionControls';

import SanitationSection from '@/components/inspection/SanitationSection';

import { createInitialHouseholdInspection } from '@/constants/householdInspection';

import {
  COLORS,
  RADIUS,
  SPACING,
} from '@/constants/theme';

import {
  HouseholdInspection,
  WaterSourceType,
} from '@/types/householdInspection';

import {
  InspectionErrors,
  calculateSMDWS,
  hasErrors,
  validateSanitationSection,
  validateWaterSection,
} from '@/utils/householdInspectionValidation';

type SectionType = 'water' | 'sanitation';

export default function HouseholdChecklistScreen() {
const { placeId, tour } =
  useLocalSearchParams<{
    placeId?: string;
    tour?: string;
  }>();

const isTourActive = tour === 'true';

  const { setDraftInspection } =
    useInspection();

  const scrollRef = useRef<ScrollView>(null);

  const [currentSection, setCurrentSection] =
    useState<SectionType>('water');

  const [inspection, setInspection] =
    useState<HouseholdInspection>(() =>
      createInitialHouseholdInspection(placeId ?? '')
    );

  const [errors, setErrors] =
    useState<InspectionErrors>({});

  const water = inspection.safeWaterSupply;

  const clearError = (key: string) => {
    setErrors((current) => ({
      ...current,
      [key]: undefined,
    }));
  };

  const updateWater = (
    changes: Partial<
      HouseholdInspection['safeWaterSupply']
    >
  ) => {
    setInspection((current) => {
      const next: HouseholdInspection = {
        ...current,
        safeWaterSupply: {
          ...current.safeWaterSupply,
          ...changes,
        },
      };

      next.safeWaterSupply.smdwsStatus =
        calculateSMDWS(next);

      return next;
    });
  };

  const updateMicrobial = (
    changes: Partial<
      HouseholdInspection['safeWaterSupply']['microbialTest']
    >
  ) => {
    setInspection((current) => {
      const next: HouseholdInspection = {
        ...current,
        safeWaterSupply: {
          ...current.safeWaterSupply,
          microbialTest: {
            ...current.safeWaterSupply.microbialTest,
            ...changes,
          },
        },
      };

      next.safeWaterSupply.smdwsStatus =
        calculateSMDWS(next);

      return next;
    });
  };

  const updateArsenic = (
    changes: Partial<
      HouseholdInspection['safeWaterSupply']['arsenicTest']
    >
  ) => {
    setInspection((current) => ({
      ...current,
      safeWaterSupply: {
        ...current.safeWaterSupply,
        arsenicTest: {
          ...current.safeWaterSupply.arsenicTest,
          ...changes,
        },
      },
    }));
  };

  const selectWaterSource = (
    source: WaterSourceType
  ) => {
    updateWater({
      waterSourceType: source,
      otherWaterSource:
        source === 'others'
          ? water.otherWaterSource
          : '',
    });

    clearError('waterSource');
    clearError('otherWaterSource');
  };

  const addMicrobialTest = () => {
    updateMicrobial({
      recorded: true,
    });
  };

  const removeMicrobialTest = () => {
    updateMicrobial({
      recorded: false,
      dateValidationDone: undefined,
      eColiResult: undefined,
    });

    clearError('microbialDate');
    clearError('microbialResult');
  };

  const showValidationFeedback = (
    validationErrors: InspectionErrors
  ) => {
    setErrors(validationErrors);

    scrollRef.current?.scrollTo({
      y: 0,
      animated: true,
    });

    Alert.alert(
      'Check Required Information',
      'Some required information is missing. Check the fields marked below.'
    );
  };

  const continueToSanitation = () => {
    const validationErrors =
      validateWaterSection(inspection);

    if (hasErrors(validationErrors)) {
      showValidationFeedback(validationErrors);
      return;
    }

    setErrors({});
    setCurrentSection('sanitation');

    setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: 0,
        animated: false,
      });
    }, 50);
  };

  const continueToReview = () => {
    const validationErrors =
      validateSanitationSection(inspection);

    if (hasErrors(validationErrors)) {
      showValidationFeedback(
        validationErrors
      );

      return;
    }

    setErrors({});

    setDraftInspection(inspection);

    router.push({
      pathname: '/inspection/summary',
      params: {
        ...(isTourActive
          ? { tour: 'true' }
          : {}),
      },
    });
  };

  const goBack = () => {
    if (currentSection === 'sanitation') {
      setErrors({});
      setCurrentSection('water');

      setTimeout(() => {
        scrollRef.current?.scrollTo({
          y: 0,
          animated: false,
        });
      }, 50);

      return;
    }

    router.back();
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          onPress={goBack}
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

        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>
            Household Inspection
          </Text>

          <Text style={styles.headerSubtitle}>
            {currentSection === 'water'
              ? 'Safe Water Supply'
              : 'Sanitation Facility'}
          </Text>
        </View>

        <View style={styles.stepBadge}>
          <Text style={styles.stepText}>
            {currentSection === 'water'
              ? '1 of 2'
              : '2 of 2'}
          </Text>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {currentSection === 'water' ? (
          <>
            <View style={styles.intro}>
              <View style={styles.introIcon}>
                <Ionicons
                  name="water-outline"
                  size={25}
                  color={COLORS.primary}
                />
              </View>

              <View style={styles.flex}>
                <Text style={styles.introTitle}>
                  Access to Basic Safe Water Supply
                </Text>

                <Text style={styles.introText}>
                  Complete the information observed or verified
                  during the household visit.
                </Text>
              </View>
            </View>

            <Section
              number="1"
              title="Type of Water Source"
              required
            >
              <Text style={styles.help}>
                Select one water source used by the household.
              </Text>

              <InspectionChoice
                selected={
                  water.waterSourceType === 'level_1'
                }
                title="Level I"
                description="Point source"
                onPress={() =>
                  selectWaterSource('level_1')
                }
              />

              <InspectionChoice
                selected={
                  water.waterSourceType === 'level_2'
                }
                title="Level II"
                description="Communal faucet system or stand posts"
                onPress={() =>
                  selectWaterSource('level_2')
                }
              />

              <InspectionChoice
                selected={
                  water.waterSourceType === 'level_3'
                }
                title="Level III"
                description="Waterworks system or individual house connection"
                onPress={() =>
                  selectWaterSource('level_3')
                }
              />

              <InspectionChoice
                selected={
                  water.waterSourceType === 'others'
                }
                title="Others"
                description="Water supply facility or source subject to re-contamination"
                onPress={() =>
                  selectWaterSource('others')
                }
              />

              {errors.waterSource && (
                <FieldError
                  text={errors.waterSource}
                />
              )}

              {water.waterSourceType === 'others' && (
                <View style={styles.conditional}>
                  <Text style={styles.label}>
                    Specify water source
                  </Text>

                  <Text style={styles.help}>
                    Example: open dug well, unimproved spring,
                    or surface water.
                  </Text>

                  <TextInput
                    value={water.otherWaterSource}
                    onChangeText={(value) => {
                      updateWater({
                        otherWaterSource: value,
                      });

                      clearError('otherWaterSource');
                    }}
                    placeholder="Enter water source"
                    placeholderTextColor={
                      COLORS.textMuted
                    }
                    style={[
                      styles.input,
                      errors.otherWaterSource &&
                        styles.inputError,
                    ]}
                  />

                  {errors.otherWaterSource && (
                    <FieldError
                      text={errors.otherWaterSource}
                    />
                  )}
                </View>
              )}
            </Section>

            <Section
              number="2"
              title="Location of Water Source"
              required
            >
              <Text style={styles.question}>
                Is the water source located inside the
                dwelling or within its premises (yard/land)?
              </Text>

              <YesNoField
                value={water.locatedWithinPremises}
                error={errors.location}
                onChange={(value) => {
                  updateWater({
                    locatedWithinPremises: value,
                  });

                  clearError('location');
                }}
              />
            </Section>

            <Section
              number="3"
              title="Water Availability"
              required
            >
              <Text style={styles.question}>
                Is the water supply available at least
                12 hours per day?
              </Text>

              <YesNoField
                value={
                  water.availableAtLeast12Hours
                }
                error={errors.availability}
                onChange={(value) => {
                  updateWater({
                    availableAtLeast12Hours:
                      value,
                  });

                  clearError('availability');
                }}
              />
            </Section>

            <View style={styles.categoryHeader}>
              <Text style={styles.categoryTitle}>
                VALIDATION / RANDOM SAMPLING / TESTING
              </Text>

              <Text style={styles.categoryText}>
                Testing information is optional. Record it
                only when a test result is available.
              </Text>
            </View>

            <Section
              number="4"
              title="Microbial Testing"
              optional
            >
              {!water.microbialTest.recorded ? (
                <>
                  <View style={styles.optionalEmpty}>
                    <View
                      style={
                        styles.optionalEmptyIcon
                      }
                    >
                      <Ionicons
                        name="flask-outline"
                        size={24}
                        color={COLORS.textMuted}
                      />
                    </View>

                    <View style={styles.flex}>
                      <Text
                        style={
                          styles.optionalEmptyTitle
                        }
                      >
                        No microbial test recorded
                      </Text>

                      <Text
                        style={
                          styles.optionalEmptyText
                        }
                      >
                        You may skip this section if no
                        microbial test information is
                        available.
                      </Text>
                    </View>
                  </View>

                  <Pressable
                    onPress={addMicrobialTest}
                    style={({ pressed }) => [
                      styles.addButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Ionicons
                      name="add-circle-outline"
                      size={20}
                      color={COLORS.primary}
                    />

                    <Text
                      style={styles.addButtonText}
                    >
                      Add Microbial Test Result
                    </Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <InspectionDateField
                    label="Date validation done"
                    value={
                      water.microbialTest
                        .dateValidationDone
                    }
                    error={errors.microbialDate}
                    onChange={(value) => {
                      updateMicrobial({
                        dateValidationDone:
                          value,
                      });

                      clearError(
                        'microbialDate'
                      );
                    }}
                  />

                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>
                      Microbial Test Result
                    </Text>

                    <Text style={styles.help}>
                      Select the recorded E. coli result.
                    </Text>

                    <BinaryField
                      value={
                        water.microbialTest
                          .eColiResult
                      }
                      yesLabel="Presence of E. coli"
                      noLabel="Absence of E. coli"
                      error={
                        errors.microbialResult
                      }
                      onChange={(value) => {
                        updateMicrobial({
                          eColiResult: value,
                        });

                        clearError(
                          'microbialResult'
                        );
                      }}
                    />
                  </View>

                  <Pressable
                    onPress={removeMicrobialTest}
                    style={({ pressed }) => [
                      styles.removeButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={18}
                      color={COLORS.violation}
                    />

                    <Text
                      style={
                        styles.removeButtonText
                      }
                    >
                      Remove Microbial Test Result
                    </Text>
                  </Pressable>
                </>
              )}
            </Section>

            <Section
              number="5"
              title="Physico-Chemical Test for Arsenic"
              optional
            >
              <Text style={styles.question}>
                Was arsenic testing conducted?
              </Text>

              <YesNoField
                value={
                  water.arsenicTest.conducted
                }
                onChange={(value) => {
                  updateArsenic(
                    value
                      ? {
                          conducted: true,
                        }
                      : {
                          conducted: false,
                          dateTestingDone:
                            undefined,
                          result: undefined,
                        }
                  );

                  clearError('arsenicDate');
                  clearError('arsenicResult');
                }}
              />

              {water.arsenicTest.conducted && (
                <View style={styles.conditional}>
                  <InspectionDateField
                    label="Date testing done"
                    value={
                      water.arsenicTest
                        .dateTestingDone
                    }
                    error={errors.arsenicDate}
                    onChange={(value) => {
                      updateArsenic({
                        dateTestingDone: value,
                      });

                      clearError('arsenicDate');
                    }}
                  />

                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>
                      Arsenic Test Result
                    </Text>

                    <BinaryField
                      value={
                        water.arsenicTest.result
                      }
                      yesLabel="Within allowable PNSDW limit for arsenic"
                      noLabel="Above allowable PNSDW limit for arsenic"
                      error={errors.arsenicResult}
                      onChange={(value) => {
                        updateArsenic({
                          result: value,
                        });

                        clearError(
                          'arsenicResult'
                        );
                      }}
                    />
                  </View>
                </View>
              )}
            </Section>

            <Section
              number="6"
              title="SMDWS Status"
            >
              {water.smdwsStatus === undefined ? (
                <View style={styles.notDetermined}>
                  <Ionicons
                    name="remove-circle-outline"
                    size={23}
                    color={COLORS.warning}
                  />

                  <View style={styles.flex}>
                    <Text
                      style={
                        styles.notDeterminedTitle
                      }
                    >
                      Not Determined
                    </Text>

                    <Text
                      style={
                        styles.notDeterminedText
                      }
                    >
                      No microbial test result is
                      available. The inspection can still
                      continue, but SMDWS cannot be
                      determined from the available
                      information.
                    </Text>
                  </View>
                </View>
              ) : water.smdwsStatus === 1 ? (
                <View style={styles.statusResult}>
                  <Ionicons
                    name="checkmark-circle"
                    size={23}
                    color={COLORS.compliant}
                  />

                  <View style={styles.flex}>
                    <Text
                      style={styles.statusTitle}
                    >
                      Yes — SMDWS
                    </Text>

                    <Text
                      style={styles.statusDescription}
                    >
                      The recorded information meets the
                      conditions for Safely Managed
                      Drinking Water Services.
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.statusResult}>
                  <Ionicons
                    name="close-circle"
                    size={23}
                    color={COLORS.violation}
                  />

                  <View style={styles.flex}>
                    <Text
                      style={styles.statusTitle}
                    >
                      No — SMDWS
                    </Text>

                    <Text
                      style={styles.statusDescription}
                    >
                      The recorded information does not
                      meet all conditions for Safely
                      Managed Drinking Water Services.
                    </Text>
                  </View>
                </View>
              )}

              <View style={styles.info}>
                <Ionicons
                  name="information-circle-outline"
                  size={19}
                  color={COLORS.info}
                />

                <Text style={styles.infoText}>
                  Based on the supplied form, SMDWS
                  requires Level I or Level III, location
                  within the dwelling or premises,
                  availability of at least 12 hours per
                  day, and freedom from fecal
                  contamination.
                </Text>
              </View>
            </Section>

            <AppButton
              title="Continue to Sanitation"
              onPress={continueToSanitation}
            />
          </>
        ) : (
          <>
            <SanitationSection
              inspection={inspection}
              errors={errors}
              onChange={(next) => {
                setInspection(next);

                setErrors((current) => ({
                  ...current,
                  toiletType: undefined,
                  shared: undefined,
                  disposal: undefined,
                }));
              }}
            />

            <View style={styles.remarks}>
              <View style={styles.remarksHeader}>
                <Ionicons
                  name="document-text-outline"
                  size={21}
                  color={COLORS.primary}
                />

                <View style={styles.flex}>
                  <Text style={styles.remarksTitle}>
                    Remarks
                  </Text>

                  <Text style={styles.optionalLabel}>
                    Optional
                  </Text>
                </View>
              </View>

              <Text style={styles.help}>
                Add observations or other relevant
                information from the household visit.
              </Text>

              <TextInput
                value={inspection.remarks}
                onChangeText={(value) =>
                  setInspection((current) => ({
                    ...current,
                    remarks: value,
                  }))
                }
                placeholder="Enter remarks if applicable..."
                placeholderTextColor={
                  COLORS.textMuted
                }
                multiline
                textAlignVertical="top"
                style={styles.remarksInput}
              />
            </View>

            <AppButton
              title="Continue to Review"
              onPress={continueToReview}
            />

            <Pressable
              onPress={goBack}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name="arrow-back-outline"
                size={18}
                color={COLORS.primary}
              />

              <Text style={styles.secondaryText}>
                Back to Safe Water Supply
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Section({
  number,
  title,
  required,
  optional,
  children,
}: {
  number: string;
  title: string;
  required?: boolean;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.number}>
          <Text style={styles.numberText}>
            {number}
          </Text>
        </View>

        <View style={styles.flex}>
          <Text style={styles.sectionTitle}>
            {title}
          </Text>

          {required && (
            <Text style={styles.required}>
              Required
            </Text>
          )}

          {optional && (
            <Text style={styles.optionalLabel}>
              Optional
            </Text>
          )}
        </View>
      </View>

      <View style={styles.sectionBody}>
        {children}
      </View>
    </View>
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

  headerContent: {
    flex: 1,
  },

  headerTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: COLORS.text,
  },

  headerSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: COLORS.textSecondary,
  },

  stepBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: COLORS.primarySoft,
  },

  stepText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },

  content: {
    gap: SPACING.lg,
    padding: SPACING.lg,
    paddingBottom: 50,
  },

  intro: {
    flexDirection: 'row',
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primarySoft,
  },

  introIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
  },

  introTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },

  introText: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textSecondary,
  },

  section: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },

  number: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: COLORS.primarySoft,
  },

  numberText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primary,
  },

  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },

  required: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.violation,
  },

  optionalLabel: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
  },

  sectionBody: {
    gap: SPACING.sm,
    padding: SPACING.md,
  },

  help: {
    fontSize: 11,
    lineHeight: 17,
    color: COLORS.textSecondary,
  },

  question: {
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.text,
  },

  label: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },

  conditional: {
    gap: SPACING.md,
    marginTop: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primarySoft,
  },

  input: {
    minHeight: 50,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    fontSize: 14,
    color: COLORS.text,
  },

  inputError: {
    borderColor: COLORS.violation,
  },

  fieldGroup: {
    gap: SPACING.sm,
  },

  categoryHeader: {
    paddingVertical: 4,
  },

  categoryTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    color: COLORS.primary,
  },

  categoryText: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textSecondary,
  },

  optionalEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.background,
  },

  optionalEmptyIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    backgroundColor: COLORS.surface,
  },

  optionalEmptyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },

  optionalEmptyText: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 16,
    color: COLORS.textSecondary,
  },

  addButton: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
  },

  addButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },

  removeButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: SPACING.sm,
  },

  removeButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.violation,
  },

  notDetermined: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.background,
  },

  notDeterminedTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },

  notDeterminedText: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 17,
    color: COLORS.textSecondary,
  },

  statusResult: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.background,
  },

  statusTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },

  statusDescription: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 17,
    color: COLORS.textSecondary,
  },

  info: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.background,
  },

  infoText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 17,
    color: COLORS.textSecondary,
  },

  remarks: {
    gap: SPACING.sm,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
  },

  remarksHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },

  remarksTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },

  remarksInput: {
    minHeight: 120,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.background,
    fontSize: 14,
    color: COLORS.text,
  },

  secondaryButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },

  secondaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },

  pressed: {
    opacity: 0.7,
  },
});
