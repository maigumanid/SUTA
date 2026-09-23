import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';

import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import AppButton from '@/components/common/AppButton';
import AppInput from '@/components/common/AppInput';
import ScreenContainer from '@/components/common/ScreenContainer';

import {
  COLORS,
  RADIUS,
  SPACING,
  TYPOGRAPHY,
} from '@/constants/theme';

import {
  LoginFormData,
  loginSchema,
} from '@/utils/validation';

export default function LoginScreen() {
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),

    defaultValues: {
      email: '',
      password: '',
    },
  });

  const handleLogin = async (data: LoginFormData) => {
    console.log('Login data:', data);

    // Firebase Authentication will replace this later.
    router.replace('/onboarding');
  };

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brand}>
            <View style={styles.logoMark}>
              <Text style={styles.logoText}>SI</Text>
            </View>

            <Text style={styles.systemLabel}>
              SANITARY INSPECTION SYSTEM
            </Text>
          </View>

          <View style={styles.heading}>
            <Text style={styles.title}>
              Welcome back.
            </Text>

            <Text style={styles.description}>
              Sign in with your inspector account to
              continue field operations.
            </Text>
          </View>

          <View style={styles.form}>
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <AppInput
                  label="EMAIL ADDRESS"
                  placeholder="inspector@example.com"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                  error={errors.email?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <AppInput
                  label="PASSWORD"
                  placeholder="Enter your password"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  password
                  autoCapitalize="none"
                  error={errors.password?.message}
                />
              )}
            />

            <AppButton
              title="Sign In"
              onPress={handleSubmit(handleLogin)}
              loading={isSubmitting}
            />
          </View>

          <View style={styles.securityNotice}>
            <Text style={styles.securityTitle}>
              AUTHORIZED ACCESS ONLY
            </Text>

            <Text style={styles.securityText}>
              This system is intended for authorized sanitary
              inspection personnel.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },

  content: {
    flexGrow: 1,
    justifyContent: 'center',

    paddingVertical: SPACING.xxxl,
  },

  brand: {
    marginBottom: SPACING.xxxl,
  },

  logoMark: {
    width: 52,
    height: 52,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: COLORS.primary,

    borderRadius: RADIUS.md,

    marginBottom: SPACING.lg,
  },

  logoText: {
    ...TYPOGRAPHY.heading,
    color: COLORS.white,
  },

  systemLabel: {
    ...TYPOGRAPHY.label,
    color: COLORS.primary,
  },

  heading: {
    marginBottom: SPACING.xxxl,
  },

  title: {
    ...TYPOGRAPHY.display,
    color: COLORS.text,
  },

  description: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,

    marginTop: SPACING.sm,
  },

  form: {
    gap: SPACING.lg,
  },

  securityNotice: {
    marginTop: SPACING.xxxl,

    paddingTop: SPACING.lg,

    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },

  securityTitle: {
    ...TYPOGRAPHY.label,
    color: COLORS.textMuted,
  },

  securityText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,

    marginTop: SPACING.xs,
  },
});
