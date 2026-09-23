import { router } from 'expo-router';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import AppButton from '@/components/common/AppButton';
import ScreenContainer from '@/components/common/ScreenContainer';
import {
  COLORS,
  RADIUS,
  SPACING,
} from '@/constants/theme';

export default function OnboardingScreen() {
  const startTour = () => {
    router.replace({
      pathname: '/(tabs)/dashboard',
      params: {
        tour: 'true',
      },
    });
  };

  const skipTour = () => {
    router.replace('/(tabs)/dashboard');
  };

  return (
    <ScreenContainer>
      <View style={styles.container}>
        <View>
          <Text style={styles.badge}>
            SUTA
          </Text>

          <Text style={styles.title}>
            Welcome, Inspector
          </Text>

          <Text style={styles.description}>
            Take a quick guided tour to learn
            how to conduct inspections, record
            sanitary concerns, manage
            reinspections, and work offline.
          </Text>
        </View>

        <View style={styles.bottom}>
          <Text style={styles.note}>
            This tour will guide you through
            the actual app.
          </Text>

          <AppButton
            title="Start App Tour"
            onPress={startTour}
          />

          <Pressable
            onPress={skipTour}
            style={({ pressed }) => [
              styles.skipButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.skipText}>
              Skip Tour
            </Text>
          </Pressable>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: SPACING.xl,
  },

  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: SPACING.lg,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    color: COLORS.primary,
    fontWeight: '700',
  },

  title: {
    marginBottom: SPACING.md,
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.text,
  },

  description: {
    fontSize: 16,
    lineHeight: 24,
    color: COLORS.textSecondary,
  },

  bottom: {
    gap: SPACING.md,
  },

  note: {
    fontSize: 14,
    textAlign: 'center',
    color: COLORS.textMuted,
  },

  skipButton: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
  },

  skipText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },

  pressed: {
    opacity: 0.65,
  },
});
