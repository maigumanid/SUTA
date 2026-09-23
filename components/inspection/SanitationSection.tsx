import { Ionicons } from '@expo/vector-icons';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  BinaryField,
  FieldError,
  InspectionChoice,
} from '@/components/inspection/InspectionControls';

import {
  COLORS,
  RADIUS,
  SPACING,
} from '@/constants/theme';

import {
  InspectionErrors,
  calculateBSF,
  calculateSMSS,
} from '@/utils/householdInspectionValidation';

import {
  HouseholdInspection,
  SanitaryFacilityType,
  UnsanitaryToiletType,
} from '@/types/householdInspection';

type Props = {
  inspection: HouseholdInspection;
  errors: InspectionErrors;
  onChange: (
    inspection: HouseholdInspection
  ) => void;
};

export default function SanitationSection({
  inspection,
  errors,
  onChange,
}: Props) {
  const sanitation =
    inspection.sanitationFacility;

  const update = (
    changes: Partial<
      HouseholdInspection['sanitationFacility']
    >
  ) => {
    const updated: HouseholdInspection = {
      ...inspection,
      sanitationFacility: {
        ...sanitation,
        ...changes,
      },
    };

    updated.sanitationFacility.basicSanitationFacility =
      calculateBSF(updated);

    updated.sanitationFacility.smssStatus =
      calculateSMSS(updated);

    onChange(updated);
  };

  const selectSanitary = (
    type: SanitaryFacilityType
  ) => {
    const updated: HouseholdInspection = {
      ...inspection,
      sanitationFacility: {
        ...sanitation,

        sanitaryFacilityType: type,
        unsanitaryToiletType: undefined,

        sharedWithOtherHouseholds:
          sanitation.sharedWithOtherHouseholds,

        excretaDisposalMethod:
          sanitation.excretaDisposalMethod,

        basicSanitationFacility:
          undefined,

        smssStatus: undefined,
      },
    };

    updated.sanitationFacility.basicSanitationFacility =
      calculateBSF(updated);

    updated.sanitationFacility.smssStatus =
      calculateSMSS(updated);

    onChange(updated);
  };

  const selectUnsanitary = (
    type: UnsanitaryToiletType
  ) => {
    const updated: HouseholdInspection = {
      ...inspection,
      sanitationFacility: {
        sanitaryFacilityType: undefined,
        unsanitaryToiletType: type,

        sharedWithOtherHouseholds:
          undefined,

        basicSanitationFacility: 0,

        excretaDisposalMethod:
          undefined,

        smssStatus: 0,
      },
    };

    onChange(updated);
  };

  const hasSanitary =
    sanitation.sanitaryFacilityType !==
    undefined;

  const hasUnsanitary =
    sanitation.unsanitaryToiletType !==
    undefined;

  return (
    <View style={styles.container}>
      <View style={styles.intro}>
        <View style={styles.introIcon}>
          <Ionicons
            name="home-outline"
            size={25}
            color={COLORS.primary}
          />
        </View>

        <View style={styles.flex}>
          <Text style={styles.introTitle}>
            Sanitation Facility
          </Text>

          <Text style={styles.introText}>
            Record the household sanitation facility and how excreta or sewage is managed.
          </Text>
        </View>
      </View>

      <Section
        number="1"
        title="Toilet Facility"
        required
      >
        <Text style={styles.help}>
          Select one classification that best describes the household toilet facility.
        </Text>

        <Text style={styles.subheading}>
          Sanitary Facility
        </Text>

        <InspectionChoice
          selected={
            sanitation.sanitaryFacilityType ===
            'septic_tank'
          }
          title="Pour/Flush Type"
          description="Connected to septic tank"
          onPress={() =>
            selectSanitary('septic_tank')
          }
        />

        <InspectionChoice
          selected={
            sanitation.sanitaryFacilityType ===
            'sewer_system'
          }
          title="Pour/Flush Type"
          description="Connected to sewer or sewage system"
          onPress={() =>
            selectSanitary('sewer_system')
          }
        />

        <InspectionChoice
          selected={
            sanitation.sanitaryFacilityType ===
            'vip_or_composting'
          }
          title="VIP Latrine / Composting Toilet"
          description="Ventilated Pit (VIP) latrine or composting toilet"
          onPress={() =>
            selectSanitary(
              'vip_or_composting'
            )
          }
        />

        <View style={styles.divider} />

        <Text style={styles.subheading}>
          Unsanitary Toilet
        </Text>

        <InspectionChoice
          selected={
            sanitation.unsanitaryToiletType ===
            3
          }
          code="3"
          title="Water sealed connected to open drain"
          onPress={() =>
            selectUnsanitary(3)
          }
        />

        <InspectionChoice
          selected={
            sanitation.unsanitaryToiletType ===
            2
          }
          code="2"
          title="Overhung latrine"
          onPress={() =>
            selectUnsanitary(2)
          }
        />

        <InspectionChoice
          selected={
            sanitation.unsanitaryToiletType ===
            1
          }
          code="1"
          title="Open pit latrine"
          onPress={() =>
            selectUnsanitary(1)
          }
        />

        <InspectionChoice
          selected={
            sanitation.unsanitaryToiletType ===
            0
          }
          code="0"
          title="Without toilet"
          onPress={() =>
            selectUnsanitary(0)
          }
        />

        {errors.toiletType && (
          <FieldError
            text={errors.toiletType}
          />
        )}
      </Section>

      {hasSanitary && (
        <>
          <Section
            number="2"
            title="Shared Toilet"
            required
          >
            <Text style={styles.question}>
              Is the toilet shared with other households in a separate dwelling?
            </Text>

            <BinaryField
              value={
                sanitation.sharedWithOtherHouseholds
              }
              yesLabel="Yes — Shared"
              noLabel="No — Not Shared"
              error={errors.shared}
              onChange={(value) =>
                update({
                  sharedWithOtherHouseholds:
                    value,
                })
              }
            />
          </Section>

          <Section
            number="3"
            title="Basic Sanitation Facility"
          >
            <CalculatedStatus
              value={
                sanitation.basicSanitationFacility
              }
              pendingText="Answer the shared toilet question first."
              yesText="Yes — Basic Sanitation Facility"
              noText="No — Does not meet Basic Sanitation Facility condition"
            />

            <Text style={styles.help}>
              This result is based on the sanitary toilet facility and whether it is shared with another household.
            </Text>
          </Section>

          <Section
            number="4"
            title="Disposal / Treatment of Excreta / Sewage"
            required
          >
            <InspectionChoice
              selected={
                sanitation.excretaDisposalMethod ===
                'onsite_treatment'
              }
              title="Stored and Treated On-site"
              description="Sewage/excreta is stored in a containment tank and treated, with sanitation by-products managed for reuse or disposal."
              onPress={() =>
                update({
                  excretaDisposalMethod:
                    'onsite_treatment',
                })
              }
            />

            <InspectionChoice
              selected={
                sanitation.excretaDisposalMethod ===
                'offsite_dislodging'
              }
              title="Dislodged and Treated Off-site"
              description="Stored in a containment tank, dislodged, transported, treated and disposed off-site."
              onPress={() =>
                update({
                  excretaDisposalMethod:
                    'offsite_dislodging',
                })
              }
            />

            <InspectionChoice
              selected={
                sanitation.excretaDisposalMethod ===
                'sewer_or_offsite_treatment'
              }
              title="Sewer / Off-site Treatment"
              description="Stored in a containment tank or conveyed through a sewer/sewerage system and treated off-site."
              onPress={() =>
                update({
                  excretaDisposalMethod:
                    'sewer_or_offsite_treatment',
                })
              }
            />

            {errors.disposal && (
              <FieldError
                text={errors.disposal}
              />
            )}
          </Section>

          <Section
            number="5"
            title="SMSS Status"
          >
            <CalculatedStatus
              value={
                sanitation.smssStatus
              }
              pendingText="Complete the required sanitation information to determine the status."
              yesText="Yes — Safely Managed Sanitation Service"
              noText="No — Does not meet Safely Managed Sanitation Service conditions"
            />

            <Text style={styles.help}>
              SMSS requires Basic Sanitation Facility status and an applicable disposal or treatment method.
            </Text>
          </Section>
        </>
      )}

      {hasUnsanitary && (
        <View style={styles.warning}>
          <Ionicons
            name="warning-outline"
            size={22}
            color={COLORS.violation}
          />

          <View style={styles.flex}>
            <Text style={styles.warningTitle}>
              Unsanitary Toilet Recorded
            </Text>

            <Text style={styles.warningText}>
              Basic Sanitation Facility and SMSS are recorded as No for this classification.
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

function Section({
  number,
  title,
  required,
  children,
}: {
  number: string;
  title: string;
  required?: boolean;
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
        </View>
      </View>

      <View style={styles.sectionBody}>
        {children}
      </View>
    </View>
  );
}

function CalculatedStatus({
  value,
  pendingText,
  yesText,
  noText,
}: {
  value: 1 | 0 | undefined;
  pendingText: string;
  yesText: string;
  noText: string;
}) {
  if (value === undefined) {
    return (
      <View style={styles.pending}>
        <Ionicons
          name="time-outline"
          size={20}
          color={COLORS.warning}
        />

        <Text style={styles.pendingText}>
          {pendingText}
        </Text>
      </View>
    );
  }

  if (value === 1) {
    return (
      <View style={styles.result}>
        <Ionicons
          name="checkmark-circle"
          size={22}
          color={COLORS.compliant}
        />

        <Text style={styles.resultText}>
          {yesText}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.result}>
      <Ionicons
        name="close-circle"
        size={22}
        color={COLORS.violation}
      />

      <Text style={styles.resultText}>
        {noText}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: SPACING.lg,
  },

  flex: {
    flex: 1,
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
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },

  required: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.violation,
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

  subheading: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textSecondary,
  },

  divider: {
    height: 1,
    marginVertical: SPACING.sm,
    backgroundColor: COLORS.divider,
  },

  pending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.background,
  },

  pendingText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textSecondary,
  },

  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.background,
  },

  resultText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    color: COLORS.text,
  },

  warning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.violation,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
  },

  warningTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.violation,
  },

  warningText: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 17,
    color: COLORS.textSecondary,
  },
});
