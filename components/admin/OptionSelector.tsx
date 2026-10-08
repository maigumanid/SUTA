import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';

export type SelectorOption = { value: string; label: string };

export default function OptionSelector({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select an option',
  loading = false,
  errorMessage,
  emptyMessage = 'No options are available.',
  onRetry,
}: {
  label: string;
  value: string;
  options: SelectorOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  loading?: boolean;
  errorMessage?: string | null;
  emptyMessage?: string;
  onRetry?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find((option) => option.value === value);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle
      ? options.filter((option) => option.label.toLowerCase().includes(needle))
      : options;
  }, [options, query]);

  return (
    <>
      <View style={styles.field}>
        <Text style={styles.label}>{label}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: loading || Boolean(errorMessage) || options.length === 0 }}
          disabled={loading || Boolean(errorMessage) || options.length === 0}
          onPress={() => setOpen(true)}
          style={({ pressed }) => [
            styles.control,
            (loading || errorMessage || options.length === 0) && styles.controlDisabled,
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[selected ? styles.value : styles.placeholder, styles.controlText]}
          >
            {loading ? 'Loading options...' : selected?.label ?? placeholder}
          </Text>
          {loading ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <Ionicons name="chevron-down" size={20} color={COLORS.textSecondary} />
          )}
        </Pressable>
        {errorMessage ? (
          <View style={styles.messageRow}>
            <Text style={styles.errorText}>{errorMessage}</Text>
            {onRetry ? (
              <Pressable accessibilityRole="button" onPress={onRetry}>
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
            ) : null}
          </View>
        ) : !loading && options.length === 0 ? (
          <Text style={styles.emptyText}>{emptyMessage}</Text>
        ) : null}
      </View>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>{label}</Text>
            <Pressable accessibilityRole="button" onPress={() => setOpen(false)}>
              <Ionicons name="close" size={28} color={COLORS.text} />
            </Pressable>
          </View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search"
            placeholderTextColor={COLORS.textMuted}
            style={styles.search}
          />
          <ScrollView showsVerticalScrollIndicator={false}>
            {visible.length === 0 ? (
              <View style={styles.modalEmpty}>
                <Ionicons name="search-outline" size={26} color={COLORS.textMuted} />
                <Text style={styles.emptyText}>No option matches that search.</Text>
              </View>
            ) : visible.map((option) => (
              <Pressable
                key={option.value}
                style={styles.option}
                onPress={() => {
                  onChange(option.value);
                  setQuery('');
                  setOpen(false);
                }}
              >
                <Text style={styles.optionText}>{option.label}</Text>
                {option.value === value ? (
                  <Ionicons name="checkmark" size={22} color={COLORS.primary} />
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: { gap: SPACING.xs },
  label: { ...TYPOGRAPHY.label, color: COLORS.textSecondary },
  control: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.lg, backgroundColor: COLORS.surface },
  controlDisabled: { opacity: 0.72, backgroundColor: COLORS.surfaceMuted },
  controlText: { flex: 1, marginRight: SPACING.sm },
  value: { ...TYPOGRAPHY.body, color: COLORS.text },
  placeholder: { ...TYPOGRAPHY.body, color: COLORS.textMuted },
  modal: { flex: 1, padding: SPACING.lg, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
  title: { ...TYPOGRAPHY.heading, color: COLORS.text },
  search: { ...TYPOGRAPHY.body, minHeight: 48, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.lg, color: COLORS.text, backgroundColor: COLORS.surface, marginBottom: SPACING.md },
  option: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: COLORS.divider },
  optionText: { ...TYPOGRAPHY.body, color: COLORS.text },
  messageRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: SPACING.sm },
  errorText: { ...TYPOGRAPHY.caption, flex: 1, color: COLORS.violation },
  retryText: { ...TYPOGRAPHY.caption, fontWeight: '700', color: COLORS.primary },
  emptyText: { ...TYPOGRAPHY.caption, color: COLORS.textMuted },
  modalEmpty: { alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.xxxl },
  pressed: { opacity: 0.76 },
});
