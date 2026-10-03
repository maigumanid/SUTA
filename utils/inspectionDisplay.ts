import type { HouseholdInspection } from '@/types/householdInspection';

type InspectionIdentity = Pick<
  HouseholdInspection,
  | 'id'
  | 'inspectionDate'
  | 'reinspectionId'
  | 'reinspectionOfInspectionId'
>;

export function isLinkedReinspection(inspection: InspectionIdentity) {
  return Boolean(
    inspection.reinspectionId ||
      inspection.reinspectionOfInspectionId
  );
}

export function getInspectionTypeLabel(
  inspection: InspectionIdentity,
  placeHistory: readonly InspectionIdentity[]
) {
  if (isLinkedReinspection(inspection)) {
    return 'Reinspection';
  }

  const ordinaryInspections = placeHistory
    .filter((candidate) => !isLinkedReinspection(candidate))
    .sort((left, right) => {
      const leftTime = Date.parse(left.inspectionDate);
      const rightTime = Date.parse(right.inspectionDate);
      return (
        (Number.isNaN(leftTime) ? 0 : leftTime) -
        (Number.isNaN(rightTime) ? 0 : rightTime)
      );
    });

  if (!inspection.id) {
    return ordinaryInspections.length === 0
      ? 'Initial Inspection'
      : 'Inspection';
  }

  return ordinaryInspections[0]?.id === inspection.id
    ? 'Initial Inspection'
    : 'Inspection';
}

export function getInspectionResultLabel(
  result: HouseholdInspection['result']
) {
  switch (result) {
    case 'compliant':
      return 'Compliant';
    case 'non_compliant':
      return 'Non-Compliant';
    case 'for_reinspection':
      return 'For Reinspection';
    default:
      return 'Not recorded';
  }
}
