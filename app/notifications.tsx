import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import ScreenContainer from '@/components/common/ScreenContainer';
import EmptyState from '@/components/common/EmptyState';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useNotifications } from '@/context/NotificationContext';
import { useNetwork } from '@/context/NetworkContext';
import { formatLocalDateTime } from '@/utils/dateTime';

export default function NotificationCenterScreen() {
  const { items, unreadCount, loading, error, open, markAllRead, refresh } = useNotifications();
  const { isOnline } = useNetwork();
  return <ScreenContainer>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.canGoBack() ? router.back() : router.replace('/')} style={styles.headerAction}><Ionicons name="arrow-back" size={24} color={COLORS.text} /></Pressable>
      <Text style={styles.title}>Alerts</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Mark all alerts as read" accessibilityState={{ disabled: !unreadCount || isOnline === false }} disabled={!unreadCount || isOnline === false} onPress={() => void markAllRead()} style={styles.headerAction}><Text style={[styles.readAll, (!unreadCount || isOnline === false) && styles.disabled]}>Read all</Text></Pressable>
    </View>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.permissionCard}>
        <Text style={styles.cardTitle}>Operational alerts</Text>
        <Text style={styles.body}>In-app updates for reinspections, risk, and assignments. Calendar reminders are managed from each reinspection.</Text>
      </View>
      {loading && !items.length ? <ActivityIndicator color={COLORS.primary} /> : null}
      {error ? <Text style={isOnline === false ? styles.offlineInfo : styles.error}>{error}</Text> : null}
      {!loading && !items.length ? <EmptyState icon="notifications-outline" title="You're all caught up" description="New reinspection, risk, assignment, and operational alerts will appear here." compact /> : null}
      {items.map((item) => <Pressable key={item.id} onPress={() => void open(item)} style={[styles.item, !item.read_at && styles.unread]}>
        <View style={styles.itemTop}><Text style={styles.cardTitle}>{item.title}</Text>{!item.read_at && <View style={styles.dot} />}</View>
        <Text style={styles.body}>{item.body}</Text>
        <Text style={styles.date}>{formatLocalDateTime(item.created_at)}</Text>
      </Pressable>)}
      <Pressable onPress={() => void refresh()}><Text style={styles.refresh}>Refresh</Text></Pressable>
    </ScrollView>
  </ScreenContainer>;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: SPACING.lg },
  headerAction: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  title: { ...TYPOGRAPHY.heading, color: COLORS.text }, readAll: { ...TYPOGRAPHY.label, color: COLORS.primary }, disabled: { color: COLORS.textDisabled },
  content: { gap: SPACING.md, paddingBottom: SPACING.section }, permissionCard: { padding: SPACING.lg, gap: SPACING.md, borderRadius: RADIUS.xl, backgroundColor: COLORS.primarySoft, borderWidth: 1, borderColor: COLORS.primaryLight },
  item: { padding: SPACING.lg, gap: SPACING.sm, borderRadius: RADIUS.xl, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.subtle }, unread: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  itemTop: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACING.sm }, cardTitle: { ...TYPOGRAPHY.label, color: COLORS.text, flex: 1 }, body: { ...TYPOGRAPHY.body, color: COLORS.textSecondary }, date: { ...TYPOGRAPHY.caption, color: COLORS.textMuted },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: COLORS.primary }, refresh: { ...TYPOGRAPHY.label, textAlign: 'center', color: COLORS.primary, padding: SPACING.md },
  error: { ...TYPOGRAPHY.body, color: COLORS.violation, textAlign: 'center' },
  offlineInfo: { ...TYPOGRAPHY.body, color: COLORS.offline, textAlign: 'center' },
});
