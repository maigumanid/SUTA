import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { COLORS, TYPOGRAPHY } from '@/constants/theme';

export default function SutaBrandMark({ light = false }: { light?: boolean }) {
  const foreground = light ? COLORS.white : COLORS.primaryDeep;
  return (
    <View style={styles.row}>
      <View style={[styles.seal, light && styles.sealLight]}>
        <Ionicons name="shield-checkmark" size={28} color={light ? COLORS.primaryDeep : COLORS.white} />
        <View style={styles.dropBadge}>
          <Ionicons name="water" size={11} color={COLORS.white} />
        </View>
      </View>
      <View style={styles.copy}>
        <Text style={[styles.name, { color: foreground }]}>SUTA</Text>
        <Text style={[styles.label, { color: light ? '#CDE9E5' : COLORS.textSecondary }]}>
          SANITATION INSPECTION · FIELD OPERATIONS
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  seal: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primaryDeep },
  sealLight: { backgroundColor: COLORS.white },
  dropBadge: { position: 'absolute', right: -3, bottom: -3, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.blue, borderWidth: 2, borderColor: COLORS.primaryDeep },
  copy: { flexShrink: 1 },
  name: { ...TYPOGRAPHY.title, fontSize: 24, lineHeight: 27, letterSpacing: 2.2, fontWeight: '900' },
  label: { marginTop: 2, fontSize: 8, lineHeight: 11, letterSpacing: 1.15, fontWeight: '800' },
});
