import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import { requireSupabase } from '@/services/supabase';
import { loadSupabaseBsiProfile } from '@/services/supabaseProfileService';
import {
  SupabaseServiceError,
  throwSupabaseServiceError,
} from '@/services/supabaseServiceError';
import type { InspectionScope } from '@/storage/inspectionStorage';
import type {
  BackendEvidenceAttachment,
  BackendInspectionFinding,
  EvidenceAttachment,
  InspectionFinding,
} from '@/types/householdInspection';

const EVIDENCE_BUCKET = 'inspection-evidence';
const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;

function validatePathSegment(value: string, label: string) {
  const trimmed = value.trim();
  if (
    !trimmed ||
    trimmed === '.' ||
    trimmed === '..' ||
    /[\\/\u0000-\u001f\u007f]/.test(trimmed)
  ) {
    throw new SupabaseServiceError(
      'Build evidence path',
      `${label} is not a valid Storage path segment.`,
      { code: 'INVALID_STORAGE_PATH' }
    );
  }
  return trimmed;
}

function getImageMimeType(evidence: EvidenceAttachment) {
  if (evidence.mimeType) {
    if (!evidence.mimeType.startsWith('image/')) {
      throw new SupabaseServiceError(
        'Upload inspection evidence',
        'Only image evidence can be uploaded.',
        { code: 'UNSUPPORTED_EVIDENCE_TYPE' }
      );
    }
    return evidence.mimeType;
  }

  const extension = (evidence.fileName ?? evidence.uri)
    .split(/[?#]/)[0]
    .match(/\.([a-zA-Z0-9]+)$/)?.[1]
    .toLowerCase();

  switch (extension) {
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'heic':
      return 'image/heic';
    case 'heif':
      return 'image/heif';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    default:
      throw new SupabaseServiceError(
        'Upload inspection evidence',
        'The evidence image MIME type could not be determined.',
        { code: 'UNKNOWN_EVIDENCE_TYPE' }
      );
  }
}

export function getSupabaseEvidenceStoragePath(
  barangayId: string,
  userId: string,
  inspectionId: string,
  evidenceId: string
) {
  return [
    'barangays',
    validatePathSegment(barangayId, 'Barangay ID'),
    'inspectors',
    validatePathSegment(userId, 'Inspector ID'),
    'inspections',
    validatePathSegment(inspectionId, 'Inspection ID'),
    'evidence',
    validatePathSegment(evidenceId, 'Evidence ID'),
  ].join('/');
}

async function readEvidenceArrayBuffer(uri: string) {
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    if (!response.ok) {
      throw new Error(`Unable to read local evidence (${response.status}).`);
    }
    return response.arrayBuffer();
  }

  const file = new File(uri);
  if (!file.exists) {
    throw new Error('The local evidence file is no longer available.');
  }
  return file.arrayBuffer();
}

export async function uploadSupabaseEvidenceAttachment(
  inspectionId: string,
  evidence: EvidenceAttachment,
  scope: InspectionScope
): Promise<BackendEvidenceAttachment> {
  const client = requireSupabase();
  const profile = await loadSupabaseBsiProfile();

  if (
    scope.bsiUid !== profile.uid ||
    scope.barangayId !== profile.assignedBarangayId
  ) {
    throw new SupabaseServiceError(
      'Upload inspection evidence',
      'The evidence scope does not match the authenticated BSI profile.',
      { code: 'EVIDENCE_SCOPE_MISMATCH' }
    );
  }

  const storagePath = getSupabaseEvidenceStoragePath(
    profile.assignedBarangayId,
    profile.uid,
    inspectionId,
    evidence.id
  );
  const contentType = getImageMimeType(evidence);
  let fileBody: ArrayBuffer;

  try {
    fileBody = await readEvidenceArrayBuffer(evidence.uri);
  } catch (error) {
    throwSupabaseServiceError('Read local inspection evidence', error);
  }

  if (fileBody.byteLength > MAX_EVIDENCE_BYTES) {
    throw new SupabaseServiceError(
      'Upload inspection evidence',
      'Evidence images must be 10 MB or smaller.',
      { code: 'EVIDENCE_TOO_LARGE' }
    );
  }

  const { error } = await client.storage
    .from(EVIDENCE_BUCKET)
    .upload(storagePath, fileBody, {
      contentType,
      upsert: true,
    });

  if (error) {
    throwSupabaseServiceError('Upload inspection evidence', error);
  }

  return {
    id: evidence.id,
    source: evidence.source,
    createdAt: evidence.createdAt,
    storagePath,
    ...(evidence.fileName ? { fileName: evidence.fileName } : {}),
    mimeType: contentType,
  };
}

export async function uploadSupabaseInspectionEvidence(
  inspectionId: string,
  findings: InspectionFinding[],
  scope: InspectionScope
): Promise<BackendInspectionFinding[]> {
  return Promise.all(
    findings.map(async (finding) => ({
      id: finding.id,
      category: finding.category,
      details: finding.details,
      evidence: await Promise.all(
        finding.evidence.map((evidence) =>
          uploadSupabaseEvidenceAttachment(
            inspectionId,
            evidence,
            scope
          )
        )
      ),
    }))
  );
}
