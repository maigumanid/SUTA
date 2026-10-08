import type { ComponentProps } from 'react';
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS, RADIUS, SHADOWS } from '@/constants/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];
type Variant = 'inspection' | 'community' | 'reports' | 'offline';
type IllustrationSize = 'small' | 'medium' | 'large';

const variants: Record<Variant, { main: IconName; side: IconName; accent: IconName }> = {
  inspection: { main: 'clipboard-outline', side: 'home-outline', accent: 'water-outline' },
  community: { main: 'business-outline', side: 'people-outline', accent: 'leaf-outline' },
  reports: { main: 'bar-chart-outline', side: 'document-text-outline', accent: 'checkmark-circle-outline' },
  offline: { main: 'cloud-offline-outline', side: 'phone-portrait-outline', accent: 'shield-checkmark-outline' },
};

export default function SanitationIllustration({
  variant = 'inspection',
  size = 'large',
  style,
}: {
  variant?: Variant;
  size?: IllustrationSize;
  style?: StyleProp<ViewStyle>;
}) {
  const art = variants[variant];
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.frame, frameStyles[size], style]}
    >
      <View style={[styles.canvas, canvasStyles[size]]}>
      <View style={styles.orbitLarge} />
      <View style={styles.orbitSmall} />
      <View style={styles.ground} />
      <View style={styles.mainCard}>
        <View style={styles.mainTop}><View style={styles.lineWide} /><View style={styles.lineShort} /></View>
        <View style={styles.mainIcon}><Ionicons name={art.main} size={42} color={COLORS.primary} /></View>
        <View style={styles.checkRow}><Ionicons name="checkmark-circle" size={15} color={COLORS.compliant} /><View style={styles.checkLine} /></View>
        <View style={styles.checkRow}><Ionicons name="checkmark-circle" size={15} color={COLORS.compliant} /><View style={[styles.checkLine, styles.checkLineShort]} /></View>
      </View>
      <View style={styles.sideCard}><Ionicons name={art.side} size={28} color={COLORS.indigo} /></View>
      <View style={styles.accentCard}><Ionicons name={art.accent} size={24} color={COLORS.blue} /></View>
      <View style={styles.sparkOne} />
      <View style={styles.sparkTwo} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { alignSelf: 'center', position: 'relative', overflow: 'hidden' },
  canvas: { width: 230, height: 190, position: 'absolute' },
  orbitLarge: { position: 'absolute', width: 176, height: 176, borderRadius: 88, backgroundColor: 'rgba(255,255,255,0.10)', left: 27, top: 5 },
  orbitSmall: { position: 'absolute', width: 118, height: 118, borderRadius: 59, backgroundColor: 'rgba(71,184,174,0.24)', right: 2, top: 30 },
  ground: { position: 'absolute', width: 176, height: 22, borderRadius: 11, backgroundColor: 'rgba(4,59,56,0.20)', left: 30, bottom: 6 },
  mainCard: { position: 'absolute', width: 126, height: 156, left: 46, top: 14, borderRadius: RADIUS.xl, backgroundColor: COLORS.surface, padding: 14, ...SHADOWS.elevated },
  mainTop: { gap: 5 },
  lineWide: { height: 6, width: 58, borderRadius: 3, backgroundColor: COLORS.primaryLight },
  lineShort: { height: 5, width: 38, borderRadius: 3, backgroundColor: COLORS.surfaceMuted },
  mainIcon: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 },
  checkLine: { height: 5, flex: 1, borderRadius: 3, backgroundColor: COLORS.surfaceMuted },
  checkLineShort: { maxWidth: 54 },
  sideCard: { position: 'absolute', width: 62, height: 62, right: 7, top: 22, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.indigoSoft, borderWidth: 3, borderColor: 'rgba(255,255,255,0.65)', transform: [{ rotate: '7deg' }] },
  accentCard: { position: 'absolute', width: 52, height: 52, left: 10, bottom: 20, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.blueSoft, borderWidth: 3, borderColor: 'rgba(255,255,255,0.70)', transform: [{ rotate: '-8deg' }] },
  sparkOne: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: '#F4C66A', right: 20, bottom: 32 },
  sparkTwo: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.aqua, left: 23, top: 22 },
});

const frameStyles = StyleSheet.create({
  small: { width: 138, height: 114 },
  medium: { width: 184, height: 152 },
  large: { width: 230, height: 190 },
});

const canvasStyles = StyleSheet.create({
  small: { left: -46, top: -38, transform: [{ scale: 0.6 }] },
  medium: { left: -23, top: -19, transform: [{ scale: 0.8 }] },
  large: { left: 0, top: 0 },
});
