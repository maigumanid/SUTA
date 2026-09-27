import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

import { EvidenceAttachment } from '@/types/householdInspection';

export type EvidenceSource = 'camera' | 'library';

export type EvidenceSelectionResult =
  | { status: 'attached'; attachment: EvidenceAttachment }
  | { status: 'canceled' }
  | { status: 'permission_denied'; canAskAgain: boolean }
  | { status: 'error'; message: string };

const evidenceDirectory = new Directory(
  Paths.document,
  'inspection-evidence'
);

function ensureEvidenceDirectory() {
  if (!evidenceDirectory.exists) {
    evidenceDirectory.create();
  }
}

function getExtension(
  asset: ImagePicker.ImagePickerAsset
) {
  const sourceFile = new File(asset.uri);

  if (sourceFile.extension) {
    return sourceFile.extension;
  }

  if (asset.mimeType === 'image/png') {
    return '.png';
  }

  if (asset.mimeType === 'image/heic') {
    return '.heic';
  }

  return '.jpg';
}

function persistAsset(
  asset: ImagePicker.ImagePickerAsset,
  source: EvidenceSource
): EvidenceAttachment {
  ensureEvidenceDirectory();

  const id = `evidence_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const destination = new File(
    evidenceDirectory,
    `${id}${getExtension(asset)}`
  );

  new File(asset.uri).copy(destination);

  return {
    id,
    uri: destination.uri,
    source,
    createdAt: new Date().toISOString(),
    ...(asset.fileName
      ? { fileName: asset.fileName }
      : {}),
    ...(asset.mimeType
      ? { mimeType: asset.mimeType }
      : {}),
  };
}

export async function selectEvidencePhoto(
  source: EvidenceSource
): Promise<EvidenceSelectionResult> {
  try {
    if (source === 'camera') {
      const permission =
        await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        return {
          status: 'permission_denied',
          canAskAgain: permission.canAskAgain,
        };
      }
    }

    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.7,
    };

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            ...options,
            cameraType: ImagePicker.CameraType.back,
          })
        : await ImagePicker.launchImageLibraryAsync(
            options
          );

    if (result.canceled || !result.assets[0]) {
      return { status: 'canceled' };
    }

    return {
      status: 'attached',
      attachment: persistAsset(
        result.assets[0],
        source
      ),
    };
  } catch (error) {
    console.error('Evidence selection failed:', error);

    return {
      status: 'error',
      message:
        error instanceof Error
          ? error.message
          : 'Unable to save the selected photo.',
    };
  }
}

export function deleteEvidencePhoto(uri: string) {
  try {
    const file = new File(uri);

    if (file.exists) {
      file.delete();
    }
  } catch (error) {
    console.error('Unable to delete evidence photo:', error);
  }
}
