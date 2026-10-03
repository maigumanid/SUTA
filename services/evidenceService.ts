import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import type { EvidenceAttachment } from '@/types/householdInspection';

export type EvidenceSource = 'camera' | 'library';

export type EvidenceSelectionResult =
  | { status: 'attached'; attachment: EvidenceAttachment }
  | { status: 'canceled' }
  | { status: 'permission_denied'; canAskAgain: boolean }
  | { status: 'error'; message: string };

function getExtension(asset: ImagePicker.ImagePickerAsset) {
  const fileName = asset.fileName ?? asset.uri.split(/[?#]/)[0];
  const extensionMatch = fileName.match(/\.[a-zA-Z0-9]+$/);

  if (extensionMatch) {
    return extensionMatch[0].toLowerCase();
  }

  if (asset.mimeType === 'image/png') {
    return '.png';
  }

  if (asset.mimeType === 'image/heic') {
    return '.heic';
  }

  return '.jpg';
}

async function persistAsset(
  asset: ImagePicker.ImagePickerAsset,
  source: EvidenceSource
): Promise<EvidenceAttachment> {
  const id = `evidence_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  let uri = asset.uri;

  // expo-file-system's File/Directory API is native-only. Import it lazily so
  // web route discovery never evaluates unsupported filesystem paths.
  if (Platform.OS !== 'web') {
    const { Directory, File, Paths } = await import('expo-file-system');
    const evidenceDirectory = new Directory(
      Paths.document,
      'inspection-evidence'
    );

    if (!evidenceDirectory.exists) {
      evidenceDirectory.create();
    }

    const destination = new File(
      evidenceDirectory,
      `${id}${getExtension(asset)}`
    );
    new File(asset.uri).copy(destination);
    uri = destination.uri;
  }

  return {
    id,
    uri,
    source,
    createdAt: new Date().toISOString(),
    ...(asset.fileName ? { fileName: asset.fileName } : {}),
    ...(asset.mimeType ? { mimeType: asset.mimeType } : {}),
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
        : await ImagePicker.launchImageLibraryAsync(options);

    if (result.canceled || !result.assets[0]) {
      return { status: 'canceled' };
    }

    return {
      status: 'attached',
      attachment: await persistAsset(result.assets[0], source),
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

export async function deleteEvidencePhoto(uri: string) {
  if (Platform.OS === 'web') {
    return;
  }

  try {
    const { File } = await import('expo-file-system');
    const file = new File(uri);

    if (file.exists) {
      file.delete();
    }
  } catch (error) {
    console.error('Unable to delete evidence photo:', error);
  }
}
