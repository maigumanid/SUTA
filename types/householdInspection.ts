export type WaterSourceType =
  | 'level_1'
  | 'level_2'
  | 'level_3'
  | 'others';

export type BinaryResult = 1 | 0;

export type MicrobialTest = {
  recorded: boolean;
  dateValidationDone?: string;
  eColiResult?: BinaryResult;
};

export type ArsenicTest = {
  conducted: boolean;
  dateTestingDone?: string;
  result?: BinaryResult;
};

export type SafeWaterSupply = {
  waterSourceType?: WaterSourceType;
  otherWaterSource: string;

  locatedWithinPremises?: boolean;
  availableAtLeast12Hours?: boolean;

  microbialTest: MicrobialTest;
  arsenicTest: ArsenicTest;

  smdwsStatus?: BinaryResult;
};

export type SanitaryFacilityType =
  | 'septic_tank'
  | 'sewer_system'
  | 'vip_or_composting';

export type UnsanitaryToiletType =
  | 3
  | 2
  | 1
  | 0;

export type ExcretaDisposalMethod =
  | 'onsite_treatment'
  | 'offsite_dislodging'
  | 'sewer_or_offsite_treatment';

export type SanitationFacility = {
  sanitaryFacilityType?: SanitaryFacilityType;

  unsanitaryToiletType?: UnsanitaryToiletType;

  sharedWithOtherHouseholds?: BinaryResult;

  basicSanitationFacility?: BinaryResult;

  excretaDisposalMethod?: ExcretaDisposalMethod;

  smssStatus?: BinaryResult;
};

export type HouseholdInspection = {
  id?: string;
  placeId: string;
  inspectionDate: string;

  safeWaterSupply: SafeWaterSupply;

  sanitationFacility: SanitationFacility;

  remarks: string;
};
