import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import type {
  EvidenceAttachment,
  HouseholdInspection,
} from '@/types/householdInspection';

const EVIDENCE_DIRECTORY_NAME = 'inspection-evidence';

function evidenceDirectory() {
  return new Directory(Paths.document, EVIDENCE_DIRECTORY_NAME);
}

function extensionFor(attachment: EvidenceAttachment) {
  const source = attachment.fileName ?? attachment.uri.split(/[?#]/)[0];
  const extension = source.match(/\.[a-zA-Z0-9]+$/)?.[0].toLowerCase();
  if (extension) return extension;
  if (attachment.mimeType === 'image/png') return '.png';
  if (attachment.mimeType === 'image/heic') return '.heic';
  if (attachment.mimeType === 'image/heif') return '.heif';
  if (attachment.mimeType === 'image/webp') return '.webp';
  return '.jpg';
}

function assertReadable(file: File) {
  if (!file.exists || file.size <= 0) {
    throw new Error('Evidence file is unavailable on this device.');
  }
}

export function isDurableEvidenceUri(uri: string) {
  if (Platform.OS === 'web') return true;
  return uri.startsWith(`${evidenceDirectory().uri}/`);
}

export function isLocalEvidenceReadable(uri: string) {
  if (Platform.OS === 'web') return true;
  try {
    const file = new File(uri);
    return file.exists && file.size > 0;
  } catch {
    return false;
  }
}

export function getLocalEvidenceSize(uri: string) {
  if (Platform.OS === 'web' || !isDurableEvidenceUri(uri)) return 0;
  try {
    const file = new File(uri);
    return file.exists ? Math.max(0, file.size) : 0;
  } catch {
    return 0;
  }
}

export function deleteUploadedLocalEvidence(uri: string) {
  if (Platform.OS === 'web' || !isDurableEvidenceUri(uri)) return 0;
  try {
    const file = new File(uri);
    if (!file.exists) return 0;
    const size = Math.max(0, file.size);
    file.delete();
    return size;
  } catch (error) {
    console.warn('Unable to remove uploaded local evidence:', error);
    return 0;
  }
}

export function persistEvidenceAttachment(
  attachment: EvidenceAttachment
): EvidenceAttachment {
  if (Platform.OS === 'web') return attachment;

  const source = new File(attachment.uri);
  assertReadable(source);

  const directory = evidenceDirectory();
  directory.create({ idempotent: true, intermediates: true });
  const destination = new File(
    directory,
    `${attachment.id}${extensionFor(attachment)}`
  );

  if (source.uri !== destination.uri) {
    if (!destination.exists || destination.size <= 0) {
      if (destination.exists) destination.delete();
      source.copy(destination);
    }
  }

  assertReadable(destination);
  return { ...attachment, uri: destination.uri };
}

export function ensureInspectionEvidenceDurable<T extends HouseholdInspection>(
  inspection: T
): T {
  return {
    ...inspection,
    findings: inspection.findings.map((finding) => ({
      ...finding,
      evidence: finding.evidence.map(persistEvidenceAttachment),
    })),
  };
}
