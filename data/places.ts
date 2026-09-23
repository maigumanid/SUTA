import { Place } from '@/types/place';

export const SAMPLE_PLACES: Place[] = [
  {
    id: '1',
    name: 'Dela Cruz Household',
    representativeName: 'Juan Dela Cruz',
    address: 'Purok 1',
    purok: 'Purok 1',
    placeType: 'Household / Residence',
    status: 'Not Inspected',
    riskLevel: 'Low',
  },
  {
    id: '2',
    name: 'Santos Household',
    representativeName: 'Maria Santos',
    address: 'Purok 2',
    purok: 'Purok 2',
    placeType: 'Household / Residence',
    status: 'For Reinspection',
    riskLevel: 'High',
    lastInspectionDate: '2026-09-10',
  },
  {
    id: '3',
    name: 'Sample Food House',
    representativeName: 'Pedro Reyes',
    address: 'Purok 3',
    purok: 'Purok 3',
    placeType: 'Food Establishment',
    status: 'Compliant',
    riskLevel: 'Low',
    lastInspectionDate: '2026-09-15',
  },
  {
    id: '4',
    name: 'Barangay Elementary School',
    representativeName: 'Ana Cruz',
    address: 'Purok 4',
    purok: 'Purok 4',
    placeType: 'School',
    status: 'Not Inspected',
    riskLevel: 'Medium',
  },
  {
    id: '5',
    name: 'Barangay Covered Court',
    representativeName: 'Barangay Representative',
    address: 'Purok 5',
    purok: 'Purok 5',
    placeType: 'Public Facility',
    status: 'For Reinspection',
    riskLevel: 'Medium',
    lastInspectionDate: '2026-09-18',
  },
  {
    id: '6',
    name: 'San Roque Chapel',
    representativeName: 'Community Representative',
    address: 'Purok 6',
    purok: 'Purok 6',
    placeType: 'Church',
    status: 'Not Inspected',
    riskLevel: 'Low',
  },
];

export function getPlaceById(
  placeId: string
): Place | undefined {
  return SAMPLE_PLACES.find(
    (place) => place.id === placeId
  );
}
