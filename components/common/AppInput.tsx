import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';

import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';

import {
  COLORS,
  ICON_SIZE,
  RADIUS,
  SIZE,
  SPACING,
  TYPOGRAPHY,
} from '@/constants/theme';

interface AppInputProps extends TextInputProps {
  label: string;
  error?: string;
  password?: boolean;
}

export default function AppInput({
  label,
  error,
  password = false,
  onFocus,
  onBlur,
  ...props
}: AppInputProps) {
  const [showPassword, setShowPassword] =
    useState(false);

  const [focused, setFocused] =
    useState(false);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>
        {label}
      </Text>

      <View
        style={[
          styles.inputContainer,
          focused && styles.focused,
          error && styles.error,
        ]}
      >
        <TextInput
          {...props}
          style={styles.input}
          placeholderTextColor={
            COLORS.textMuted
          }
          secureTextEntry={
            password
              ? !showPassword
              : false
          }
          textContentType={
            password
              ? 'none'
              : props.textContentType
          }
          autoComplete={
            password
              ? 'off'
              : props.autoComplete
          }
          importantForAutofill={
            password
              ? 'no'
              : 'auto'
          }
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
        />

        {password && (
          <Pressable
            onPress={() =>
              setShowPassword(
                (current) => !current
              )
            }
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={
              showPassword
                ? 'Hide password'
                : 'Show password'
            }
            style={({ pressed }) => [
              styles.passwordButton,
              pressed &&
                styles.passwordButtonPressed,
            ]}
          >
            <Ionicons
              name={
                showPassword
                  ? 'eye-off-outline'
                  : 'eye-outline'
              }
              size={ICON_SIZE.md}
              color={
                COLORS.textSecondary
              }
            />
          </Pressable>
        )}
      </View>

      {error ? (
        <Text style={styles.errorText}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },

  label: {
    ...TYPOGRAPHY.label,
    marginBottom: SPACING.sm,
    color: COLORS.textSecondary,
  },

  inputContainer: {
    minHeight: SIZE.inputHeight,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
  },

  focused: {
    borderColor: COLORS.primary,
  },

  error: {
    borderColor: COLORS.violation,
  },

  input: {
    flex: 1,
    ...TYPOGRAPHY.body,
    paddingVertical: 0,
    paddingRight: SPACING.sm,
    color: COLORS.text,
  },

  passwordButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  passwordButtonPressed: {
    opacity: 0.5,
  },

  errorText: {
    ...TYPOGRAPHY.caption,
    marginTop: SPACING.xs,
    color: COLORS.violation,
  },
});
