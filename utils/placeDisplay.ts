export function formatPurok(value?: string | null) {
  const normalized = value?.trim() ?? '';

  if (!normalized) return 'Purok —';
  if (/^purok\b/i.test(normalized)) return normalized;

  return `Purok ${normalized}`;
}

export function getPlaceRepresentativeLabel(placeType?: string | null) {
  return placeType === 'Household / Residence'
    ? 'Household Representative'
    : 'Representative';
}
