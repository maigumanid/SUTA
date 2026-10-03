import AsyncStorage from '@react-native-async-storage/async-storage';

import type { BsiProfile } from '@/types/inspector';

function profileKey(uid: string) {
  return `suta_bsi_profile:${uid}`;
}

function isCachedProfile(value: unknown, uid: string): value is BsiProfile {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const profile = value as Partial<BsiProfile>;
  return (
    profile.uid === uid &&
    typeof profile.name === 'string' &&
    profile.name.length > 0 &&
    typeof profile.email === 'string' &&
    profile.email.length > 0 &&
    typeof profile.contactNumber === 'string' &&
    profile.contactNumber.length > 0 &&
    typeof profile.assignedBarangayId === 'string' &&
    profile.assignedBarangayId.length > 0 &&
    typeof profile.assignedBarangay === 'string' &&
    profile.assignedBarangay.length > 0 &&
    profile.role === 'BSI'
  );
}

export async function getCachedBsiProfile(uid: string) {
  const raw = await AsyncStorage.getItem(profileKey(uid));
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    return isCachedProfile(parsed, uid) ? parsed : null;
  } catch {
    return null;
  }
}

export async function cacheBsiProfile(profile: BsiProfile) {
  await AsyncStorage.setItem(
    profileKey(profile.uid),
    JSON.stringify(profile)
  );
}
