import { StyleSheet, Text, View } from 'react-native';

import { COLORS, RADIUS, SIZE, TYPOGRAPHY } from '@/constants/theme';

export default function InitialsAvatar({ name }: { name: string }) {
  const initials = name.trim().split(/\s+/).slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase()).join('') || 'BSI';
  return <View style={styles.avatar}><Text style={styles.text}>{initials}</Text></View>;
}

const styles = StyleSheet.create({
  avatar: { width: SIZE.avatarMedium, height: SIZE.avatarMedium, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primarySoft },
  text: { ...TYPOGRAPHY.label, color: COLORS.primary },
});
