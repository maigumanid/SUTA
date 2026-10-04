import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AppProfile } from '@/types/inspector';

function profileKey(uid: string) {
  return `suta_bsi_profile:${uid}`;
}

function normalizeCachedProfile(value: unknown, uid: string): AppProfile | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const profile = value as Partial<AppProfile> & { role?: string };
  const { name, email, contactNumber, assignedBarangayId, assignedBarangay } = profile;
  const isValid = (
    profile.uid === uid &&
    typeof name === 'string' && name.length > 0 &&
    typeof email === 'string' && email.length > 0 &&
    typeof contactNumber === 'string' && contactNumber.length > 0 &&
    typeof assignedBarangayId === 'string' &&
    typeof assignedBarangay === 'string' &&
    (profile.role === 'bsi' || profile.role === 'admin' || profile.role === 'BSI') &&
    (profile.role === 'admin' ||
      (typeof assignedBarangayId === 'string' && assignedBarangayId.length > 0 &&
        typeof assignedBarangay === 'string' && assignedBarangay.length > 0))
  );

  if (
    !isValid ||
    typeof name !== 'string' ||
    typeof email !== 'string' ||
    typeof contactNumber !== 'string' ||
    typeof assignedBarangayId !== 'string' ||
    typeof assignedBarangay !== 'string'
  ) return null;

  const normalizedRole = profile.role === 'admin' ? 'admin' : 'bsi';
  return {
    uid,
    name,
    email,
    contactNumber,
    assignedBarangayId,
    assignedBarangay,
    role: normalizedRole,
    active: typeof profile.active === 'boolean' ? profile.active : true,
    mustChangePassword:
      typeof profile.mustChangePassword === 'boolean'
        ? profile.mustChangePassword
        : false,
    ...(typeof profile.jurisdictionName === 'string'
      ? { jurisdictionName: profile.jurisdictionName }
      : {}),
  };
}

export async function getCachedProfile(uid: string) {
  const raw = await AsyncStorage.getItem(profileKey(uid));
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    return normalizeCachedProfile(parsed, uid);
  } catch {
    return null;
  }
}

export async function cacheProfile(profile: AppProfile) {
  await AsyncStorage.setItem(
    profileKey(profile.uid),
    JSON.stringify(profile)
  );
}
