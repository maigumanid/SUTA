import type { RiskLevel } from '@/types/place';

/**
 * The current database requires a Low/Medium/High value, but the project does
 * not yet define an approved rule that derives one from an inspection.
 * Keep the compatibility value centralized and never present it as an
 * official classification in the UI.
 */
export const UNCLASSIFIED_RISK_STORAGE_VALUE: RiskLevel = 'Low';

export const UNCLASSIFIED_RISK = {
  label: 'Not yet classified',
  isValidated: false,
} as const;

export function getRiskClassification() {
  return UNCLASSIFIED_RISK;
}
