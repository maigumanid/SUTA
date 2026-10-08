const EVIDENCE_BUCKET = 'inspection-evidence';

type EvidenceRecord = Record<string, unknown>;

function asRecord(value: unknown): EvidenceRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as EvidenceRecord)
    : null;
}

function decodePath(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Converts current or legacy Supabase evidence references into a bucket-relative
 * object path. Signed URLs are deliberately reduced to their stable object path
 * so callers always request a fresh authenticated URL.
 */
export function normalizeInspectionEvidenceStoragePath(value: unknown) {
  if (typeof value !== 'string') return undefined;
  let candidate = value.trim();
  if (!candidate) return undefined;

  if (/^https?:\/\//i.test(candidate)) {
    try {
      const url = new URL(candidate);
      const bucketMarker = `/${EVIDENCE_BUCKET}/`;
      const markerIndex = url.pathname.indexOf(bucketMarker);
      if (markerIndex < 0) return undefined;
      candidate = url.pathname.slice(markerIndex + bucketMarker.length);
    } catch {
      return undefined;
    }
  } else if (/^[a-z][a-z0-9+.-]*:/i.test(candidate)) {
    return undefined;
  }

  candidate = decodePath(candidate.split(/[?#]/, 1)[0])
    .replace(/^\/+/, '')
    .replace(new RegExp(`^${EVIDENCE_BUCKET}/`, 'i'), '');

  const segments = candidate.split('/');
  if (
    segments.length === 0 ||
    segments.some(
      (segment) =>
        !segment ||
        segment === '.' ||
        segment === '..' ||
        /[\\\u0000-\u001f\u007f]/.test(segment)
    )
  ) {
    return undefined;
  }
  return segments.join('/');
}

export function readInspectionEvidenceStoragePath(value: unknown) {
  if (typeof value === 'string') {
    return normalizeInspectionEvidenceStoragePath(value);
  }
  const record = asRecord(value);
  if (!record) return undefined;

  const aliases = [
    'storagePath',
    'storage_path',
    'objectPath',
    'object_path',
    'filePath',
    'file_path',
    'path',
    'signedUrl',
    'signed_url',
    'url',
    'uri',
  ];
  for (const key of aliases) {
    const path = normalizeInspectionEvidenceStoragePath(record[key]);
    if (path) return path;
  }
  return undefined;
}

export function evidenceIdFromStoragePath(storagePath: string) {
  return storagePath.split('/').at(-1) ?? storagePath;
}

