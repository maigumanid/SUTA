import { PLACE_TYPES, type Place, type PlaceType } from '@/types/place';
import type { ImportPlaceInput } from '@/services/placeService';

export const IMPORT_FIELDS = [
  'name',
  'address',
  'representativeName',
  'purok',
  'contactNumber',
  'placeType',
  'notes',
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number];
export type ColumnMapping = Record<ImportField, string>;
export type CsvRow = { rowNumber: number; values: Record<string, string> };
export type ParsedCsv = { headers: string[]; rows: CsvRow[] };
export type ReviewedImportRow = {
  rowNumber: number;
  data: ImportPlaceInput;
  issues: string[];
  duplicateOf?: string;
  complete: boolean;
};

export const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  name: 'Place / household name',
  address: 'Address',
  representativeName: 'Representative name',
  purok: 'Purok',
  contactNumber: 'Contact number',
  placeType: 'Place type',
  notes: 'Notes / remarks',
};

const ALIASES: Record<ImportField, string[]> = {
  name: ['name', 'household name', 'place name', 'household/place name', 'household'],
  address: ['address', 'complete address', 'location'],
  representativeName: ['representative', 'representative name', 'household head', 'head of household', 'owner'],
  purok: ['purok', 'zone', 'sitio'],
  contactNumber: ['contact', 'contact number', 'phone', 'phone number', 'mobile'],
  placeType: ['place type', 'type', 'establishment type'],
  notes: ['notes', 'remarks', 'note', 'comment'],
};

function normalizedHeader(value: string) {
  return value.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}

export function suggestedColumnMapping(headers: string[]): ColumnMapping {
  return Object.fromEntries(
    IMPORT_FIELDS.map((field) => {
      const header = headers.find((candidate) =>
        ALIASES[field].includes(normalizedHeader(candidate))
      );
      return [field, header ?? ''];
    })
  ) as ColumnMapping;
}

export function parseCsv(text: string): ParsedCsv {
  const source = text.replace(/^\uFEFF/, '');
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      record.push(field.trim());
      field = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && source[index + 1] === '\n') index += 1;
      record.push(field.trim());
      field = '';
      if (record.some(Boolean)) records.push(record);
      record = [];
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error('The CSV contains an unclosed quoted value.');
  record.push(field.trim());
  if (record.some(Boolean)) records.push(record);
  if (records.length < 2) throw new Error('The CSV needs a header row and at least one data row.');

  const headers = records[0].map((value, index) => value || `Column ${index + 1}`);
  if (new Set(headers.map(normalizedHeader)).size !== headers.length) {
    throw new Error('CSV column names must be unique.');
  }

  return {
    headers,
    rows: records.slice(1).map((values, index) => ({
      rowNumber: index + 2,
      values: Object.fromEntries(headers.map((header, column) => [header, values[column]?.trim() ?? ''])),
    })),
  };
}

function normalizeIdentity(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function duplicateKey(name: string, address: string) {
  return `${normalizeIdentity(name)}|${normalizeIdentity(address)}`;
}

function readPlaceType(value: string): PlaceType | null {
  if (!value.trim()) return 'Household / Residence';
  const normalized = normalizeIdentity(value);
  if (['household', 'residence', 'household residence', 'home'].includes(normalized)) {
    return 'Household / Residence';
  }
  return PLACE_TYPES.find((type) => normalizeIdentity(type) === normalized) ?? null;
}

export function reviewImportRows(
  parsed: ParsedCsv,
  mapping: ColumnMapping,
  existingPlaces: Place[]
): ReviewedImportRow[] {
  const existing = new Map(
    existingPlaces.map((place) => [duplicateKey(place.name, place.address), place.name])
  );
  const seen = new Map<string, number>();

  return parsed.rows.map((row) => {
    const get = (field: ImportField) => mapping[field] ? row.values[mapping[field]] ?? '' : '';
    const placeType = readPlaceType(get('placeType'));
    const data: ImportPlaceInput = {
      name: get('name').trim(),
      address: get('address').trim(),
      representativeName: get('representativeName').trim(),
      purok: get('purok').trim(),
      contactNumber: get('contactNumber').trim(),
      placeType: placeType ?? 'Household / Residence',
      notes: get('notes').trim(),
    };
    const issues: string[] = [];
    if (!data.name) issues.push('Missing place / household name');
    if (!data.address) issues.push('Missing address');
    if (get('placeType').trim() && !placeType) issues.push('Unsupported place type');

    const key = data.name && data.address ? duplicateKey(data.name, data.address) : '';
    const existingName = key ? existing.get(key) : undefined;
    const earlierRow = key ? seen.get(key) : undefined;
    if (key && earlierRow === undefined) seen.set(key, row.rowNumber);

    return {
      rowNumber: row.rowNumber,
      data,
      issues,
      complete: Boolean(data.representativeName && data.purok),
      ...(existingName
        ? { duplicateOf: `Existing record: ${existingName}` }
        : earlierRow !== undefined
          ? { duplicateOf: `CSV row ${earlierRow}` }
          : {}),
    };
  });
}

