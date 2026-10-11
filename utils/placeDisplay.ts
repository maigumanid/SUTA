export function formatPurok(value?: string | null) {
  const normalized = value?.trim() ?? '';

  if (!normalized) return 'Purok —';
  if (/^purok\b/i.test(normalized)) return normalized;

  return `Purok ${normalized}`;
}
