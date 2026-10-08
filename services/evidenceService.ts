import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import type { EvidenceAttachment } from '@/types/householdInspection';
import { persistEvidenceAttachment } from '@/storage/evidenceFileStorage';

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

function persistAsset(
  asset: ImagePicker.ImagePickerAsset,
  source: EvidenceSource
): Promise<EvidenceAttachment> {
  const id = `evidence_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const attachment: EvidenceAttachment = {
    id,
    uri: asset.uri,
    source,
    createdAt: new Date().toISOString(),
    ...(asset.fileName ? { fileName: asset.fileName } : {}),
    ...(asset.mimeType ? { mimeType: asset.mimeType } : {}),
  };

  return Promise.resolve(
    Platform.OS === 'web'
      ? attachment
      : persistEvidenceAttachment({
          ...attachment,
          fileName: attachment.fileName ?? `${id}${getExtension(asset)}`,
        })
  );
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
