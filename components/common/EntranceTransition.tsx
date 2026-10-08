import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

export default function EntranceTransition({
  children,
  delay = 0,
  distance = 10,
  duration = 280,
  style,
}: {
  children: ReactNode;
  delay?: number;
  distance?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let active = true;
    let animation: Animated.CompositeAnimation | undefined;

    void AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduceMotion) => {
        if (!active) return;

        if (reduceMotion) {
          progress.setValue(1);
          return;
        }

        animation = Animated.timing(progress, {
          toValue: 1,
          delay,
          duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        });
        animation.start();
      });

    return () => {
      active = false;
      animation?.stop();
    };
  }, [delay, duration, progress]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [distance, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
