import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';

import AppButton from '@/components/common/AppButton';
import AppInput from '@/components/common/AppInput';
import KeyboardSafeView from '@/components/common/KeyboardSafeView';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { usePlaces } from '@/context/PlacesContext';
import { registerPlace } from '@/services/placeService';
import { PLACE_TYPES } from '@/types/place';

const placeRegistrationSchema = z.object({
  name: z.string().trim().min(1, 'Place or household name is required.'),
  representativeName: z
    .string()
    .trim()
    .min(1, 'Representative or household head name is required.'),
  purok: z.string().trim().min(1, 'Purok is required.'),
  address: z.string().trim().min(1, 'Address is required.'),
  placeType: z.enum(PLACE_TYPES, {
    error: 'Select a place type.',
  }),
});

type PlaceRegistrationForm = z.infer<typeof placeRegistrationSchema>;

export default function PlaceRegistrationScreen() {
  const { user, profile } = useAuth();
  const { refreshPlaces } = usePlaces();
  const insets = useSafeAreaInsets();
  const savingRef = useRef(false);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PlaceRegistrationForm>({
    resolver: zodResolver(placeRegistrationSchema),
    defaultValues: {
      name: '',
      representativeName: '',
      purok: '',
      address: '',
      placeType: undefined,
    },
  });

  const submitRegistration = async (data: PlaceRegistrationForm) => {
    if (savingRef.current) return;

    if (!user || !profile) {
      Alert.alert(
        'Unable to Register Place',
        'Your inspector session is unavailable. Please sign in again.'
      );
      return;
    }

    savingRef.current = true;

    try {
      await registerPlace(
        data,
        user.uid,
        profile.assignedBarangayId,
        profile.assignedBarangay
      );
      await refreshPlaces();

      Alert.alert(
        'Place Registered',
        `${data.name} was added to ${profile.assignedBarangay}.`,
        [
          {
            text: 'View Places',
            onPress: () => router.replace('/(tabs)/establishments'),
          },
        ],
        { cancelable: false }
      );
    } catch (error) {
      Alert.alert(
        'Unable to Register Place',
        getRegistrationErrorMessage(error)
      );
    } finally {
      savingRef.current = false;
    }
  };

  return (
    <KeyboardSafeView>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            disabled={isSubmitting}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </Pressable>

          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Register Place</Text>
            <Text style={styles.headerSubtitle}>Add a place to your directory</Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={[
            styles.content,
            { paddingBottom: SPACING.xxl + insets.bottom },
          ]}
        >
          <View style={styles.assignmentCard}>
            <View style={styles.assignmentIcon}>
              <Ionicons name="location-outline" size={22} color={COLORS.primary} />
            </View>
            <View style={styles.assignmentText}>
              <Text style={styles.assignmentLabel}>ASSIGNED BARANGAY</Text>
              <Text style={styles.assignmentValue}>
                {profile?.assignedBarangay ?? 'Unavailable'}
              </Text>
              <Text style={styles.assignmentHelp}>
                This place will be registered only to your assigned barangay.
              </Text>
            </View>
          </View>

          <View style={styles.form}>
            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, onBlur, value } }) => (
                <AppInput
                  label="PLACE / HOUSEHOLD NAME"
                  placeholder="Enter place or household name"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.name?.message}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              )}
            />

            <Controller
              control={control}
              name="representativeName"
              render={({ field: { onChange, onBlur, value } }) => (
                <AppInput
                  label="REPRESENTATIVE / HOUSEHOLD HEAD"
                  placeholder="Enter full name"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.representativeName?.message}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              )}
            />

            <Controller
              control={control}
              name="purok"
              render={({ field: { onChange, onBlur, value } }) => (
                <AppInput
                  label="PUROK"
                  placeholder="Enter purok"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.purok?.message}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              )}
            />

            <Controller
              control={control}
              name="address"
              render={({ field: { onChange, onBlur, value } }) => (
                <AppInput
                  label="ADDRESS"
                  placeholder="Enter complete address"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.address?.message}
                  autoCapitalize="words"
                  returnKeyType="done"
                />
              )}
            />

            <Controller
              control={control}
              name="placeType"
              render={({ field: { onChange, value } }) => (
                <View>
                  <Text style={styles.fieldLabel}>PLACE TYPE</Text>
                  <View style={styles.typeOptions}>
                    {PLACE_TYPES.map((type) => {
                      const selected = value === type;

                      return (
                        <Pressable
                          key={type}
                          onPress={() => onChange(type)}
                          disabled={isSubmitting}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: selected }}
                          style={({ pressed }) => [
                            styles.typeOption,
                            selected && styles.typeOptionSelected,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text
                            style={[
                              styles.typeOptionText,
                              selected && styles.typeOptionTextSelected,
                            ]}
                          >
                            {type}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {errors.placeType?.message ? (
                    <Text style={styles.errorText}>{errors.placeType.message}</Text>
                  ) : null}
                </View>
              )}
            />

            <AppButton
              title="Register Place"
              onPress={handleSubmit(submitRegistration)}
              loading={isSubmitting}
              disabled={!user || !profile}
            />
          </View>
        </ScrollView>
      </View>
    </KeyboardSafeView>
  );
}

function getRegistrationErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.message.includes('permission-denied')) {
      return 'You do not have permission to add a place to this barangay.';
    }

    if (error.message.includes('unavailable')) {
      return 'The service is currently unavailable. Check your connection and try again.';
    }

    return error.message;
  }

  return 'The place could not be registered. Please try again.';
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  backButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primarySoft,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  content: {
    padding: SPACING.lg,
    gap: SPACING.xl,
  },
  assignmentCard: {
    flexDirection: 'row',
    gap: SPACING.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.primaryLight,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primarySoft,
  },
  assignmentIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
  },
  assignmentText: {
    flex: 1,
  },
  assignmentLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: COLORS.primary,
  },
  assignmentValue: {
    marginTop: 3,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  assignmentHelp: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.textSecondary,
  },
  form: {
    gap: SPACING.lg,
  },
  fieldLabel: {
    marginBottom: SPACING.sm,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.7,
    color: COLORS.textSecondary,
  },
  typeOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  typeOption: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surface,
  },
  typeOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  typeOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  typeOptionTextSelected: {
    color: COLORS.white,
  },
  errorText: {
    marginTop: SPACING.xs,
    fontSize: 13,
    color: COLORS.violation,
  },
  pressed: {
    opacity: 0.7,
  },
});
