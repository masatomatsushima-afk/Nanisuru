import type { ReactNode, RefObject } from 'react';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { DatePickerField } from '@/components/date-picker-field';
import { PreferenceDiscoverySection } from '@/components/home/preference-discovery-section';
import { TravelTimePickerField } from '@/components/home/travel-time-picker-field';
import { PrimaryButton, SelectChip } from '@/components/ui/premium-card';
import { AppErrorBanner } from '@/components/app-error-banner';
import { TravelBudgetIncludesSection } from '@/components/home/travel-budget-includes-section';
import {
  CURRENCY_OPTIONS,
  getCurrency,
  type CurrencyCode,
} from '@/constants/currency';
import { NS, getChipPalette } from '@/constants/nanisuru-ui';
import { MIN_TOUCH_TARGET } from '@/constants/mobile-layout';
import { Spacing } from '@/constants/theme';
import {
  normalizeBudgetInput,
  normalizePeopleCountInput,
  normalizeUserInput,
} from '@/lib/normalize-user-input';
import {
  TRIP_DURATION_QUICK_OPTIONS,
  applyQuickDurationOption,
  formatTravelDurationSummaryLabel,
  getSelectedDurationQuickOption,
  isValidIsoDate,
  resolveTripSchedule,
  syncScheduleOnCustomChange,
  syncScheduleOnDepartureChange,
  syncScheduleOnReturnChange,
  type TripDurationQuickOption,
} from '@/lib/trip-schedule';
import type { TravelPlanValidationErrors } from '@/lib/travel-plan-form-validation';
import type { TravelBudgetIncludeOption } from '@/lib/travel-budget-includes';
import { safeChipKey, safeKey, safeText } from '@/lib/safe-text';
import {
  COUNTRY_SUGGESTIONS,
  getArrivalPointSuggestions,
  getBaseAreaSuggestions,
} from '@/lib/destination-detail-input';
import {
  getTravelFormRestoreLevel,
  logTravelFormRestoreOnce,
  travelFormSectionAtLeast,
} from '@/lib/travel-form-restore';
import {
  getPurposePriorityLabel,
  MAX_SELECTED_PURPOSES,
} from '@/lib/selected-purposes';
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
  country: string;
  onCountryChange: (value: string) => void;
  city: string;
  onCityChange: (value: string) => void;
  baseArea: string;
  onBaseAreaChange: (value: string) => void;
  accommodation: string;
  onAccommodationChange: (value: string) => void;
  arrivalPoint: string;
  onArrivalPointChange: (value: string) => void;
  tripSchedule: TripScheduleEditorValue;
  onTripScheduleChange: (value: TripScheduleEditorValue) => void;
  travelTiming: TravelTimingSettings;
  onTravelTimingChange: (value: TravelTimingSettings) => void;
  budget: string;
  onBudgetChange: (value: string) => void;
  currency: CurrencyCode;
  onCurrencyChange: (code: CurrencyCode) => void;
  budgetIncludes: TravelBudgetIncludeOption[];
  onBudgetIncludesChange: (value: TravelBudgetIncludeOption[]) => void;
  people: string;
  onPeopleChange: (value: string) => void;
  companion: CompanionOption | null;
  onCompanionChange: (value: CompanionOption) => void;
  travelIntent: TravelIntentOption | '';
  onTravelIntentChange: (value: TravelIntentOption | '') => void;
  customPreferences: PlanCustomPreferences;
  onCustomPreferencesChange: (value: PlanCustomPreferences) => void;
  /** Ordered purpose chip ids (max 3). */
  selectedPurposeIds: readonly string[];
  onPurposeToggle: (option: (typeof TRAVEL_SHEET_PURPOSE_OPTIONS)[number]) => void;
  /** Shown briefly when user tries to pick a 4th purpose. */
  purposeMaxHint?: string | null;
  validationErrors: TravelPlanValidationErrors;
  showValidation: boolean;
  isLoading: boolean;
  error: string | null;
  onGenerate: () => void;
  validationMessages?: string[];
  onRetry?: () => void;
  sheetScrollRef?: RefObject<ScrollView | null>;
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

function SuggestionChips({
  suggestions,
  onSelect,
  prefix,
}: {
  suggestions: string[];
  onSelect: (value: string) => void;
  prefix: string;
}) {
  if (suggestions.length === 0) return null;
  return (
    <View style={styles.chipGrid}>
      {suggestions.map((label, index) => (
        <SelectChip
          key={safeChipKey(prefix, { id: label, label }, index)}
          label={safeText(label)}
          selected={false}
          onPress={() => onSelect(label)}
          colorIndex={index}
        />
      ))}
    </View>
  );
}

export function TravelPlanSheetForm({
  country,
  onCountryChange,
  city,
  onCityChange,
  baseArea,
  onBaseAreaChange,
  accommodation,
  onAccommodationChange,
  arrivalPoint,
  onArrivalPointChange,
  tripSchedule,
  onTripScheduleChange,
  travelTiming,
  onTravelTimingChange,
  budget,
  onBudgetChange,
  currency,
  onCurrencyChange,
  budgetIncludes,
  onBudgetIncludesChange,
  people,
  onPeopleChange,
  companion,
  onCompanionChange,
  selectedPurposeIds,
  onPurposeToggle,
  purposeMaxHint = null,
  validationErrors,
  showValidation,
  isLoading,
  error,
  onGenerate,
  validationMessages = [],
  onRetry,
  customPreferences,
  onCustomPreferencesChange,
  sheetScrollRef,
}: TravelPlanSheetFormProps) {
  const { symbol } = getCurrency(currency);
  const err = (key: keyof TravelPlanValidationErrors) =>
    showValidation ? validationErrors[key] : undefined;
  const resolvedSchedule = resolveTripSchedule(tripSchedule);
  const durationSummaryLabel = formatTravelDurationSummaryLabel(resolvedSchedule);
  const selectedDurationQuick = getSelectedDurationQuickOption(tripSchedule);
  const durationChipError = err('durationDuration') ?? err('returnDate');

  const applyScheduleChange = (next: TripScheduleEditorValue) => {
    onTripScheduleChange(next);
  };

  const isButtonDisabled = isLoading;
  const showValidationSummary = showValidation && !isLoading && validationMessages.length > 0;

  useEffect(() => {
    if (!showValidationSummary || !sheetScrollRef?.current) return;
    requestAnimationFrame(() => {
      sheetScrollRef.current?.scrollToEnd({ animated: true });
    });
  }, [showValidationSummary, sheetScrollRef, validationMessages.length]);

  const handleGeneratePress = () => {
    onGenerate();
  };

  const restoreLevel = getTravelFormRestoreLevel();
  const show = (section: Parameters<typeof travelFormSectionAtLeast>[1]) =>
    travelFormSectionAtLeast(restoreLevel, section);

  useEffect(() => {
    logTravelFormRestoreOnce();
  }, []);

  const baseAreaSuggestions = getBaseAreaSuggestions(city);
  const arrivalSuggestions = getArrivalPointSuggestions(city);

  return (
    <View style={styles.wrap}>
      {show('destination') ? (
      <View style={styles.destinationSection}>
        <Text style={styles.sectionTitle}>目的地の詳細</Text>
        <Text style={styles.sectionHint}>国・都市・拠点を分けて入力すると、より具体的なプランになります</Text>

        <SheetField label="国・地域" optional error={err('destination')}>
          <TextInput
            style={[styles.input, err('destination') && styles.inputError]}
            value={country}
            onChangeText={onCountryChange}
            onEndEditing={() => onCountryChange(normalizeUserInput(country))}
            placeholder="例）日本 / 韓国 / フランス / オーストラリア"
            placeholderTextColor={NS.colors.textMuted}
            autoCapitalize="none"
          />
          <SuggestionChips
            prefix="country"
            suggestions={[...COUNTRY_SUGGESTIONS]}
            onSelect={onCountryChange}
          />
        </SheetField>

        <SheetField label="都市" optional error={err('destination')}>
          <TextInput
            style={[styles.input, err('destination') && styles.inputError]}
            value={city}
            onChangeText={onCityChange}
            onEndEditing={() => onCityChange(normalizeUserInput(city))}
            placeholder="例）大阪 / ソウル / Paris / Melbourne"
            placeholderTextColor={NS.colors.textMuted}
            autoCapitalize="none"
          />
        </SheetField>

        <SheetField label="拠点エリア" optional>
          <TextInput
            style={styles.input}
            value={baseArea}
            onChangeText={onBaseAreaChange}
            onEndEditing={() => onBaseAreaChange(normalizeUserInput(baseArea))}
            placeholder="例）難波 / 明洞 / 博多 — 自由入力OK"
            placeholderTextColor={NS.colors.textMuted}
            autoCapitalize="none"
          />
          <SuggestionChips
            prefix="baseArea"
            suggestions={baseAreaSuggestions}
            onSelect={onBaseAreaChange}
          />
        </SheetField>

        <SheetField label="宿泊先・ホテル" optional>
          <TextInput
            style={styles.input}
            value={accommodation}
            onChangeText={onAccommodationChange}
            onEndEditing={() => onAccommodationChange(normalizeUserInput(accommodation))}
            placeholder="例）明洞駅近く / 難波駅近く / ホテル名"
            placeholderTextColor={NS.colors.textMuted}
            autoCapitalize="none"
          />
        </SheetField>

        <SheetField label="到着場所" optional>
          <TextInput
            style={styles.input}
            value={arrivalPoint}
            onChangeText={onArrivalPointChange}
            onEndEditing={() => onArrivalPointChange(normalizeUserInput(arrivalPoint))}
            placeholder="例）仁川空港 / 関西空港 / 新大阪駅"
            placeholderTextColor={NS.colors.textMuted}
            autoCapitalize="none"
          />
          <SuggestionChips
            prefix="arrival"
            suggestions={arrivalSuggestions}
            onSelect={onArrivalPointChange}
          />
        </SheetField>
      </View>
      ) : null}

      {show('dates') ? (
      <View style={styles.scheduleSection}>
        <DatePickerField
          label="出発日"
          isoDate={tripSchedule.departureDate}
          onChange={(departureDate) => {
            applyScheduleChange(syncScheduleOnDepartureChange(tripSchedule, departureDate));
          }}
        />
        <FieldError message={err('departureDate')} />

        <DatePickerField
          label="帰宅日"
          isoDate={tripSchedule.returnDate}
          minimumIsoDate={tripSchedule.departureDate}
          onChange={(returnDate) => {
            applyScheduleChange(syncScheduleOnReturnChange(tripSchedule, returnDate));
          }}
        />
        <FieldError message={err('returnDate')} />

        <SheetField label="旅行期間">
          <View style={styles.durationSummaryBox}>
            <Text style={styles.durationSummaryValue}>{durationSummaryLabel}</Text>
            {!isValidIsoDate(tripSchedule.departureDate) && selectedDurationQuick ? (
              <Text style={styles.durationHint}>出発日を選ぶと帰宅日が自動で設定されます</Text>
            ) : null}
          </View>
        </SheetField>

        <SheetField label="期間">
          <View style={styles.chipGrid}>
            {TRIP_DURATION_QUICK_OPTIONS.map((option, index) => (
              <SelectChip
                key={safeChipKey('duration', { id: option, label: option }, index)}
                label={safeText(option)}
                selected={selectedDurationQuick === option}
                onPress={() =>
                  applyScheduleChange(
                    applyQuickDurationOption(tripSchedule, option as TripDurationQuickOption),
                  )
                }
                colorIndex={index}
              />
            ))}
          </View>
          <FieldError message={durationChipError} />
        </SheetField>

        {tripSchedule.durationPreset === 'その他' && selectedDurationQuick === 'その他' ? (
          <View style={styles.customDurationRow}>
            <View style={styles.customDurationField}>
              <Text style={styles.customDurationLabel}>泊数</Text>
              <TextInput
                style={styles.input}
                value={tripSchedule.customNights}
                onChangeText={(text) => {
                  applyScheduleChange(
                    syncScheduleOnCustomChange(
                      tripSchedule,
                      text.replace(/\D/g, ''),
                      tripSchedule.customDays,
                    ),
                  );
                }}
                placeholder="例）5"
                placeholderTextColor={NS.colors.textMuted}
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.customDurationField}>
              <Text style={styles.customDurationLabel}>日数</Text>
              <TextInput
                style={styles.input}
                value={tripSchedule.customDays}
                onChangeText={(text) => {
                  applyScheduleChange(
                    syncScheduleOnCustomChange(
                      tripSchedule,
                      tripSchedule.customNights,
                      text.replace(/\D/g, ''),
                    ),
                  );
                }}
                placeholder="例）6"
                placeholderTextColor={NS.colors.textMuted}
                keyboardType="number-pad"
              />
            </View>
          </View>
        ) : null}
      </View>
      ) : null}

      {show('time') ? (
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
      ) : null}

      {show('budget') ? (
      <>
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
          {CURRENCY_OPTIONS.map((option, index) => {
            const selected = currency === option.code;
            return (
              <Pressable
                key={safeChipKey('currency', { id: option.code, label: option.code }, index)}
                style={[styles.currencyChip, selected && styles.currencyChipSelected]}
                onPress={() => onCurrencyChange(option.code)}>
                <Text style={[styles.currencyCode, selected && styles.currencyCodeSelected]}>
                  {safeText(option.code)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </SheetField>
      </>
      ) : null}

      {show('budgetIncludes') ? (
      <TravelBudgetIncludesSection
        value={budgetIncludes}
        onChange={onBudgetIncludesChange}
      />
      ) : null}

      {show('people') ? (
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
      ) : null}

      {show('companion') ? (
      <SheetField label="誰と行く？" error={err('companionType')}>
        <View style={styles.chipGrid}>
          {COMPANION_OPTIONS.map((option, index) => (
            <SelectChip
              key={safeChipKey('companion', { id: option, label: option }, index)}
              label={safeText(option)}
              selected={companion === option}
              onPress={() => onCompanionChange(option)}
              colorIndex={index}
            />
          ))}
        </View>
      </SheetField>
      ) : null}

      {show('purpose') ? (
      <SheetField label="旅行の目的" optional>
        <Text style={styles.purposeHint}>最大{MAX_SELECTED_PURPOSES}つまで。最初に選んだ目的を一番重視します</Text>
        <View style={styles.chipGrid}>
          {TRAVEL_SHEET_PURPOSE_OPTIONS.map((option, index) => {
            const selectedIndex = selectedPurposeIds.indexOf(option.id);
            const selected = selectedIndex >= 0;
            const priority = selected ? ((selectedIndex + 1) as 1 | 2 | 3) : null;
            const palette = getChipPalette(index);
            return (
              <Pressable
                key={safeChipKey('purpose', option, index)}
                style={({ pressed }) => [
                  styles.purposeChip,
                  selected && {
                    backgroundColor: palette.bg,
                    borderColor: palette.border,
                    borderWidth: 2.5,
                  },
                  pressed && styles.purposeChipPressed,
                ]}
                onPress={() => onPurposeToggle(option)}
                accessibilityRole="button"
                accessibilityState={{ selected }}>
                {priority != null ? (
                  <Text style={[styles.purposePriority, selected && { color: palette.text }]}>
                    {safeText(getPurposePriorityLabel(priority))}
                  </Text>
                ) : null}
                <Text
                  style={[
                    styles.purposeChipLabel,
                    selected && { color: palette.text, fontWeight: '800' },
                  ]}>
                  {safeText(option.label)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {purposeMaxHint ? <Text style={styles.purposeMaxHint}>{safeText(purposeMaxHint)}</Text> : null}
      </SheetField>
      ) : null}

      {show('purpose') ? (
        <PreferenceDiscoverySection selectedPurposeIds={selectedPurposeIds} />
      ) : null}

      {show('custom') ? (
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
      ) : null}

      {showValidationSummary ? (
        <View style={styles.validationSummary}>
          <Text style={styles.validationSummaryTitle}>未入力の項目があります</Text>
          {validationMessages.map((message, index) => (
            <Text
              key={safeKey(message, `validation-${index}`)}
              style={styles.validationSummaryItem}>
              {`・${safeText(message)}`}
            </Text>
          ))}
        </View>
      ) : null}

      {show('generate') ? (
      <View style={styles.generateWrap}>
        <PrimaryButton
          label={isLoading ? 'プランを作成中…' : 'プランを生成'}
          onPress={handleGeneratePress}
          disabled={isButtonDisabled}
        />
      </View>
      ) : null}

      {error ? <AppErrorBanner message={safeText(error)} onRetry={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: NS.layout.sectionGap,
    width: '100%',
    maxWidth: '100%',
  },
  destinationSection: {
    gap: Spacing.three,
  },
  sectionTitle: {
    color: NS.colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  sectionHint: {
    color: NS.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: -Spacing.one,
  },
  scheduleSection: {
    gap: Spacing.two,
  },
  durationSummaryBox: {
    backgroundColor: NS.colors.bgCard,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.border,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    gap: Spacing.one,
  },
  durationSummaryValue: {
    color: NS.colors.orange,
    fontSize: 16,
    fontWeight: '700',
  },
  durationHint: {
    color: NS.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  customDurationRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  customDurationField: {
    flex: 1,
    gap: Spacing.one,
  },
  customDurationLabel: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
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
    minHeight: MIN_TOUCH_TARGET,
  },
  inputMultiline: {
    minHeight: 88,
    paddingTop: 14,
  },
  inputError: {
    borderColor: NS.colors.danger,
    borderWidth: 1.5,
  },
  fieldError: {
    color: NS.colors.danger,
    fontSize: 12,
    fontWeight: '600',
    marginTop: Spacing.one,
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
    width: '100%',
    maxWidth: '100%',
  },
  halfField: {
    flex: 1,
    minWidth: 0,
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
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
  },
  currencyChipSelected: {
    borderColor: NS.colors.coral,
    borderWidth: 2,
    backgroundColor: NS.colors.coralSoft,
    ...NS.shadow.card,
    shadowOpacity: 0.1,
  },
  currencyCode: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  currencyCodeSelected: {
    color: NS.colors.coral,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: NS.layout.chipGap,
  },
  purposeHint: {
    color: NS.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: Spacing.one,
  },
  purposeChip: {
    width: '48%',
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.border,
    backgroundColor: NS.colors.bgElevated,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    justifyContent: 'center',
    gap: 2,
  },
  purposeChipPressed: {
    opacity: 0.88,
  },
  purposePriority: {
    color: NS.colors.accent,
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 14,
  },
  purposeChipLabel: {
    color: NS.colors.text,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  purposeMaxHint: {
    color: NS.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: Spacing.one,
  },
  generateWrap: {
    marginTop: Spacing.two,
    marginBottom: Spacing.four,
    paddingBottom: Spacing.two,
  },
  validationSummary: {
    gap: Spacing.one + 2,
    backgroundColor: NS.colors.dangerSoft,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    padding: Spacing.three,
  },
  validationSummaryTitle: {
    color: NS.colors.danger,
    fontSize: 13,
    fontWeight: '800',
  },
  validationSummaryItem: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
  },
});
