import {
  HouseholdInspection,
  InspectionLocation,
  LocationCaptureStatus,
} from '@/types/householdInspection';

export const createInitialHouseholdInspection = (
  placeId: string,
  options?: {
    inspectionLocation?: InspectionLocation;
    locationCaptureStatus?: LocationCaptureStatus;
    locationCaptureAttemptedAt?: string;
    reinspectionId?: string;
    reinspectionOfInspectionId?: string;
  }
): HouseholdInspection => {
  return {
    placeId,
    inspectionDate: new Date().toISOString(),
    inspectionLocation: options?.inspectionLocation,
    locationCaptureStatus:
      options?.locationCaptureStatus ?? 'not_attempted',
    locationCaptureAttemptedAt:
      options?.locationCaptureAttemptedAt,
    result: undefined,
    findings: [],
    reinspectionId: options?.reinspectionId,
    reinspectionOfInspectionId:
      options?.reinspectionOfInspectionId,

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
