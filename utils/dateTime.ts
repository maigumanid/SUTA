const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
};

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
};

function parseDate(value?: string | Date) {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatLocalDateTime(
  value?: string | Date,
  fallback = 'Date not available'
) {
  const date = parseDate(value);
  return date
    ? date.toLocaleString('en-PH', DATE_TIME_OPTIONS)
    : fallback;
}

export function formatLocalDate(
  value?: string | Date,
  fallback = 'Date not available'
) {
  const date = parseDate(value);
  return date
    ? date.toLocaleDateString('en-PH', DATE_OPTIONS)
    : fallback;
}
