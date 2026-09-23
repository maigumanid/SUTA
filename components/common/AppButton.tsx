import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native';

import {
  COLORS,
  RADIUS,
  SIZE,
  SPACING,
  TYPOGRAPHY,
} from '@/constants/theme';

type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'danger';

interface AppButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export default function AppButton({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
}: AppButtonProps) {
  const isDisabled = disabled || loading;

  const getButtonStyle = () => {
    switch (variant) {
      case 'secondary':
        return styles.secondary;

      case 'outline':
        return styles.outline;

      case 'danger':
        return styles.danger;

      default:
        return styles.primary;
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'secondary':
      case 'outline':
        return styles.primaryText;

      default:
        return styles.lightText;
    }
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        getButtonStyle(),
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={COLORS.white} />
      ) : (
        <Text style={[styles.text, getTextStyle()]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: SIZE.buttonHeight,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,

    alignItems: 'center',
    justifyContent: 'center',

    borderWidth: 1,
  },

  primary: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },

  secondary: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.primaryLight,
  },

  outline: {
    backgroundColor: COLORS.transparent,
    borderColor: COLORS.primary,
  },

  danger: {
    backgroundColor: COLORS.violation,
    borderColor: COLORS.violation,
  },

  pressed: {
    opacity: 0.82,
  },

  disabled: {
    opacity: 0.5,
  },

  text: {
    ...TYPOGRAPHY.button,
  },

  lightText: {
    color: COLORS.white,
  },

  primaryText: {
    color: COLORS.primary,
  },
});
