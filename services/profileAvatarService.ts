import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

import { requireSupabase } from '@/services/supabase';
import {
  SupabaseServiceError,
  throwSupabaseServiceError,
} from '@/services/supabaseServiceError';

const AVATAR_BUCKET = 'profile-avatars';
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

export type SelectedProfilePhoto = { uri: string; mimeType: string };

export function profileAvatarPath(userId: string) {
  return `users/${userId}/avatar`;
}

export async function selectProfilePhoto(): Promise<SelectedProfilePhoto | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new SupabaseServiceError(
      'Select profile photo',
      'Photo library permission is required to choose a profile image.',
      { code: 'PHOTO_PERMISSION_REQUIRED' }
    );
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });
  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const mimeType = asset.mimeType ?? 'image/jpeg';
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new SupabaseServiceError(
      'Select profile photo',
      'Choose a JPEG, PNG, WebP, HEIC, or HEIF image.',
      { code: 'UNSUPPORTED_AVATAR_TYPE' }
    );
  }

  const file = new File(asset.uri);
  if (!file.exists || file.size <= 0) {
    throw new SupabaseServiceError(
      'Select profile photo',
      'The selected image is unavailable on this device.',
      { code: 'AVATAR_FILE_UNAVAILABLE' }
    );
  }
  if (file.size > MAX_AVATAR_BYTES) {
    throw new SupabaseServiceError(
      'Select profile photo',
      'Profile images must be 5 MB or smaller.',
      { code: 'AVATAR_TOO_LARGE' }
    );
  }
  return { uri: file.uri, mimeType };
}

export async function uploadOwnProfileAvatar(
  userId: string,
  photo: SelectedProfilePhoto
) {
  const file = new File(photo.uri);
  if (!file.exists || file.size <= 0) {
    throw new SupabaseServiceError(
      'Upload profile photo',
      'The selected image is unavailable on this device.',
      { code: 'AVATAR_FILE_UNAVAILABLE' }
    );
  }
  if (file.size > MAX_AVATAR_BYTES) {
    throw new SupabaseServiceError(
      'Upload profile photo',
      'Profile images must be 5 MB or smaller.',
      { code: 'AVATAR_TOO_LARGE' }
    );
  }

  const path = profileAvatarPath(userId);
  const { error } = await requireSupabase().storage
    .from(AVATAR_BUCKET)
    .upload(path, await file.arrayBuffer(), {
      contentType: photo.mimeType,
      upsert: true,
    });
  if (error) throwSupabaseServiceError('Upload profile photo', error);
  return path;
}

export async function removeOwnProfileAvatar(path: string) {
  const { error } = await requireSupabase().storage
    .from(AVATAR_BUCKET)
    .remove([path]);
  if (error) throwSupabaseServiceError('Remove profile photo', error);
}

export async function createProfileAvatarSignedUrl(path: string) {
  const { data, error } = await requireSupabase().storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(path, 300);
  if (error) throwSupabaseServiceError('Load profile photo', error);
  return data.signedUrl;
}

