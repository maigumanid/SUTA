import { HouseholdInspection } from '@/types/householdInspection';

export const createInitialHouseholdInspection = (
  placeId: string
): HouseholdInspection => {
  return {
    placeId,
    inspectionDate: new Date().toISOString(),

    safeWaterSupply: {
      waterSourceType: undefined,
      otherWaterSource: '',

      locatedWithinPremises: undefined,
      availableAtLeast12Hours: undefined,

      microbialTest: {
        recorded: false,
        dateValidationDone: undefined,
        eColiResult: undefined,
      },

      arsenicTest: {
        conducted: false,
        dateTestingDone: undefined,
        result: undefined,
      },

      smdwsStatus: undefined,
    },

    sanitationFacility: {
      sanitaryFacilityType: undefined,
      unsanitaryToiletType: undefined,
      sharedWithOtherHouseholds: undefined,
      basicSanitationFacility: undefined,
      excretaDisposalMethod: undefined,
      smssStatus: undefined,
    },

    remarks: '',
  };
};
