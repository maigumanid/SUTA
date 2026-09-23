import { HouseholdInspection } from '@/types/householdInspection';

export type InspectionErrors = {
  [key: string]: string | undefined;
};

export const calculateSMDWS = (
  inspection: HouseholdInspection
): 1 | 0 | undefined => {
  const water = inspection.safeWaterSupply;

  if (
    !water.waterSourceType ||
    water.locatedWithinPremises === undefined ||
    water.availableAtLeast12Hours === undefined
  ) {
    return undefined;
  }

  if (
    !water.microbialTest.recorded ||
    water.microbialTest.eColiResult === undefined
  ) {
    return undefined;
  }

  const validSource =
    water.waterSourceType === 'level_1' ||
    water.waterSourceType === 'level_3';

  const freeFromFecalContamination =
    water.microbialTest.eColiResult === 0;

  return validSource &&
    water.locatedWithinPremises &&
    water.availableAtLeast12Hours &&
    freeFromFecalContamination
    ? 1
    : 0;
};

export const calculateBSF = (
  inspection: HouseholdInspection
): 1 | 0 | undefined => {
  const sanitation = inspection.sanitationFacility;

  if (sanitation.unsanitaryToiletType !== undefined) {
    return 0;
  }

  if (!sanitation.sanitaryFacilityType) {
    return undefined;
  }

  if (sanitation.sharedWithOtherHouseholds === undefined) {
    return undefined;
  }

  return sanitation.sharedWithOtherHouseholds === 0
    ? 1
    : 0;
};

export const calculateSMSS = (
  inspection: HouseholdInspection
): 1 | 0 | undefined => {
  const sanitation = inspection.sanitationFacility;

  const bsf = calculateBSF(inspection);

  if (bsf === undefined) {
    return undefined;
  }

  if (bsf === 0) {
    return 0;
  }

  if (!sanitation.excretaDisposalMethod) {
    return undefined;
  }

  return 1;
};

export const validateWaterSection = (
  inspection: HouseholdInspection
): InspectionErrors => {
  const errors: InspectionErrors = {};

  const water = inspection.safeWaterSupply;

  if (!water.waterSourceType) {
    errors.waterSource =
      'Select the household water source.';
  }

  if (
    water.waterSourceType === 'others' &&
    !water.otherWaterSource.trim()
  ) {
    errors.otherWaterSource =
      'Specify the household water source.';
  }

  if (water.locatedWithinPremises === undefined) {
    errors.location =
      'Select Yes or No for the location of the water source.';
  }

  if (water.availableAtLeast12Hours === undefined) {
    errors.availability =
      'Select Yes or No for water availability.';
  }

  if (water.microbialTest.recorded) {
    if (!water.microbialTest.dateValidationDone) {
      errors.microbialDate =
        'Select the date of microbial testing.';
    }

    if (water.microbialTest.eColiResult === undefined) {
      errors.microbialResult =
        'Select the microbial test result.';
    }
  }

  if (water.arsenicTest.conducted) {
    if (!water.arsenicTest.dateTestingDone) {
      errors.arsenicDate =
        'Select the date of arsenic testing.';
    }

    if (water.arsenicTest.result === undefined) {
      errors.arsenicResult =
        'Select the arsenic test result.';
    }
  }

  return errors;
};

export const validateSanitationSection = (
  inspection: HouseholdInspection
): InspectionErrors => {
  const errors: InspectionErrors = {};

  const sanitation = inspection.sanitationFacility;

  const sanitarySelected =
    sanitation.sanitaryFacilityType !== undefined;

  const unsanitarySelected =
    sanitation.unsanitaryToiletType !== undefined;

  if (!sanitarySelected && !unsanitarySelected) {
    errors.toiletType =
      'Select the type of sanitary facility or unsanitary toilet.';
  }

  if (sanitarySelected) {
    if (
      sanitation.sharedWithOtherHouseholds === undefined
    ) {
      errors.shared =
        'Indicate whether the toilet is shared with another household.';
    }

    if (!sanitation.excretaDisposalMethod) {
      errors.disposal =
        'Select the applicable disposal or treatment method.';
    }
  }

  return errors;
};

export const hasErrors = (
  errors: InspectionErrors
) => {
  return Object.values(errors).some(Boolean);
};
