import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { createElement, useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import {
  TRIP_SCHEDULE_INVALID_DATE_FORMAT,
  TRIP_SCHEDULE_INVALID_DATES,
  isValidIsoDate,
  sanitizeDateInputText,
} from '@/lib/trip-schedule';
import { formatIsoDate, formatTripDateLabel } from '@/lib/weather';

type DatePickerFieldProps = {
  label: string;
  isoDate: string;
  onChange: (date: string) => void;
  minimumIsoDate?: string;
};

function isoToDate(iso: string): Date {
  return new Date(`${iso}T12:00:00`);
}

function WebDateInput({
  label,
  isoDate,
  onChange,
  minimumIsoDate,
}: DatePickerFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {createElement('input', {
        type: 'date',
        value: isoDate && isValidIsoDate(isoDate) ? isoDate : '',
        min: minimumIsoDate && isValidIsoDate(minimumIsoDate) ? minimumIsoDate : undefined,
        onChange: (event: { target: { value: string } }) => {
          const next = event.target.value;
          if (next && isValidIsoDate(next)) {
            onChange(next);
          }
        },
        style: {
          width: '100%',
          boxSizing: 'border-box',
          padding: '14px 16px',
          fontSize: 16,
          borderRadius: 10,
          border: `1px solid ${NS.colors.borderStrong}`,
          backgroundColor: NS.colors.bgInput,
          color: NS.colors.text,
          fontFamily: 'inherit',
          cursor: 'pointer',
        },
      })}
      {isoDate && isValidIsoDate(isoDate) ? (
        <Text style={styles.dateHint}>{formatTripDateLabel(isoDate)}</Text>
      ) : (
        <Text style={styles.dateHint}>カレンダーから日付を選択</Text>
      )}
    </View>
  );
}

function NativeDatePickerField({
  label,
  isoDate,
  onChange,
  minimumIsoDate,
}: DatePickerFieldProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [draft, setDraft] = useState(isoDate);
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(isoDate);
    setFieldError(null);
  }, [isoDate]);

  const pickerDate =
    isoDate && isValidIsoDate(isoDate) ? isoToDate(isoDate) : isoToDate(formatIsoDate(new Date()));

  const commitIso = (next: string) => {
    const trimmed = sanitizeDateInputText(next.trim());
    if (!trimmed) return;

    if (!isValidIsoDate(trimmed)) {
      setFieldError(TRIP_SCHEDULE_INVALID_DATE_FORMAT);
      return;
    }

    if (minimumIsoDate && trimmed < minimumIsoDate) {
      setFieldError(TRIP_SCHEDULE_INVALID_DATES);
      return;
    }

    setFieldError(null);
    if (trimmed !== isoDate) {
      onChange(trimmed);
    }
  };

  const handlePickerChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
    if (event.type === 'dismissed' || !selected) {
      if (Platform.OS === 'android') setShowPicker(false);
      return;
    }
    const next = formatIsoDate(selected);
    commitIso(next);
    setDraft(next);
  };

  const displayLabel =
    isoDate && isValidIsoDate(isoDate) ? formatTripDateLabel(isoDate) : '日付を選択';

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        style={({ pressed }) => [styles.pickerButton, pressed && styles.pickerButtonPressed]}
        onPress={() => setShowPicker(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}を選択`}>
        <Text style={styles.pickerButtonText}>{displayLabel}</Text>
        <Text style={styles.pickerButtonIcon}>📅</Text>
      </Pressable>

      <TextInput
        style={[styles.input, fieldError ? styles.inputInvalid : null]}
        value={draft}
        onChangeText={(text) => {
          const next = sanitizeDateInputText(text);
          setDraft(next);
          setFieldError(null);
          if (isValidIsoDate(next)) {
            if (minimumIsoDate && next < minimumIsoDate) {
              setFieldError(TRIP_SCHEDULE_INVALID_DATES);
              return;
            }
            if (next !== isoDate) onChange(next);
          }
        }}
        onBlur={() => commitIso(draft)}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={NS.colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="numbers-and-punctuation"
      />

      {fieldError ? <Text style={styles.fieldError}>{fieldError}</Text> : null}

      {Platform.OS === 'ios' ? (
        <Modal visible={showPicker} transparent animationType="slide">
          <Pressable style={styles.modalBackdrop} onPress={() => setShowPicker(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setShowPicker(false)}>
                <Text style={styles.modalDone}>完了</Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={pickerDate}
              mode="date"
              display="spinner"
              locale="ja-JP"
              minimumDate={
                minimumIsoDate && isValidIsoDate(minimumIsoDate)
                  ? isoToDate(minimumIsoDate)
                  : undefined
              }
              onChange={handlePickerChange}
              themeVariant="light"
            />
          </View>
        </Modal>
      ) : showPicker ? (
        <DateTimePicker
          value={pickerDate}
          mode="date"
          display="default"
          minimumDate={
            minimumIsoDate && isValidIsoDate(minimumIsoDate)
              ? isoToDate(minimumIsoDate)
              : undefined
          }
          onChange={handlePickerChange}
        />
      ) : null}
    </View>
  );
}

export function DatePickerField(props: DatePickerFieldProps) {
  if (Platform.OS === 'web') {
    return <WebDateInput {...props} />;
  }
  return <NativeDatePickerField {...props} />;
}

const theme = NS.colors;

const styles = StyleSheet.create({
  field: {
    gap: Spacing.one,
  },
  label: {
    color: theme.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.bgElevated,
    borderColor: theme.accentBorder,
    borderWidth: 1,
    borderRadius: NS.radius.sm + 2,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
  },
  pickerButtonPressed: {
    opacity: 0.88,
  },
  pickerButtonText: {
    color: theme.text,
    fontSize: 16,
    fontWeight: '600',
  },
  pickerButtonIcon: {
    fontSize: 18,
  },
  input: {
    backgroundColor: theme.bgInput,
    borderColor: theme.borderStrong,
    borderWidth: 1,
    borderRadius: NS.radius.sm + 2,
    color: theme.text,
    fontSize: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
  },
  inputInvalid: {
    borderColor: theme.danger,
  },
  dateHint: {
    color: theme.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  fieldError: {
    color: theme.danger,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalSheet: {
    backgroundColor: theme.bgCard,
    borderTopLeftRadius: NS.radius.lg,
    borderTopRightRadius: NS.radius.lg,
    paddingBottom: Spacing.five,
  },
  modalHeader: {
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  modalDone: {
    color: theme.accent,
    fontSize: 16,
    fontWeight: '700',
  },
});
