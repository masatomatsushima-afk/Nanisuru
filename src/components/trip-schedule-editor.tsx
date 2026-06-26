import { StyleSheet, Text, TextInput, View } from 'react-native';

import { DatePickerField } from '@/components/date-picker-field';
import { SelectChip } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { getDurationDisplayLabel } from '@/lib/trip-duration';
import {
  TRIP_DATE_QUICK_OPTIONS,
  TRIP_DURATION_QUICK_OPTIONS,
  applyQuickDateOption,
  applyQuickDurationOption,
  formatTripDateRangeLabel,
  isValidIsoDate,
  resolveTripSchedule,
  syncScheduleOnCustomChange,
  syncScheduleOnDepartureChange,
  syncScheduleOnReturnChange,
  type TripDurationQuickOption,
} from '@/lib/trip-schedule';
import type { TripScheduleEditorValue } from '@/types/trip-schedule';

type TripScheduleEditorProps = {
  value: TripScheduleEditorValue;
  onChange: (value: TripScheduleEditorValue) => void;
  error?: string | null;
  onResetPlan?: () => void;
  compact?: boolean;
};

const COMPACT_DURATION_OPTIONS = ['日帰り'] as const;
const FULL_DURATION_OPTIONS = TRIP_DURATION_QUICK_OPTIONS;

export function TripScheduleEditor({
  value,
  onChange,
  error,
  onResetPlan,
  compact = false,
}: TripScheduleEditorProps) {
  const resolved = resolveTripSchedule(value);
  const dateRangeLabel = formatTripDateRangeLabel(value.departureDate, value.returnDate);
  const durationLabel = resolved.durationLabel;
  const durationOptions = compact ? COMPACT_DURATION_OPTIONS : FULL_DURATION_OPTIONS;

  const applyChange = (next: TripScheduleEditorValue) => {
    onChange(next);
    onResetPlan?.();
  };

  const selectedDurationQuick = durationOptions.find((option) => {
    if (option === '日帰り') {
      return value.durationPreset === '1日' || value.durationPreset === '半日';
    }
    if (option === '5泊6日') {
      return (
        value.durationPreset === 'その他' &&
        value.customNights === '5' &&
        value.customDays === '6'
      );
    }
    if (option === 'その他') {
      return (
        value.durationPreset === 'その他' &&
        !(value.customNights === '5' && value.customDays === '6')
      );
    }
    return value.durationPreset === option;
  });

  return (
    <View style={styles.wrap}>
      <DatePickerField
        label="出発日"
        isoDate={value.departureDate}
        onChange={(departureDate) => {
          applyChange(syncScheduleOnDepartureChange(value, departureDate));
        }}
      />

      <DatePickerField
        label="帰宅日 / 最終日"
        isoDate={value.returnDate}
        minimumIsoDate={value.departureDate}
        onChange={(returnDate) => {
          applyChange(syncScheduleOnReturnChange(value, returnDate));
        }}
      />

      {dateRangeLabel && isValidIsoDate(value.departureDate) && isValidIsoDate(value.returnDate) ? (
        <View style={styles.summaryBox}>
          <Text style={styles.summaryDates}>{dateRangeLabel}</Text>
          <Text style={styles.summaryDuration}>{durationLabel}</Text>
        </View>
      ) : null}

      <View style={styles.field}>
        <Text style={styles.label}>日付ショートカット</Text>
        <View style={styles.chipGrid}>
          {TRIP_DATE_QUICK_OPTIONS.map((option) => (
            <SelectChip
              key={option}
              label={option}
              selected={false}
              onPress={() => applyChange(applyQuickDateOption(value, option))}
            />
          ))}
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>期間</Text>
        <View style={styles.chipGrid}>
          {durationOptions.map((option) => (
            <SelectChip
              key={option}
              label={option}
              selected={selectedDurationQuick === option}
              onPress={() =>
                applyChange(applyQuickDurationOption(value, option as TripDurationQuickOption))
              }
            />
          ))}
        </View>
      </View>

      {!compact && value.durationPreset === 'その他' ? (
        <View style={styles.customRow}>
          <View style={styles.customField}>
            <Text style={styles.customLabel}>泊数</Text>
            <TextInput
              style={styles.customInput}
              value={value.customNights}
              onChangeText={(text) => {
                applyChange(syncScheduleOnCustomChange(value, text.replace(/\D/g, ''), value.customDays));
              }}
              placeholder="例）5"
              placeholderTextColor={NS.colors.textMuted}
              keyboardType="number-pad"
            />
          </View>
          <View style={styles.customField}>
            <Text style={styles.customLabel}>日数</Text>
            <TextInput
              style={styles.customInput}
              value={value.customDays}
              onChangeText={(text) => {
                applyChange(syncScheduleOnCustomChange(value, value.customNights, text.replace(/\D/g, '')));
              }}
              placeholder="例）6"
              placeholderTextColor={NS.colors.textMuted}
              keyboardType="number-pad"
            />
          </View>
          <View style={styles.customPreview}>
            <Text style={styles.customPreviewLabel}>旅行期間</Text>
            <Text style={styles.customPreviewValue}>
              {getDurationDisplayLabel('その他', resolved.customDuration) || '—'}
            </Text>
          </View>
        </View>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const theme = NS.colors;

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.two,
  },
  field: {
    gap: Spacing.one,
  },
  label: {
    color: theme.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  summaryBox: {
    backgroundColor: theme.bgElevated,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: NS.radius.sm + 2,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: 4,
  },
  summaryDates: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '600',
  },
  summaryDuration: {
    color: theme.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  customRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    alignItems: 'flex-end',
  },
  customField: {
    flex: 1,
    minWidth: 100,
    gap: Spacing.one,
  },
  customLabel: {
    color: theme.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  customInput: {
    backgroundColor: theme.bgInput,
    borderColor: theme.borderStrong,
    borderWidth: 1,
    borderRadius: NS.radius.sm + 2,
    color: theme.text,
    fontSize: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    textAlign: 'center',
  },
  customPreview: {
    flex: 1,
    minWidth: 120,
    gap: 4,
  },
  customPreviewLabel: {
    color: theme.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  customPreviewValue: {
    color: theme.accent,
    fontSize: 15,
    fontWeight: '700',
  },
  errorText: {
    color: theme.danger,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
  },
});
