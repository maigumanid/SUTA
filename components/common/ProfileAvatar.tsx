import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { COLORS } from '@/constants/theme';
import { createProfileAvatarSignedUrl } from '@/services/profileAvatarService';

export default function ProfileAvatar({
  name,
  avatarPath,
  localUri,
  size = 56,
}: {
  name: string;
  avatarPath?: string;
  localUri?: string;
  size?: number;
}) {
  const [remoteUri, setRemoteUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => setRetryCount(0), [avatarPath, localUri]);

  useEffect(() => {
    let active = true;
    setFailed(false);
    setRemoteUri(null);
    if (!avatarPath || localUri) return () => { active = false; };
    void createProfileAvatarSignedUrl(avatarPath)
      .then((uri) => { if (active) setRemoteUri(uri); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [avatarPath, localUri, retryCount]);

  const handleError = () => {
    if (avatarPath && !localUri && retryCount < 1) {
      setRetryCount((current) => current + 1);
      return;
    }
    setFailed(true);
  };

  const uri = localUri ?? remoteUri;
  const initials = name.trim().split(/\s+/).slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase()).join('') || 'SUTA';
  const dimensions = { width: size, height: size, borderRadius: size / 2 };

  if (uri && !failed) {
    return <Image source={{ uri }} contentFit="cover" onError={handleError} style={[styles.avatar, dimensions]} />;
  }

  return <View style={[styles.fallback, dimensions]}><Text style={[styles.initials, { fontSize: Math.max(12, size * 0.28) }]}>{initials}</Text></View>;
}

const styles = StyleSheet.create({
  avatar: { backgroundColor: COLORS.surfaceMuted },
  fallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primarySoft },
  initials: { fontWeight: '800', color: COLORS.primary },
});
