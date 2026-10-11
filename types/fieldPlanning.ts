import type { InspectionStatus, Place, RiskLevel } from '@/types/place';

export type PlanningReinspection = {
  id: string;
  placeId: string;
  scheduledDate: string;
  status: string;
};

export type PlanningInspection = {
  id: string;
  placeId: string;
  inspectionDate: string;
  result: string;
  riskLevel: RiskLevel;
  latitude?: number;
  longitude?: number;
};

export type PlanningSnapshot = {
  places: Place[];
  reinspections: PlanningReinspection[];
  inspections: PlanningInspection[];
};

export type CoverageMetrics = {
  total: number;
  inspected: number;
  uninspected: number;
  pendingReinspections: number;
  urgent: number;
  completionPercent: number;
};

export type QueueCategory = 'all' | 'follow_up' | 'risk' | 'uninspected' | 'incomplete';

export type MapStatusFilter =
  | 'all'
  | 'not_inspected'
  | 'compliant'
  | 'non_compliant'
  | 'high_risk'
  | 'reinspection'
  | 'needs_completion';

export type FieldCoordinate = {
  latitude: number;
  longitude: number;
};

export type WorkQueueItem = {
  place: Place;
  category: Exclude<QueueCategory, 'all'>;
  priority: number;
  reason: string;
  action: string;
  status: InspectionStatus;
  reinspectionId?: string;
  scheduledDate?: string;
};

export type PlaceMapPoint = {
  place: Place;
  latitude: number;
  longitude: number;
  capturedAt: string;
};

export type PlaceMapLocation = {
  key: string;
  latitude: number;
  longitude: number;
  points: PlaceMapPoint[];
};

