import { Ionicons } from '@expo/vector-icons';
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  COLORS,
  RADIUS,
  SPACING,
} from '@/constants/theme';

export type TourTarget = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type TourOverlayProps = {
  visible: boolean;
  step: number;
  totalSteps: number;
  title: string;
  description: string;
  target: TourTarget | null;
  onNext: () => void;
  onBack?: () => void;
  onSkip?: () => void;
};

const {
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
} = Dimensions.get('window');

const SPOTLIGHT_PADDING = 8;
const TOOLTIP_GAP = 18;
const TOOLTIP_HEIGHT = 230;
const SCREEN_PADDING = 16;

export default function TourOverlay({
  visible,
  step,
  totalSteps,
  title,
  description,
  target,
  onNext,
  onBack,
  onSkip,
}: TourOverlayProps) {
  if (!target) {
    return null;
  }

  const spotlightX = Math.max(
    target.x - SPOTLIGHT_PADDING,
    0
  );

  const spotlightY = Math.max(
    target.y - SPOTLIGHT_PADDING,
    0
  );

  const spotlightWidth = Math.min(
    target.width +
      SPOTLIGHT_PADDING * 2,
    SCREEN_WIDTH - spotlightX
  );

  const spotlightHeight = Math.min(
    target.height +
      SPOTLIGHT_PADDING * 2,
    SCREEN_HEIGHT - spotlightY
  );

  const spotlightBottom =
    spotlightY + spotlightHeight;

  const availableBelow =
    SCREEN_HEIGHT -
    spotlightBottom -
    TOOLTIP_GAP -
    SCREEN_PADDING;

  const availableAbove =
    spotlightY -
    TOOLTIP_GAP -
    SCREEN_PADDING;

  const showBelow =
    availableBelow >= TOOLTIP_HEIGHT ||
    availableBelow >= availableAbove;

  const tooltipPosition = showBelow
    ? {
        top: Math.min(
          spotlightBottom + TOOLTIP_GAP,
          SCREEN_HEIGHT -
            TOOLTIP_HEIGHT -
            SCREEN_PADDING
        ),
      }
    : {
        bottom: Math.min(
          SCREEN_HEIGHT -
            spotlightY +
            TOOLTIP_GAP,
          SCREEN_HEIGHT -
            TOOLTIP_HEIGHT -
            SCREEN_PADDING
        ),
      };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.container}>
        <View
          style={[
            styles.overlay,
            {
              left: 0,
              top: 0,
              width: SCREEN_WIDTH,
              height: spotlightY,
            },
          ]}
        />

        <View
          style={[
            styles.overlay,
            {
              left: 0,
              top: spotlightY,
              width: spotlightX,
              height: spotlightHeight,
            },
          ]}
        />

        <View
          style={[
            styles.overlay,
            {
              left:
                spotlightX +
                spotlightWidth,
              top: spotlightY,
              width: Math.max(
                SCREEN_WIDTH -
                  spotlightX -
                  spotlightWidth,
                0
              ),
              height: spotlightHeight,
            },
          ]}
        />

        <View
          style={[
            styles.overlay,
            {
              left: 0,
              top: spotlightBottom,
              width: SCREEN_WIDTH,
              height: Math.max(
                SCREEN_HEIGHT -
                  spotlightBottom,
                0
              ),
            },
          ]}
        />

        <View
          pointerEvents="none"
          style={[
            styles.highlight,
            {
              left: spotlightX,
              top: spotlightY,
              width: spotlightWidth,
              height: spotlightHeight,
            },
          ]}
        />

        <View
          style={[
            styles.tooltip,
            tooltipPosition,
          ]}
        >
          <View
            style={styles.tooltipHeader}
          >
            <Text style={styles.stepText}>
              Step {step} of {totalSteps}
            </Text>

            <View
              style={styles.headerRight}
            >
              <View
                style={styles.stepBadge}
              >
                <Text
                  style={
                    styles.stepBadgeText
                  }
                >
                  {step}/{totalSteps}
                </Text>
              </View>

              {onSkip && (
                <Pressable
                  onPress={onSkip}
                  hitSlop={10}
                  style={({
                    pressed,
                  }) => [
                    styles.closeButton,
                    pressed &&
                      styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Skip tour"
                >
                  <Ionicons
                    name="close"
                    size={22}
                    color={
                      COLORS.textSecondary
                    }
                  />
                </Pressable>
              )}
            </View>
          </View>

          <Text style={styles.title}>
            {title}
          </Text>

          <Text
            style={styles.description}
          >
            {description}
          </Text>

          <View style={styles.actions}>
            <View>
              {onSkip && (
                <Pressable
                  onPress={onSkip}
                  style={({ pressed }) => [
                    styles.skipButton,
                    pressed &&
                      styles.pressed,
                  ]}
                >
                  <Text
                    style={styles.skipText}
                  >
                    Skip Tour
                  </Text>
                </Pressable>
              )}
            </View>

            <View
              style={
                styles.navigationActions
              }
            >
              {onBack && (
                <Pressable
                  onPress={onBack}
                  style={({ pressed }) => [
                    styles.backButton,
                    pressed &&
                      styles.pressed,
                  ]}
                >
                  <Ionicons
                    name="arrow-back"
                    size={18}
                    color={COLORS.primary}
                  />

                  <Text
                    style={styles.backText}
                  >
                    Back
                  </Text>
                </Pressable>
              )}

              <Pressable
                onPress={onNext}
                style={({ pressed }) => [
                  styles.nextButton,
                  pressed &&
                    styles.pressed,
                ]}
              >
                <Text
                  style={styles.nextText}
                >
                  {step === totalSteps
                    ? 'Continue'
                    : 'Next'}
                </Text>

                <Ionicons
                  name="arrow-forward"
                  size={18}
                  color={COLORS.surface}
                />
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  overlay: {
    position: 'absolute',
    backgroundColor:
      'rgba(0, 0, 0, 0.68)',
  },

  highlight: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: COLORS.primaryLight,
    borderRadius: RADIUS.md,
  },

  tooltip: {
    position: 'absolute',
    left: SCREEN_PADDING,
    right: SCREEN_PADDING,

    minHeight: 170,
    maxHeight: TOOLTIP_HEIGHT,

    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,

    elevation: 12,

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },

  tooltipHeader: {
    flexDirection: 'row',
    justifyContent:
      'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },

  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },

  stepText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },

  stepBadge: {
    backgroundColor:
      COLORS.primarySoft,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
  },

  stepBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },

  closeButton: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
  },

  title: {
    fontSize: 19,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },

  description: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textSecondary,
    flexShrink: 1,
  },

  actions: {
    flexDirection: 'row',
    justifyContent:
      'space-between',
    alignItems: 'center',
    marginTop: SPACING.lg,
    gap: SPACING.sm,
  },

  navigationActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },

  skipButton: {
    paddingVertical: 10,
    paddingHorizontal: 4,
  },

  skipText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMuted,
  },

  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 6,
  },

  backText: {
    color: COLORS.primary,
    fontWeight: '700',
  },

  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,

    backgroundColor: COLORS.primary,

    paddingHorizontal: 18,
    paddingVertical: 11,

    borderRadius: RADIUS.md,
  },

  nextText: {
    color: COLORS.surface,
    fontWeight: '700',
  },

  pressed: {
    opacity: 0.7,
  },
});
