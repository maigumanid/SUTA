import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';

import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
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
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [year, setYear] = useState('');

  const [localError, setLocalError] =
    useState<string>();

  useEffect(() => {
    if (!value) {
      return;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return;
    }

    setMonth(
      String(date.getMonth() + 1).padStart(
        2,
        '0'
      )
    );

    setDay(
      String(date.getDate()).padStart(
        2,
        '0'
      )
    );

    setYear(
      String(date.getFullYear())
    );
  }, [value]);

  const validateAndSave = (
    newMonth: string,
    newDay: string,
    newYear: string
  ) => {
    if (
      !newMonth ||
      !newDay ||
      newYear.length !== 4
    ) {
      setLocalError(undefined);
      return;
    }

    const monthNumber =
      Number(newMonth);

    const dayNumber =
      Number(newDay);

    const yearNumber =
      Number(newYear);

    if (
      Number.isNaN(monthNumber) ||
      Number.isNaN(dayNumber) ||
      Number.isNaN(yearNumber)
    ) {
      setLocalError(
        'Enter a valid date.'
      );

      return;
    }

    if (
      monthNumber < 1 ||
      monthNumber > 12
    ) {
      setLocalError(
        'Month must be between 1 and 12.'
      );

      return;
    }

    if (
      dayNumber < 1 ||
      dayNumber > 31
    ) {
      setLocalError(
        'Enter a valid day.'
      );

      return;
    }

    const date = new Date(
      yearNumber,
      monthNumber - 1,
      dayNumber
    );

    const validDate =
      date.getFullYear() === yearNumber &&
      date.getMonth() ===
        monthNumber - 1 &&
      date.getDate() === dayNumber;

    if (!validDate) {
      setLocalError(
        'This date does not exist.'
      );

      return;
    }

    const today = new Date();

    today.setHours(23, 59, 59, 999);

    if (date > today) {
      setLocalError(
        'The testing date cannot be in the future.'
      );

      return;
    }

    setLocalError(undefined);

    onChange(date.toISOString());
  };

  const handleMonth = (
    text: string
  ) => {
    const cleaned = text
      .replace(/[^0-9]/g, '')
      .slice(0, 2);

    setMonth(cleaned);

    validateAndSave(
      cleaned,
      day,
      year
    );
  };

  const handleDay = (
    text: string
  ) => {
    const cleaned = text
      .replace(/[^0-9]/g, '')
      .slice(0, 2);

    setDay(cleaned);

    validateAndSave(
      month,
      cleaned,
      year
    );
  };

  const handleYear = (
    text: string
  ) => {
    const cleaned = text
      .replace(/[^0-9]/g, '')
      .slice(0, 4);

    setYear(cleaned);

    validateAndSave(
      month,
      day,
      cleaned
    );
  };

  const getFormattedDate = () => {
    if (
      !month ||
      !day ||
      year.length !== 4 ||
      localError
    ) {
      return null;
    }

    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day)
    );

    if (
      Number.isNaN(date.getTime())
    ) {
      return null;
    }

    return date.toLocaleDateString(
      'en-PH',
      {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }
    );
  };

  const formattedDate =
    getFormattedDate();

  return (
    <View style={styles.dateContainer}>
      <Text style={styles.label}>
        {label}
      </Text>

      <Text style={styles.dateHint}>
        Enter the testing date.
      </Text>

      <View style={styles.dateRow}>
        <View style={styles.datePart}>
          <Text
            style={styles.datePartLabel}
          >
            Month
          </Text>

          <TextInput
            value={month}
            onChangeText={handleMonth}
            placeholder="MM"
            placeholderTextColor={
              COLORS.textMuted
            }
            keyboardType="number-pad"
            maxLength={2}
            style={[
              styles.dateInput,
              (error || localError) &&
                styles.errorBorder,
            ]}
          />
        </View>

        <View style={styles.datePart}>
          <Text
            style={styles.datePartLabel}
          >
            Day
          </Text>

          <TextInput
            value={day}
            onChangeText={handleDay}
            placeholder="DD"
            placeholderTextColor={
              COLORS.textMuted
            }
            keyboardType="number-pad"
            maxLength={2}
            style={[
              styles.dateInput,
              (error || localError) &&
                styles.errorBorder,
            ]}
          />
        </View>

        <View
          style={[
            styles.datePart,
            styles.yearPart,
          ]}
        >
          <Text
            style={styles.datePartLabel}
          >
            Year
          </Text>

          <TextInput
            value={year}
            onChangeText={handleYear}
            placeholder="YYYY"
            placeholderTextColor={
              COLORS.textMuted
            }
            keyboardType="number-pad"
            maxLength={4}
            style={[
              styles.dateInput,
              (error || localError) &&
                styles.errorBorder,
            ]}
          />
        </View>
      </View>

      {formattedDate &&
        !localError && (
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

      {localError && (
        <FieldError
          text={localError}
        />
      )}

      {!localError && error && (
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

  dateRow: {
    flexDirection: 'row',
    gap: 8,
  },

  datePart: {
    flex: 1,
    gap: 5,
  },

  yearPart: {
    flex: 1.3,
  },

  datePartLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
  },

  dateInput: {
    height: 50,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },

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
