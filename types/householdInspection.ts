export type WaterSourceType =
  | 'level_1'
  | 'level_2'
  | 'level_3'
  | 'others';

export type BinaryResult = 1 | 0;

export type InspectionLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  capturedAt: string;
};

export type LocationCaptureStatus =
  | 'not_attempted'
  | 'captured'
  | 'permission_denied'
  | 'services_disabled'
  | 'unavailable';

export type InspectionResult =
  | 'compliant'
  | 'non_compliant'
  | 'for_reinspection';

export type FindingCategory =
  | 'safe_water_supply'
  | 'sanitation'
  | 'other';

export type EvidenceAttachment = {
  id: string;
  uri: string;
  source: 'camera' | 'library';
  createdAt: string;
  fileName?: string;
  mimeType?: string;
};

export type BackendEvidenceAttachment = Omit<
  EvidenceAttachment,
  'uri'
> & {
  storagePath: string;
};

export type InspectionFinding = {
  id: string;
  category: FindingCategory;
  details: string;
  evidence: EvidenceAttachment[];
};

export type BackendInspectionFinding = Omit<
  InspectionFinding,
  'evidence'
> & {
  evidence: BackendEvidenceAttachment[];
};

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
  bsiUid?: string;
  barangayId?: string;
  placeId: string;
  inspectionDate: string;
  inspectionLocation?: InspectionLocation;
  locationCaptureStatus: LocationCaptureStatus;
  locationCaptureAttemptedAt?: string;
  result?: InspectionResult;
  findings: InspectionFinding[];
  reinspectionId?: string;
  reinspectionOfInspectionId?: string;

  safeWaterSupply: SafeWaterSupply;

  sanitationFacility: SanitationFacility;

  remarks: string;
};
