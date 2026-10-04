import type {
  HouseholdInspection,
  SafeWaterSupply,
  SanitationFacility,
} from '@/types/householdInspection';
import type { RiskLevel } from '@/types/place';

export type RiskSeverity = 'minor' | 'major' | 'critical';
export type RiskAnswer = 'safe' | 'unsafe' | 'not_applicable';

export type RiskCalculation = {
  level: RiskLevel;
  percentage: number | null;
  earnedPoints: number;
  maximumPoints: number;
  criticalFailure: boolean;
  evaluatedItems: number;
};

export type RiskChecklistItem = {
  key: string;
  label: string;
  severity: RiskSeverity;
  safeAnswer: string;
  supportsNotApplicable: boolean;
  evaluate: (
    water: SafeWaterSupply,
    sanitation: SanitationFacility
  ) => RiskAnswer;
};

export const RISK_SEVERITY_WEIGHTS: Record<RiskSeverity, number> = {
  minor: 1,
  major: 2,
  critical: 3,
};

export const RISK_CHECKLIST_ITEMS: readonly RiskChecklistItem[] = [
  {
    key: 'water_source_type',
    label: 'Safe water source type',
    severity: 'major',
    safeAnswer: 'Level I or Level III water system',
    supportsNotApplicable: false,
    evaluate: (water) => {
      if (!water.waterSourceType) return 'not_applicable';
      return water.waterSourceType === 'level_1' ||
        water.waterSourceType === 'level_3'
        ? 'safe'
        : 'unsafe';
    },
  },
  {
    key: 'source_within_premises',
    label: 'Water source within premises',
    severity: 'minor',
    safeAnswer: 'Yes',
    supportsNotApplicable: false,
    evaluate: (water) =>
      water.locatedWithinPremises === undefined
        ? 'not_applicable'
        : water.locatedWithinPremises
          ? 'safe'
          : 'unsafe',
  },
  {
    key: 'water_available_12_hours',
    label: 'Water available at least 12 hours daily',
    severity: 'major',
    safeAnswer: 'Yes',
    supportsNotApplicable: false,
    evaluate: (water) =>
      water.availableAtLeast12Hours === undefined
        ? 'not_applicable'
        : water.availableAtLeast12Hours
          ? 'safe'
          : 'unsafe',
  },
  {
    key: 'e_coli_test',
    label: 'E. coli test result',
    severity: 'critical',
    safeAnswer: 'Absent / passed',
    supportsNotApplicable: true,
    evaluate: (water) => {
      if (!water.microbialTest.recorded) return 'not_applicable';
      if (water.microbialTest.eColiResult === undefined) {
        return 'not_applicable';
      }
      return water.microbialTest.eColiResult === 0 ? 'safe' : 'unsafe';
    },
  },
  {
    key: 'arsenic_test',
    label: 'Arsenic test result',
    severity: 'critical',
    safeAnswer: 'Passed',
    supportsNotApplicable: true,
    evaluate: (water) => {
      if (!water.arsenicTest.conducted) return 'not_applicable';
      if (water.arsenicTest.result === undefined) return 'not_applicable';
      return water.arsenicTest.result === 1 ? 'safe' : 'unsafe';
    },
  },
  {
    key: 'sanitary_toilet_facility',
    label: 'Sanitary toilet facility',
    severity: 'critical',
    safeAnswer: 'Uses an approved sanitary facility',
    supportsNotApplicable: false,
    evaluate: (_water, sanitation) => {
      if (sanitation.sanitaryFacilityType) return 'safe';
      if (sanitation.unsanitaryToiletType !== undefined) return 'unsafe';
      return 'not_applicable';
    },
  },
  {
    key: 'shared_toilet',
    label: 'Toilet shared with other households',
    severity: 'major',
    safeAnswer: 'No',
    supportsNotApplicable: false,
    evaluate: (_water, sanitation) =>
      !sanitation.sanitaryFacilityType ||
      sanitation.sharedWithOtherHouseholds === undefined
        ? 'not_applicable'
        : sanitation.sharedWithOtherHouseholds === 0
          ? 'safe'
          : 'unsafe',
  },
] as const;

export const EXCLUDED_RISK_CHECKLIST_ITEMS = [
  { key: 'excreta_disposal_method', reason: 'No unsafe choice is defined.' },
  { key: 'smdws_status', reason: 'Derived from scored safe-water answers.' },
  {
    key: 'basic_sanitation_facility',
    reason: 'Derived from the scored toilet-facility answer.',
  },
  { key: 'smss_status', reason: 'Derived from scored sanitation answers.' },
] as const;

export const UNCLASSIFIED_RISK_STORAGE_VALUE: RiskLevel = 'Unclassified';

export function calculateInspectionRisk(
  inspection: Pick<HouseholdInspection, 'safeWaterSupply' | 'sanitationFacility'>
): RiskCalculation {
  let earnedPoints = 0;
  let maximumPoints = 0;
  let evaluatedItems = 0;
  let criticalFailure = false;

  for (const item of RISK_CHECKLIST_ITEMS) {
    const answer = item.evaluate(
      inspection.safeWaterSupply,
      inspection.sanitationFacility
    );
    if (answer === 'not_applicable') continue;

    const weight = RISK_SEVERITY_WEIGHTS[item.severity];
    evaluatedItems += 1;
    maximumPoints += weight;
    if (answer === 'unsafe') {
      earnedPoints += weight;
      criticalFailure ||= item.severity === 'critical';
    }
  }

  if (maximumPoints === 0) {
    return {
      level: 'Unclassified',
      percentage: null,
      earnedPoints,
      maximumPoints,
      criticalFailure,
      evaluatedItems,
    };
  }

  const percentage = (earnedPoints / maximumPoints) * 100;
  const level: RiskLevel = criticalFailure || percentage >= 50
    ? 'High'
    : percentage >= 25
      ? 'Moderate'
      : 'Low';

  return {
    level,
    percentage,
    earnedPoints,
    maximumPoints,
    criticalFailure,
    evaluatedItems,
  };
}

export function getRiskClassification(level: RiskLevel) {
  if (level === 'Unclassified') {
    return { label: 'Not yet classified', isValidated: false } as const;
  }
  return { label: `${level} Risk`, isValidated: true } as const;
}
