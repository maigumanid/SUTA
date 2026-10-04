import { StyleSheet, Text, View } from 'react-native';

import { COLORS, RADIUS } from '@/constants/theme';
import { getRiskClassification } from '@/utils/riskClassification';

export default function RiskBadge() {
  const classification = getRiskClassification();

  return (
    <View style={styles.badge}>
      <Text style={styles.text}>
        {classification.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.neutralSoft,
  },

  text: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.neutral,
  },
});
