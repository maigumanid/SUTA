import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS, RADIUS, SHADOWS } from '@/constants/theme';
import { useNotifications } from '@/context/NotificationContext';

export default function NotificationBell() {
  const { unreadCount } = useNotifications();
  return <Pressable accessibilityLabel={unreadCount ? `${unreadCount} unread alerts` : 'Alerts'} onPress={() => router.push('/notifications')} style={styles.button}>
    <Ionicons name="notifications-outline" size={25} color={COLORS.text} />
    {unreadCount ? <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text></View> : null}
  </Pressable>;
}

const styles = StyleSheet.create({
  button: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.lg, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.subtle },
  badge: { position: 'absolute', top: 2, right: 3, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.violation, borderWidth: 2, borderColor: COLORS.background },
  badgeText: { color: COLORS.white, fontSize: 9, fontWeight: '800' },
});
