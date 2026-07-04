import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { DatePickerField } from '@/components/date-picker-field';
import { TravelTimePickerField } from '@/components/home/travel-time-picker-field';
import { PrimaryButton, SelectChip } from '@/components/ui/premium-card';
import { AppErrorBanner } from '@/components/app-error-banner';
import {
  CURRENCY_OPTIONS,
  getCurrency,
  type CurrencyCode,
} from '@/constants/currency';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import {
  normalizeBudgetInput,
  normalizePeopleCountInput,
  normalizeUserInput,
} from '@/lib/normalize-user-input';
import type { TravelPlanValidationErrors } from '@/lib/travel-plan-form-validation';
import type { CompanionOption } from '@/types/plan';
import type { PlanCustomPreferences } from '@/types/plan-preferences';
import type { TravelIntentOption } from '@/types/plan-creation';
import type { TravelTimingSettings } from '@/types/travel-timing';
import type { TripScheduleEditorValue } from '@/types/trip-schedule';

export const TRAVEL_SHEET_PURPOSE_OPTIONS = [
  { id: 'photo', label: '映え', travelIntent: '王道スポットを回りたい' as TravelIntentOption },
  { id: 'nature', label: '自然', travelIntent: '自然を楽しみたい' as TravelIntentOption },
  { id: 'food', label: 'グルメ', travelIntent: 'グルメを楽しみたい' as TravelIntentOption },
  { id: 'shopping', label: '買い物', travelIntent: '買い物したい' as TravelIntentOption },
  { id: 'night', label: '夜遊び', travelIntent: null, purposeCustom: '夜遊び' },
  { id: 'ai', label: 'AIに任せる', travelIntent: null, purposeCustom: 'AIに任せる' },
] as const;

const COMPANION_OPTIONS: CompanionOption[] = ['一人', '友達', 'カップル', '初デート', '家族'];

type TravelPlanSheetFormProps = {
  location: string;
  onLocationChange: (value: string) => void;
  tripSchedule: TripScheduleEditorValue;
  onDepartureDateChange: (isoDate: string) => void;
  onReturnDateChange: (isoDate: string) => void;
  travelTiming: TravelTimingSettings;
  onTravelTimingChange: (value: TravelTimingSettings) => void;
  budget: string;
  onBudgetChange: (value: string) => void;
  currency: CurrencyCode;
  onCurrencyChange: (code: CurrencyCode) => void;
  people: string;
  onPeopleChange: (value: string) => void;
  companion: CompanionOption | null;
  onCompanionChange: (value: CompanionOption) => void;
  travelIntent: TravelIntentOption | '';
  onTravelIntentChange: (value: TravelIntentOption | '') => void;
  customPreferences: PlanCustomPreferences;
  onCustomPreferencesChange: (value: PlanCustomPreferences) => void;
  selectedPurposeId: string | null;
  onPurposeSelect: (option: (typeof TRAVEL_SHEET_PURPOSE_OPTIONS)[number]) => void;
  validationErrors: TravelPlanValidationErrors;
  showValidation: boolean;
  isLoading: boolean;
  error: string | null;
  onGenerate: () => void;
  generateDisabled: boolean;
  devDisabledReason?: string | null;
  onRetry?: () => void;
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <Text style={styles.fieldError}>{message}</Text>;
}

function SheetField({
  label,
  optional,
  children,
  error,
}: {
  label: string;
  optional?: boolean;
  children: ReactNode;
  error?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {optional ? <Text style={styles.optional}>（任意）</Text> : null}
      </Text>
      {children}
      <FieldError message={error} />
    </View>
  );
}

export function TravelPlanSheetForm({
  location,
  onLocationChange,
  tripSchedule,
  onDepartureDateChange,
  onReturnDateChange,
  travelTiming,
  onTravelTimingChange,
  budget,
  onBudgetChange,
  currency,
  onCurrencyChange,
  people,
  onPeopleChange,
  companion,
  onCompanionChange,
  selectedPurposeId,
  onPurposeSelect,
  validationErrors,
  showValidation,
  isLoading,
  error,
  onGenerate,
  generateDisabled,
  devDisabledReason,
  onRetry,
  customPreferences,
  onCustomPreferencesChange,
}: TravelPlanSheetFormProps) {
  const { symbol } = getCurrency(currency);
  const err = (key: keyof TravelPlanValidationErrors) =>
    showValidation ? validationErrors[key] : undefined;

  const isButtonDisabled = generateDisabled || isLoading;

  useEffect(() => {
    if (!__DEV__) return;
    console.log('[GenerateButton] disabled state', {
      disabled: isButtonDisabled,
      isGeneratingPlan: isLoading,
      validationErrors,
      formState: {
        destination: location,
        departureDate: tripSchedule.departureDate,
        returnDate: tripSchedule.returnDate,
        budget,
        peopleCount: people,
        companionType: companion,
      },
      devDisabledReason,
    });
  }, [
    isButtonDisabled,
    isLoading,
    validationErrors,
    location,
    tripSchedule.departureDate,
    tripSchedule.returnDate,
    budget,
    people,
    companion,
    devDisabledReason,
  ]);

  const handleGeneratePress = () => {
    console.log('[GenerateButton] clicked');
    console.log('[GenerateButton] disabled state', {
      disabled: isButtonDisabled,
      isGeneratingPlan: isLoading,
      validationErrors,
      formState: {
        destination: location,
        departureDate: tripSchedule.departureDate,
        returnDate: tripSchedule.returnDate,
        budget,
        peopleCount: people,
        companionType: companion,
      },
    });
    onGenerate();
  };

  return (
    <View style={styles.wrap}>
      <SheetField label="行き先" error={err('destination')}>
        <TextInput
          style={[styles.input, err('destination') && styles.inputError]}
          value={location}
          onChangeText={onLocationChange}
          onEndEditing={() => onLocationChange(normalizeUserInput(location))}
          placeholder="例）大阪、韓国、ケアンズ、京都"
          placeholderTextColor={NS.colors.textMuted}
          autoCapitalize="none"
        />
      </SheetField>

      <DatePickerField
        label="出発日"
        isoDate={tripSchedule.departureDate}
        onChange={onDepartureDateChange}
      />
      <FieldError message={err('departureDate')} />

      <DatePickerField
        label="帰宅日"
        isoDate={tripSchedule.returnDate}
        minimumIsoDate={tripSchedule.departureDate}
        onChange={onReturnDateChange}
      />
      <FieldError message={err('returnDate')} />

      <View style={styles.row}>
        <View style={styles.halfField}>
          <TravelTimePickerField
            label="到着時間"
            optional
            value={travelTiming.arrivalTime}
            onChange={(arrivalTime) =>
              onTravelTimingChange({
                ...travelTiming,
                arrivalTime,
              })
            }
            error={err('arrivalTime')}
          />
        </View>
        <View style={styles.halfField}>
          <TravelTimePickerField
            label="帰り時間"
            optional
            value={travelTiming.departureTime}
            onChange={(departureTime) =>
              onTravelTimingChange({
                ...travelTiming,
                departureTime,
              })
            }
            error={err('departureTime')}
          />
        </View>
      </View>

      <SheetField label="予算" error={err('budget')}>
        <View style={styles.budgetRow}>
          <Text style={styles.budgetPrefix}>{symbol}</Text>
          <TextInput
            style={[styles.budgetInput, err('budget') && styles.inputError]}
            value={budget}
            onChangeText={onBudgetChange}
            onEndEditing={() => onBudgetChange(normalizeBudgetInput(budget))}
            placeholder="例）50000"
            placeholderTextColor={NS.colors.textMuted}
            keyboardType="number-pad"
          />
        </View>
      </SheetField>

      <SheetField label="通貨">
        <View style={styles.currencyRow}>
          {CURRENCY_OPTIONS.map((option) => {
            const selected = currency === option.code;
            return (
              <Pressable
                key={option.code}
                style={[styles.currencyChip, selected && styles.currencyChipSelected]}
                onPress={() => onCurrencyChange(option.code)}>
                <Text style={[styles.currencyCode, selected && styles.currencyCodeSelected]}>
                  {option.code}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </SheetField>

      <SheetField label="人数" error={err('peopleCount')}>
        <TextInput
          style={[styles.input, err('peopleCount') && styles.inputError]}
          value={people}
          onChangeText={onPeopleChange}
          onEndEditing={() => onPeopleChange(normalizePeopleCountInput(people))}
          placeholder="例）2"
          placeholderTextColor={NS.colors.textMuted}
          keyboardType="number-pad"
        />
      </SheetField>

      <SheetField label="誰と行く？" error={err('companionType')}>
        <View style={styles.chipGrid}>
          {COMPANION_OPTIONS.map((option, index) => (
            <SelectChip
              key={option}
              label={option}
              selected={companion === option}
              onPress={() => onCompanionChange(option)}
              colorIndex={index}
            />
          ))}
        </View>
      </SheetField>

      <SheetField label="旅行の目的" optional>
        <View style={styles.chipGrid}>
          {TRAVEL_SHEET_PURPOSE_OPTIONS.map((option, index) => (
            <SelectChip
              key={option.id}
              label={option.label}
              selected={selectedPurposeId === option.id}
              onPress={() => onPurposeSelect(option)}
              colorIndex={index}
            />
          ))}
        </View>
      </SheetField>

      <SheetField label="その他の希望" optional>
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          value={customPreferences.desiredPlaces ?? ''}
          onChangeText={(text) =>
            onCustomPreferencesChange({ ...customPreferences, desiredPlaces: text })
          }
          onEndEditing={() =>
            onCustomPreferencesChange({
              ...customPreferences,
              desiredPlaces: normalizeUserInput(customPreferences.desiredPlaces ?? ''),
            })
          }
          placeholder="例）ビーチに行きたい、食べ歩きしたい、移動少なめがいい"
          placeholderTextColor={NS.colors.textMuted}
          multiline
          textAlignVertical="top"
        />
      </SheetField>

      <View style={styles.generateWrap}>
        <PrimaryButton
          label="プランを生成"
          onPress={handleGeneratePress}
          disabled={isButtonDisabled}
        />
      </View>

      {__DEV__ && isButtonDisabled && devDisabledReason ? (
        <Text style={styles.devDisabledHint}>
          {`開発用:\n生成ボタンが無効です\n理由: ${devDisabledReason}`}
        </Text>
      ) : null}

      {generateDisabled && !showValidation ? (
        <Text style={styles.helperText}>必須項目を入力するとプランを生成できます</Text>
      ) : null}

      {error ? <AppErrorBanner message={error} onRetry={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.three,
    paddingBottom: 48,
  },
  field: {
    gap: Spacing.one + 2,
  },
  label: {
    color: NS.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  optional: {
    color: NS.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  input: {
    backgroundColor: NS.colors.bgCard,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.border,
    color: NS.colors.text,
    fontSize: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
  },
  inputMultiline: {
    minHeight: 88,
    paddingTop: 14,
  },
  inputError: {
    borderColor: '#EF4444',
  },
  fieldError: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
    marginTop: -2,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  halfField: {
    flex: 1,
  },
  budgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: NS.colors.bgCard,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.border,
    paddingHorizontal: Spacing.three,
  },
  budgetPrefix: {
    color: NS.colors.textSecondary,
    fontSize: 16,
    fontWeight: '700',
    marginRight: Spacing.one,
  },
  budgetInput: {
    flex: 1,
    color: NS.colors.text,
    fontSize: 16,
    paddingVertical: 14,
  },
  currencyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one + 2,
  },
  currencyChip: {
    borderRadius: NS.radius.sm,
    borderWidth: 1,
    borderColor: NS.colors.border,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.one + 3,
    backgroundColor: NS.colors.bgCard,
  },
  currencyChipSelected: {
    borderColor: NS.colors.orange,
    backgroundColor: NS.colors.orangeSoft,
  },
  currencyCode: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  currencyCodeSelected: {
    color: NS.colors.orange,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one + 2,
  },
  generateWrap: {
    marginTop: Spacing.two,
  },
  devDisabledHint: {
    color: '#B45309',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: NS.radius.md,
    padding: Spacing.two,
  },
  helperText: {
    color: NS.colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
});
