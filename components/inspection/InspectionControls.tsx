import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useMemo, useState } from 'react';

import {
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

type ChoiceProps = {
  selected: boolean;
  title: string;
  description?: string;
  code?: string;
  onPress: () => void;
};

export function InspectionChoice({
  selected,
  title,
  description,
  code,
  onPress,
}: ChoiceProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        selected && styles.choiceSelected,
        pressed && styles.pressed,
      ]}
    >
      {code ? (
        <View style={styles.codeBadge}>
          <Text style={styles.codeText}>
            {code}
          </Text>
        </View>
      ) : (
        <Ionicons
          name={
            selected
              ? 'radio-button-on'
              : 'radio-button-off'
          }
          size={21}
          color={
            selected
              ? COLORS.primary
              : COLORS.textMuted
          }
        />
      )}

      <View style={styles.choiceContent}>
        <Text style={styles.choiceTitle}>
          {title}
        </Text>

        {description && (
          <Text style={styles.choiceDescription}>
            {description}
          </Text>
        )}
      </View>

      {code && (
        <Ionicons
          name={
            selected
              ? 'radio-button-on'
              : 'radio-button-off'
          }
          size={21}
          color={
            selected
              ? COLORS.primary
              : COLORS.textMuted
          }
        />
      )}
    </Pressable>
  );
}

type YesNoProps = {
  value: boolean | undefined;
  onChange: (value: boolean) => void;
  error?: string;
};

export function YesNoField({
  value,
  onChange,
  error,
}: YesNoProps) {
  return (
    <View>
      <View style={styles.row}>
        <Pressable
          onPress={() => onChange(true)}
          style={({ pressed }) => [
            styles.yesNo,
            value === true &&
              styles.choiceSelected,
            error && styles.errorBorder,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name={
              value === true
                ? 'checkmark-circle'
                : 'ellipse-outline'
            }
            size={20}
            color={
              value === true
                ? COLORS.primary
                : COLORS.textMuted
            }
          />

          <Text style={styles.yesNoText}>
            Yes
          </Text>
        </Pressable>

        <Pressable
          onPress={() => onChange(false)}
          style={({ pressed }) => [
            styles.yesNo,
            value === false &&
              styles.choiceSelected,
            error && styles.errorBorder,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name={
              value === false
                ? 'checkmark-circle'
                : 'ellipse-outline'
            }
            size={20}
            color={
              value === false
                ? COLORS.primary
                : COLORS.textMuted
            }
          />

          <Text style={styles.yesNoText}>
            No
          </Text>
        </Pressable>
      </View>

      {error && (
        <FieldError text={error} />
      )}
    </View>
  );
}

type BinaryProps = {
  value: 1 | 0 | undefined;
  yesLabel: string;
  noLabel: string;
  onChange: (value: 1 | 0) => void;
  error?: string;
};

export function BinaryField({
  value,
  yesLabel,
  noLabel,
  onChange,
  error,
}: BinaryProps) {
  return (
    <View style={styles.stack}>
      <InspectionChoice
        selected={value === 1}
        code="1"
        title={yesLabel}
        onPress={() => onChange(1)}
      />

      <InspectionChoice
        selected={value === 0}
        code="0"
        title={noLabel}
        onPress={() => onChange(0)}
      />

      {error && (
        <FieldError text={error} />
      )}
    </View>
  );
}

type DateFieldProps = {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  error?: string;
};

export function InspectionDateField({
  label,
  value,
  onChange,
  error,
}: DateFieldProps) {
  const [showPicker, setShowPicker] = useState(false);
  const selectedDate = useMemo(() => {
    const parsed = value ? new Date(value) : new Date();
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }, [value]);
  const formattedDate = value
    ? selectedDate.toLocaleDateString('en-PH', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  const handleDateChange = (
    event: DateTimePickerEvent,
    nextDate?: Date
  ) => {
    setShowPicker(false);

    if (event.type !== 'set' || !nextDate) {
      return;
    }

    const normalized = new Date(nextDate);
    normalized.setHours(12, 0, 0, 0);
    onChange(normalized.toISOString());
  };

  return (
    <View style={styles.dateContainer}>
      <Text style={styles.label}>
        {label}
      </Text>

      <Text style={styles.dateHint}>
        Choose the testing date from the calendar.
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}. ${formattedDate ?? 'No date selected'}`}
        onPress={() => setShowPicker(true)}
        style={({ pressed }) => [
          styles.dateButton,
          error && styles.errorBorder,
          pressed && styles.pressed,
        ]}
      >
        <Ionicons name="calendar-outline" size={20} color={COLORS.primary} />
        <Text style={formattedDate ? styles.dateValue : styles.datePlaceholder}>
          {formattedDate ?? 'Select testing date'}
        </Text>
        <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
      </Pressable>

      {showPicker ? (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          maximumDate={new Date()}
          onChange={handleDateChange}
        />
      ) : null}

      {formattedDate && (
          <View style={styles.validDate}>
            <Ionicons
              name="checkmark-circle"
              size={17}
              color={COLORS.compliant}
            />

            <Text
              style={
                styles.validDateText
              }
            >
              {formattedDate}
            </Text>
          </View>
        )}

      {error && (
        <FieldError text={error} />
      )}
    </View>
  );
}

export function FieldError({
  text,
}: {
  text: string;
}) {
  return (
    <View style={styles.errorRow}>
      <Ionicons
        name="alert-circle"
        size={15}
        color={COLORS.violation}
      />

      <Text style={styles.errorText}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: SPACING.sm,
  },

  row: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },

  choice: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
  },

  choiceSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primarySoft,
  },

  choiceContent: {
    flex: 1,
  },

  choiceTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },

  choiceDescription: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 16,
    color: COLORS.textSecondary,
  },

  codeBadge: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: COLORS.primarySoft,
  },

  codeText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
  },

  yesNo: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
  },

  yesNoText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },

  label: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },

  errorBorder: {
    borderColor: COLORS.violation,
  },

  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    marginTop: 6,
  },

  errorText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    color: COLORS.violation,
  },

  dateContainer: {
    gap: 8,
  },

  dateHint: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },

  dateButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
  },

  dateValue: { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.text },
  datePlaceholder: { flex: 1, fontSize: 14, color: COLORS.textMuted },

  validDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },

  validDateText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.compliant,
  },

  pressed: {
    opacity: 0.65,
  },
});
