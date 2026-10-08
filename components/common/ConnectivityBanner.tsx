import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useInspectionSync } from '@/context/InspectionSyncContext';
import { useNetwork } from '@/context/NetworkContext';

export default function ConnectivityBanner() {
  const { profile } = useAuth();
  const { isOnline } = useNetwork();
  const { syncFeedback } = useInspectionSync();
  const [details, setDetails] = useState(false);
  const insets = useSafeAreaInsets();

  if (!profile || profile.role === 'admin' || (isOnline !== false && !syncFeedback)) return null;

  const message = isOnline === false
    ? 'Inspections can still be saved on this device.'
    : syncFeedback === 'syncing'
      ? 'Back online. Syncing pending records…'
      : syncFeedback === 'attention'
        ? 'Some records need attention.'
        : 'Sync complete.';

  return <>
    <Pressable
      accessibilityRole="button"
      onPress={() => setDetails(true)}
      style={[
        styles.banner,
        { marginTop: insets.top > 0 ? SPACING.xs : SPACING.sm },
        isOnline === false
          ? styles.offline
          : syncFeedback === 'attention'
            ? styles.attention
            : styles.online,
      ]}
    >
      <Ionicons name={isOnline === false ? 'cloud-offline-outline' : syncFeedback === 'attention' ? 'warning-outline' : 'cloud-done-outline'} size={19} color={COLORS.text} />
      <View style={styles.bannerCopy}>
        {isOnline === false ? <Text style={styles.bannerTitle}>Offline Mode</Text> : null}
        <Text style={styles.bannerText}>{message}</Text>
        {isOnline === false ? <Text style={styles.bannerLink}>View offline capabilities</Text> : null}
      </View>
      <Ionicons name="information-circle-outline" size={18} color={COLORS.textSecondary} />
    </Pressable>

    <Modal visible={details} transparent animationType="fade" onRequestClose={() => setDetails(false)}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, SPACING.lg) }]}>
          <View style={styles.sheetHeader}>
            <Text style={styles.title}>Offline capability</Text>
            <Pressable accessibilityLabel="Close offline capability information" onPress={() => setDetails(false)}>
              <Ionicons name="close" size={26} color={COLORS.text} />
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>AVAILABLE OFFLINE</Text>
            <Bullet text="View cached assigned places where available" />
            <Bullet text="Start or continue inspection drafts" />
            <Bullet text="Complete checklists, findings, and evidence photos" />
            <Bullet text="Save inspections locally" />
            <Bullet text="View local pending or failed Sync Status records" />
            <Text style={styles.label}>REQUIRES INTERNET</Text>
            <Bullet text="First sign-in or sign-in after logout" />
            <Bullet text="Reports and uncached remote records" />
            <Bullet text="Refreshing operational alerts and server data" />
            <Bullet text="Server synchronization" />
          </ScrollView>
        </View>
      </View>
    </Modal>
  </>;
}

function Bullet({ text }: { text: string }) {
  return <View style={styles.bulletRow}><Text style={styles.bullet}>•</Text><Text style={styles.body}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  banner: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginHorizontal: SPACING.md, marginBottom: SPACING.xs, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.subtle },
  offline: { backgroundColor: COLORS.offlineSoft },
  online: { backgroundColor: COLORS.compliantSoft },
  attention: { backgroundColor: COLORS.warningSoft },
  bannerCopy: { flex: 1 },
  bannerTitle: { ...TYPOGRAPHY.label, color: COLORS.text },
  bannerText: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary },
  bannerLink: { ...TYPOGRAPHY.caption, color: COLORS.primary, marginTop: 2, fontWeight: '700' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { maxHeight: '78%', padding: SPACING.xl, backgroundColor: COLORS.surface, borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
  title: { ...TYPOGRAPHY.heading, color: COLORS.text },
  label: { ...TYPOGRAPHY.label, color: COLORS.primary, marginTop: SPACING.lg, marginBottom: SPACING.sm },
  body: { ...TYPOGRAPHY.body, color: COLORS.textSecondary, flex: 1 },
  bulletRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm },
  bullet: { ...TYPOGRAPHY.body, color: COLORS.primary },
});
