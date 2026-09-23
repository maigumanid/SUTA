import { StyleSheet, Text, View } from 'react-native';

import { RADIUS } from '@/constants/theme';
import { RiskLevel } from '@/types/place';

type RiskBadgeProps = {
  level: RiskLevel;
};

export default function RiskBadge({ level }: RiskBadgeProps) {
  const getBadgeStyle = () => {
    switch (level) {
      case 'Low':
        return {
          backgroundColor: '#E8F3EC',
          textColor: 'compliant',
        };

      case 'Medium':
        return {
          backgroundColor: '#FFF4DD',
          textColor: 'warning',
        };

      case 'High':
        return {
          backgroundColor: 'riskHighSoft',
          textColor: 'riskHigh',
        };
    }
  };

  const badgeStyle = getBadgeStyle();

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: badgeStyle.backgroundColor },
      ]}
    >
      <Text
        style={[
          styles.text,
          { color: badgeStyle.textColor },
        ]}
      >
        {level} Risk
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
  },

  text: {
    fontSize: 12,
    fontWeight: '700',
  },
});
