import { ReactNode } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  View,
} from 'react-native';

import {
  COLORS,
  LAYOUT,
} from '@/constants/theme';

interface ScreenContainerProps {
  children: ReactNode;
}

export default function ScreenContainer({
  children,
}: ScreenContainerProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  container: {
    flex: 1,
    paddingHorizontal: LAYOUT.screenPadding,
  },
});
