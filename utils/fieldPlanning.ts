import type {
  CoverageMetrics,
  PlaceMapLocation,
  PlaceMapPoint,
  PlanningSnapshot,
  MapStatusFilter,
  FieldCoordinate,
  QueueCategory,
  WorkQueueItem,
} from '@/types/fieldPlanning';

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function daysFromToday(value: string) {
  const target = Date.parse(`${value.slice(0, 10)}T00:00:00`);
  const today = Date.parse(`${localDateKey()}T00:00:00`);
  return Math.round((target - today) / 86_400_000);
}

export function buildCoverage(snapshot: PlanningSnapshot): CoverageMetrics {
  const inspected = snapshot.places.filter((place) => place.status !== 'Not Inspected').length;
  const urgentIds = new Set(
    snapshot.places
      .filter((place) => place.riskLevel === 'High' || place.status === 'Non-Compliant')
      .map((place) => place.id)
  );

  return {
    total: snapshot.places.length,
    inspected,
    uninspected: snapshot.places.length - inspected,
    pendingReinspections: snapshot.reinspections.filter((item) => item.status === 'pending').length,
    urgent: urgentIds.size,
    completionPercent: snapshot.places.length
      ? Math.round((inspected / snapshot.places.length) * 100)
      : 0,
  };
}

export function buildWorkQueue(snapshot: PlanningSnapshot): WorkQueueItem[] {
  const pendingByPlace = new Map(
    snapshot.reinspections
      .filter((item) => item.status === 'pending')
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
      .map((item) => [item.placeId, item])
  );

  return snapshot.places
    .flatMap<WorkQueueItem>((place) => {
      const followUp = pendingByPlace.get(place.id);
      if (followUp) {
        const days = daysFromToday(followUp.scheduledDate);
        if (days < 0) {
          return [{ place, category: 'follow_up', priority: 1000 - days, reason: `Reinspection overdue by ${Math.abs(days)} day${days === -1 ? '' : 's'}`, action: 'Complete the overdue reinspection', status: place.status, reinspectionId: followUp.id, scheduledDate: followUp.scheduledDate }];
        }
        if (days <= 7) {
          const reason = days === 0 ? 'Reinspection is due today' : `Reinspection due in ${days} day${days === 1 ? '' : 's'}`;
          return [{ place, category: 'follow_up', priority: 900 - days, reason, action: 'Prepare and complete the scheduled follow-up', status: place.status, reinspectionId: followUp.id, scheduledDate: followUp.scheduledDate }];
        }
      }

      if (place.riskLevel === 'High') {
        return [{ place, category: 'risk', priority: 800, reason: 'Latest assessment is High Risk', action: 'Review the record and prioritize a field visit', status: place.status }];
      }
      if (place.status === 'Non-Compliant') {
        return [{ place, category: 'risk', priority: 700, reason: 'Latest result is Non-Compliant', action: 'Review findings and plan the next inspection', status: place.status }];
      }
      if (place.profileStatus === 'starter') {
        return [{ place, category: 'incomplete', priority: 600, reason: 'Imported census record needs profile details', action: 'Complete the place profile before fieldwork', status: place.status }];
      }
      if (place.status === 'Not Inspected') {
        return [{ place, category: 'uninspected', priority: 500, reason: 'No completed inspection on record', action: 'Start the first sanitary inspection', status: place.status }];
      }
      return [];
    })
    .sort((a, b) => b.priority - a.priority || a.place.name.localeCompare(b.place.name));
}

export function filterWorkQueue(items: WorkQueueItem[], category: QueueCategory) {
  return category === 'all' ? items : items.filter((item) => item.category === category);
}

export function placeMatchesMapFilter(
  place: PlanningSnapshot['places'][number],
  filter: MapStatusFilter
) {
  switch (filter) {
    case 'not_inspected':
      return place.status === 'Not Inspected';
    case 'compliant':
      return place.status === 'Compliant';
    case 'non_compliant':
      return place.status === 'Non-Compliant';
    case 'high_risk':
      return place.riskLevel === 'High';
    case 'reinspection':
      return place.status === 'For Reinspection';
    case 'needs_completion':
      return place.profileStatus === 'starter';
    default:
      return true;
  }
}

export function distanceBetweenCoordinatesMeters(
  from: FieldCoordinate,
  to: FieldCoordinate
) {
  const earthRadiusMeters = 6_371_000;
  const radians = (degrees: number) => degrees * (Math.PI / 180);
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const fromLatitude = radians(from.latitude);
  const toLatitude = radians(to.latitude);
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  const boundedValue = Math.min(1, Math.max(0, value));
  return earthRadiusMeters * 2 * Math.atan2(
    Math.sqrt(boundedValue),
    Math.sqrt(1 - boundedValue)
  );
}

export function formatFieldDistance(distanceMeters: number) {
  if (distanceMeters < 10) {
    return '<10 m';
  }
  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters / 10) * 10} m`;
  }
  return `${(distanceMeters / 1000).toFixed(distanceMeters < 10_000 ? 1 : 0)} km`;
}

export function buildMapPoints(snapshot: PlanningSnapshot): PlaceMapPoint[] {
  const places = new Map(snapshot.places.map((place) => [place.id, place]));
  const latest = new Map<string, PlanningSnapshot['inspections'][number]>();

  const hasValidCoordinates = (inspection: PlanningSnapshot['inspections'][number]) =>
    Number.isFinite(inspection.latitude) &&
    Number.isFinite(inspection.longitude) &&
    inspection.latitude! >= -90 &&
    inspection.latitude! <= 90 &&
    inspection.longitude! >= -180 &&
    inspection.longitude! <= 180;

  for (const inspection of [...snapshot.inspections].sort((a, b) => b.inspectionDate.localeCompare(a.inspectionDate))) {
    if (!latest.has(inspection.placeId) && hasValidCoordinates(inspection)) {
      latest.set(inspection.placeId, inspection);
    }
  }

  return [...latest.values()].flatMap((inspection) => {
    const place = places.get(inspection.placeId);
    if (!place || !hasValidCoordinates(inspection)) return [];
    return [{ place, latitude: inspection.latitude!, longitude: inspection.longitude!, capturedAt: inspection.inspectionDate }];
  });
}

export function buildMapLocations(points: PlaceMapPoint[]): PlaceMapLocation[] {
  const locations = new Map<string, PlaceMapLocation>();

  for (const point of points) {
    if (
      !Number.isFinite(point.latitude) ||
      !Number.isFinite(point.longitude) ||
      point.latitude < -90 ||
      point.latitude > 90 ||
      point.longitude < -180 ||
      point.longitude > 180
    ) {
      continue;
    }

    const key = `${point.latitude},${point.longitude}`;
    const location = locations.get(key);
    if (location) {
      location.points.push(point);
    } else {
      locations.set(key, {
        key,
        latitude: point.latitude,
        longitude: point.longitude,
        points: [point],
      });
    }
  }

  return [...locations.values()];
}

