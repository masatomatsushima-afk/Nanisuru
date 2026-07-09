import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { TripScheduleEditor } from '@/components/trip-schedule-editor';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset, Spacing } from '@/constants/theme';
import {
  CURRENCY_OPTIONS,
  getBudgetPlaceholder,
  getCurrency,
  type CurrencyCode,
} from '@/constants/currency';
import { AppErrorBanner } from '@/components/app-error-banner';
import { APP_MESSAGES, getPlanGenerationErrorMessage, isSupabaseError, formatPlanGenerationDevError, extractPlanGenerationErrorDetail, classifyError, OpenAiRequestError } from '@/lib/app-errors';
import { linkPlanRatingToTrip } from '@/lib/plan-rating';
import { formatCombinedMood } from '@/lib/custom-preferences';
import {
  applyPlanTypeDefaults,
  canGeneratePlan,
  formatCombinedTravelIntent,
  getGenerateHelperText,
  isCompactSchedule,
  resolveCompanionHint,
  resolvePersonalityForPlan,
  showsMoodQuestion,
  showsPersonalityQuestion,
  showsTravelIntentQuestion,
} from '@/lib/plan-creation';
import {
  getLocationPlaceholder,
  LOCATION_FIELD_HELPER,
  LOCATION_FIELD_LABEL,
  SPOT_INTERESTS_LABEL,
  SPOT_INTERESTS_PLACEHOLDER,
} from '@/lib/location-input-copy';
import { createDefaultBudgetScope } from '@/lib/budget-scope';
import {
  createDefaultTravelBudgetIncludes,
  travelBudgetIncludesToBudgetScope,
  type TravelBudgetIncludeOption,
} from '@/lib/travel-budget-includes';
import { buildLocationCurrencyHint } from '@/lib/location-currency';
import { SuccessOverlay } from '@/components/success-overlay';
import { AiAdviceSection } from '@/components/ai-advice-section';
import { BudgetBreakdownSection } from '@/components/budget-breakdown-section';
import { BudgetScopeEditor } from '@/components/budget-scope-editor';
import { PreTripPlanningSection } from '@/components/pre-trip-planning-section';
import { TravelTimingEditor } from '@/components/travel-timing-editor';
import { TourExperienceSection } from '@/components/tour-experience-section';
import { OutfitPackingSection } from '@/components/outfit-packing-section';
import { OutfitStyleModePicker } from '@/components/outfit-style-mode-picker';
import { ConciergeAccessSection } from '@/components/concierge-access-section';
import { ConciergeAnalysisSection } from '@/components/concierge-analysis-section';
import { ShareTripButton } from '@/components/share-trip-button';
import { SaveTripButton } from '@/components/save-trip-button';
import { PlanRatingSection } from '@/components/plan-rating-section';
import { AfterPlanLaunchButton } from '@/components/after-plan-launch-button';
import { ItineraryDaysView } from '@/components/itinerary-days-view';
import { ItineraryItemEditSheet } from '@/components/itinerary-item-edit-sheet';
import { CurrentLocationButton } from '@/components/current-location-button';
import { PlanCustomPreferencesFields } from '@/components/plan-custom-preferences-fields';
import {
  createPlanGenerationProgress,
  isAbortError,
  type PlanGenerationProgressHandle,
} from '@/components/plan-loading-screen';
import { PLAN_LOADING_STAGES } from '@/lib/plan-generation-progress';
import { PlacesNoticeBanner } from '@/components/places-notice-banner';
import { WeatherSection } from '@/components/weather-section';
import { WeatherReplanActions } from '@/components/weather-replan-actions';
import { buildTravelMemoryDisplayData } from '@/lib/travel-memory-display';
import { consumePendingLocalSpotForPlan } from '@/lib/plan-local-spot-intent';
import { getTravelMemories } from '@/lib/travel-memory';
import { FadeInView } from '@/components/ui/fade-in-view';
import { PrimaryButton, PremiumCard, SectionHeader, SelectChip } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { generatePlanWithAi, isOpenAiConfigured } from '@/lib/generate-plan';
import { buildActiveTripContext, saveActiveTrip } from '@/lib/active-trip';
import { COMPANION_SUBTITLES, getItineraryEyebrow, PERSONALITY_SUBTITLES } from '@/lib/itineraries';
import { getPreferredPersonality } from '@/lib/onboarding-storage';
import { getAllActivities, getDurationBadgeLabel } from '@/lib/trip-duration';
import {
  createDefaultTripSchedule,
  resolveTripSchedule,
  syncScheduleOnDepartureChange,
  syncScheduleOnReturnChange,
  syncScheduleOnPresetChange,
  validateTripSchedule,
} from '@/lib/trip-schedule';
import {
  EMPTY_USER_PREFERENCES,
  recordPlanPreferences,
} from '@/lib/user-memory';
import type { UserPreferences } from '@/types/user-memory';
import type { TravelUserPreferences } from '@/types/travel-user-preferences';
import { EMPTY_TRAVEL_USER_PREFERENCES } from '@/types/travel-user-preferences';
import type { PlanRatingContext } from '@/types/plan-rating';
import type { PlanCustomPreferences } from '@/types/plan-preferences';
import { HOME_MOOD_OPTIONS, type HomeMoodOption } from '@/types/plan-preferences';
import {
  PLAN_CREATION_TYPES,
  TRAVEL_INTENT_OPTIONS,
  type PlanCreationType,
  type TravelIntentOption,
} from '@/types/plan-creation';
import type { SavedTrip, SavedTripPayload } from '@/types/trip';
import type { WeatherReplanPreviewSuccess } from '@/types/weather-replan';
import { saveWeatherReplan } from '@/lib/weather-replans';
import type { ItineraryEditTarget, PartialItineraryEditResult } from '@/types/itinerary-edit';
import { buildItineraryItemId } from '@/types/itinerary-edit';
import { saveItineraryEdit } from '@/lib/itinerary-edits';
import { updateTrip } from '@/lib/saved-trips';
import { applyPartialEditResult } from '@/lib/itinerary-partial-edit';
import type {
  CompanionOption,
  ItineraryDay,
  ItineraryItem,
  PersonalityOption,
  PlanDetails,
  TripDurationOption,
} from '@/types/plan';
import {
  COMPANION_OPTIONS,
  isDateRelatedCompanion,
  PERSONALITY_OPTIONS,
} from '@/types/plan';
import { logPlanGenerationError } from '@/lib/plan-generation-log';
import type { BudgetScopeSettings } from '@/types/budget-scope';
import type { TripScheduleEditorValue } from '@/types/trip-schedule';
import { createDefaultTravelTiming, type TravelTimingSettings } from '@/types/travel-timing';
import type { OutfitStyleMode } from '@/types/outfit-advice';
import { generateOutfitPackingAdvice } from '@/lib/outfit-packing-advice';
import { ReferenceHomeScreen } from '@/components/home/reference-home-screen';
import { PlanGenerationOverlay } from '@/components/plan-generation-overlay';
import {
  TRAVEL_SHEET_PURPOSE_OPTIONS,
  TravelPlanSheetForm,
} from '@/components/home/travel-plan-sheet-form';
import type { HomePlanMode } from '@/components/home/home-action-config';
import {
  applyNormalizedTravelPlanFormState,
  buildTravelPlanSubmitPayload,
  getTravelPlanBudgetIncludes,
  getTravelPlanDurationMeta,
  getTravelPlanValidationMessages,
  isTravelPlanFormValid,
  resolveTravelPlanScheduleFromInput,
  resolveTravelPurpose,
  validateTravelPlanForm,
} from '@/lib/travel-plan-form-validation';
import { normalizeAccommodationFields } from '@/lib/accommodation-input';
import {
  buildPlanDetailParamsFromGeneration,
  logTravelPlanSubmitPayload,
  navigateAfterTravelPlanGeneration,
  snapshotToTravelPlanFormInput,
  type TravelPlanSubmitSnapshot,
} from '@/lib/travel-plan-result-nav';
import { safeKey, safeRouteParams } from '@/lib/safe-text';
import { cleanSerializable, isJsonParseError, serializeRouteParamJson } from '@/lib/safe-json';
import { resolveTravelPurposeValue } from '@/lib/travel-purpose';
import { LOOP_TEST_RESTORE, loopTestLogOnce } from '@/lib/loop-test-config';
import { shouldShowTravelPlanPlaceholder } from '@/lib/travel-form-restore';
import {
  formatTravelPlanValidationUserMessage,
  logTravelPlanAiAvailability,
  logTravelPlanGenerationFailed,
  logTravelPlanSubmitFinalState,
  logTravelPlanValidationFailure,
  logTravelPlanPayloadSafety,
} from '@/lib/travel-plan-submit-debug';
import { installPlanApiHealthCheckDevHook } from '@/lib/plan-api-health-check';
import { isLightweightMvp, lightweightMvpLog } from '@/lib/lightweight-mvp';
import {
  getRecommendReasonsForTrip,
  resolveTripAudience,
} from '@/lib/trip-type-copy';

const TRAVEL_PLAN_USER_ERROR = 'AIプラン生成に失敗しました。入力内容を確認してもう一度お試しください。';

const waitForOverlayPaint = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      setTimeout(resolve, 100);
    });
  });

type TravelPlanSubmitSnapshotWithScope = TravelPlanSubmitSnapshot & {
  budgetScope: BudgetScopeSettings;
};

function logTravelPlanGenerationError(error: unknown): void {
  const detail = extractPlanGenerationErrorDetail(error);
  const record =
    error && typeof error === 'object'
      ? (error as Record<string, unknown>)
      : ({} as Record<string, unknown>);

  // Kept for potential future use — AI generation failures are expected (timeout/502/network/
  // parse) and handled via a dev fallback plan, so must stay console.warn, not console.error.
  console.warn('[TravelPlanForm] generation error', {
    message: detail,
    name: error instanceof Error ? error.name : record.name,
    status: record.status,
    code: record.code,
    type: record.type,
    stack: error instanceof Error ? error.stack : undefined,
    raw: error,
  });
}

const accent = NS.colors.accent;

function ReasonCard({ label }: { label: string }) {
  return (
    <View style={styles.reasonCard}>
      <View style={styles.reasonCheck}>
        <Text style={styles.reasonCheckIcon}>✔</Text>
      </View>
      <Text style={styles.reasonText}>{label}</Text>
    </View>
  );
}

function RecommendReasonsSection({ companion }: { companion: CompanionOption }) {
  const reasons = getRecommendReasonsForTrip(resolveTripAudience({ companion }), 4);

  return (
    <View style={styles.reasonsSection}>
      <Text style={styles.reasonsTitle}>おすすめ理由</Text>
      <View style={styles.reasonsGrid}>
        {reasons.map((reason) => (
          <ReasonCard key={reason} label={reason} />
        ))}
      </View>
    </View>
  );
}

function ItineraryTimeline({
  companion,
  personality,
  tripDuration,
  customDuration,
  location,
  budget,
  currency,
  people,
  mood,
  days,
  items,
  details,
  onRegenerate,
  isRegenerating,
  planType,
  onPlanUpdated,
  budgetIncludes,
  travelPurpose,
}: {
  companion: CompanionOption;
  personality: PersonalityOption;
  tripDuration: TripDurationOption;
  customDuration?: import('@/types/trip-schedule').CustomTripDuration;
  location: string;
  budget: string;
  currency: CurrencyCode;
  people: string;
  mood: string;
  days: ItineraryDay[];
  items: ItineraryItem[];
  details: PlanDetails;
  onRegenerate: () => void;
  isRegenerating: boolean;
  planType: PlanCreationType;
  onPlanUpdated?: (days: ItineraryDay[], items: ItineraryItem[], details: PlanDetails) => void;
  budgetIncludes?: import('@/lib/travel-budget-includes').TravelBudgetIncludeOption[];
  travelPurpose?: string;
}) {
  const [showSuccess, setShowSuccess] = useState(false);
  const [savedTripId, setSavedTripId] = useState<string | null>(null);
  const [preserveSavedAt, setPreserveSavedAt] = useState<string | undefined>(undefined);
  const [pendingRatingId, setPendingRatingId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<ItineraryEditTarget | null>(null);
  const [showEditSheet, setShowEditSheet] = useState(false);

  const editPayload: SavedTripPayload = {
    location,
    budget,
    currency,
    people,
    mood,
    companion,
    personality,
    tripDuration,
    customDuration,
    days,
    items,
    details,
    budgetIncludes,
    travelPurpose,
  };

  const syncSavedTripPayload = async (payload: SavedTripPayload) => {
    if (!savedTripId) return;
    try {
      await updateTrip(savedTripId, payload, undefined, preserveSavedAt);
    } catch {
      // Local UI remains usable even if background sync fails.
    }
  };

  const handleApplyEdit = async (result: PartialItineraryEditResult, editRequest: string) => {
    const nextPayload = applyPartialEditResult(editPayload, result);
    onPlanUpdated?.(nextPayload.days, nextPayload.items, nextPayload.details);
    await syncSavedTripPayload({
      ...nextPayload,
      budgetIncludes,
      travelPurpose,
      savedAt: preserveSavedAt,
    });

    if (savedTripId && editTarget) {
      await saveItineraryEdit({
        tripId: savedTripId,
        dayIndex: editTarget.dayIndex,
        itemId: buildItineraryItemId(editTarget),
        editRequest,
        beforeData: {
          item: result.preview.beforeItem,
          dayIndex: editTarget.dayIndex,
          itemIndex: editTarget.itemIndex,
        },
        afterData: {
          item: result.preview.afterItem,
          dayIndex: editTarget.dayIndex,
          itemIndex: editTarget.itemIndex,
        },
      });
    }
  };

  const handleApplyWeatherReplan = async (
    nextPayload: SavedTripPayload,
    preview: WeatherReplanPreviewSuccess,
  ) => {
    onPlanUpdated?.(nextPayload.days, nextPayload.items, nextPayload.details);
    await syncSavedTripPayload({
      ...nextPayload,
      budgetIncludes,
      travelPurpose,
      savedAt: preserveSavedAt,
    });
    if (savedTripId) {
      await saveWeatherReplan({
        tripId: savedTripId,
        beforePlan: preview.beforePayload,
        afterPlan: preview.afterPayload,
        weatherContext: preview.freshWeather,
      });
    }
  };

  const ratingContext: PlanRatingContext = {
    source: 'home',
    location,
    budget,
    currency,
    people,
    mood,
    companion,
    personality,
    tripDuration,
    days,
    items,
    details,
  };

  const outfitAdvice =
    details.outfitAdvice ??
    (details.weather
      ? generateOutfitPackingAdvice({
          days,
          weather: details.weather,
          location,
          planType,
          companion,
          dayCount: days.length,
          tripDate: details.tripDate,
        })
      : undefined);

  const transportContext = {
    location,
    weather: details.weather,
    travelTiming: details.travelTiming,
    companion,
    budget,
  };

  const handleTripSaved = (trip: SavedTrip) => {
    setSavedTripId(trip.id);
    setPreserveSavedAt(trip.payload.savedAt);
    if (pendingRatingId) {
      void linkPlanRatingToTrip(pendingRatingId, trip.id);
    }
  };

  const cleanPlan = cleanSerializable({ days, items, details });
  const planParams = {
    location,
    budget,
    currency,
    people,
    mood: travelPurpose?.trim() || mood,
    companion,
    personality,
    tripDuration,
    days: serializeRouteParamJson(cleanPlan.days),
    items: serializeRouteParamJson(cleanPlan.items),
    details: serializeRouteParamJson(cleanPlan.details),
    ...(travelPurpose?.trim() ? { travelPurpose: travelPurpose.trim() } : {}),
    ...(budgetIncludes?.length ? { budgetIncludes: serializeRouteParamJson(budgetIncludes) } : {}),
  };

  const openDetail = () => {
    if (__DEV__) {
      console.log('[TravelPlanSubmit] generated plan before serialize', cleanPlan);
      console.log('[TravelPlanSubmit] serialized planJson lengths', {
        days: planParams.days.length,
        items: planParams.items.length,
        details: planParams.details.length,
      });
    }
    router.push({
      pathname: '/plan-detail',
      params: safeRouteParams(planParams),
    });
  };

  const handleConfirm = () => {
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      router.push({
        pathname: '/today-schedule',
        params: safeRouteParams(planParams),
      });
    }, 1800);
  };

  return (
    <>
      <SuccessOverlay visible={showSuccess} message="今日の予定が決まりました！" />

      <View style={styles.itinerarySection}>
        <Pressable
          style={({ pressed }) => pressed && styles.itinerarySectionPressed}
          onPress={openDetail}>
          <View style={styles.itineraryHeader}>
            <View style={styles.itineraryHeaderText}>
              <Text style={styles.itineraryEyebrow}>{getItineraryEyebrow(companion, location)}</Text>
              <Text style={styles.itineraryTitle}>
                {days.length > 1 ? '旅行プラン' : tripDuration === '半日' ? '半日プラン' : '今日のプラン'}
              </Text>
              <View style={styles.badgeRow}>
                <View style={styles.personalityBadge}>
                  <Text style={styles.personalityBadgeText}>{personality}</Text>
                </View>
                <View style={styles.durationBadge}>
                  <Text style={styles.durationBadgeText}>
                    {getDurationBadgeLabel(tripDuration, customDuration)}
                  </Text>
                </View>
              </View>
              <Text style={styles.itinerarySubtitle}>{PERSONALITY_SUBTITLES[personality]}</Text>
              <Text style={styles.itineraryCompanionNote}>{COMPANION_SUBTITLES[companion]}</Text>
              {details.weather ? (
                <>
                  <WeatherSection weather={details.weather} compact />
                  <WeatherReplanActions
                    payload={editPayload}
                    compact
                    onApply={handleApplyWeatherReplan}
                  />
                </>
              ) : null}
              {outfitAdvice ? <OutfitPackingSection advice={outfitAdvice} compact /> : null}
              {details.placesNotice ? (
                <PlacesNoticeBanner message={details.placesNotice} />
              ) : null}
              {details.budgetBreakdown ? (
                <BudgetBreakdownSection
                  breakdown={details.budgetBreakdown}
                  budgetScope={details.budgetScope}
                  compact
                />
              ) : (
                <View style={styles.budgetPill}>
                  <Text style={styles.budgetPillLabel}>合計予算</Text>
                  <Text style={styles.budgetPillValue}>{details.totalBudget}</Text>
                </View>
              )}
              {details.conciergeAnalysis ? (
                <ConciergeAnalysisSection analysis={details.conciergeAnalysis} compact />
              ) : null}
              {details.plannerMessage ? (
                <View style={styles.plannerMessageBox}>
                  <Text style={styles.plannerMessageLabel}>プランナーより</Text>
                  <Text style={styles.plannerMessageText}>{details.plannerMessage}</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.itineraryBadge}>
              <Text style={styles.itineraryBadgeText}>
                {days.length > 1 ? `${days.length}日` : `${items.length}件`}
              </Text>
            </View>
          </View>

          <View style={styles.timelineList}>
            <AfterPlanLaunchButton location={location} variant="compact" />
            <CurrentLocationButton compact />
            <ItineraryDaysView
              days={days}
              variant="timeline"
              location={location}
              editable
              onEditItem={(target) => {
                setEditTarget(target);
                setShowEditSheet(true);
              }}
              transportContext={transportContext}
            />
          </View>

          <View style={styles.detailHint}>
            <Text style={styles.detailHintText}>タップしてプラン詳細を見る →</Text>
          </View>
        </Pressable>

        <ConciergeAccessSection
          days={days}
          location={location}
          compact
          transportContext={transportContext}
        />

        {(planType === '旅行プラン' || planType === '週末プラン') && days.length >= 2 ? (
          <TourExperienceSection
            destination={location}
            tourSuggestions={details.tourSuggestions}
          />
        ) : null}

        {isDateRelatedCompanion(companion) && details.aiAdvice ? (
          <AiAdviceSection advice={details.aiAdvice} />
        ) : null}

        <RecommendReasonsSection companion={companion} />

        <PlanRatingSection
          context={ratingContext}
          savedTripId={savedTripId}
          onRated={setPendingRatingId}
        />

        <View style={styles.regenerateButtonWrap}>
          <PrimaryButton
            label={isRegenerating ? '提案中...' : '別のプランを提案'}
            onPress={onRegenerate}
            disabled={isRegenerating}
            variant="secondary"
          />
        </View>

        <View style={styles.saveButtonWrap}>
          <SaveTripButton
            location={location}
            budget={budget}
            currency={currency}
            people={people}
            mood={mood}
            companion={companion}
            personality={personality}
            tripDuration={tripDuration}
            customDuration={customDuration}
            days={days}
            items={items}
            details={details}
            budgetIncludes={budgetIncludes}
            travelPurpose={travelPurpose}
            savedTripId={savedTripId}
            preserveSavedAt={preserveSavedAt}
            onSaved={handleTripSaved}
          />
        </View>

        <View style={styles.shareButtonWrap}>
          <ShareTripButton
            location={location}
            companion={companion}
            personality={personality}
            tripDuration={tripDuration}
            customDuration={customDuration}
            days={days}
            items={items}
            details={details}
          />
        </View>

        <View style={styles.confirmButtonWrap}>
          <PrimaryButton label="このプランで決定" onPress={handleConfirm} variant="secondary" />
        </View>
      </View>

      <ItineraryItemEditSheet
        visible={showEditSheet}
        target={editTarget}
        payload={editPayload}
        onClose={() => {
          setShowEditSheet(false);
          setEditTarget(null);
        }}
        onApply={handleApplyEdit}
      />
    </>
  );
}

type FormFieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'numeric' | 'number-pad';
  hint?: string;
};

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  hint,
}: FormFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={NS.colors.textMuted}
        keyboardType={keyboardType}
      />
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

function CurrencySelector({
  selected,
  onSelect,
  locationHint,
}: {
  selected: CurrencyCode;
  onSelect: (code: CurrencyCode) => void;
  locationHint?: string | null;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>通貨</Text>
      {locationHint ? <Text style={styles.currencyAutoHint}>{locationHint}</Text> : null}
      <View style={styles.currencyRow}>
        {CURRENCY_OPTIONS.map((option) => {
          const isSelected = selected === option.code;
          return (
            <Pressable
              key={option.code}
              style={[styles.currencyChip, isSelected && styles.currencyChipSelected]}
              onPress={() => onSelect(option.code)}>
              <Text style={[styles.currencyCode, isSelected && styles.currencyCodeSelected]}>
                {option.code}
              </Text>
              <Text style={[styles.currencySymbol, isSelected && styles.currencySymbolSelected]}>
                {option.symbol}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function BudgetField({
  currency,
  value,
  onChangeText,
}: {
  currency: CurrencyCode;
  value: string;
  onChangeText: (text: string) => void;
}) {
  const { symbol } = getCurrency(currency);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>予算（{currency}）</Text>
      <View style={styles.budgetInputRow}>
        <Text style={styles.budgetPrefix}>{symbol}</Text>
        <TextInput
          style={styles.budgetInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={getBudgetPlaceholder(currency)}
          placeholderTextColor={NS.colors.textMuted}
          keyboardType="numeric"
        />
      </View>
    </View>
  );
}

function CompanionCard({
  label,
  selected,
  onPress,
  colorIndex,
}: {
  label: CompanionOption;
  selected: boolean;
  onPress: () => void;
  colorIndex?: number;
}) {
  return (
    <SelectChip
      label={label}
      selected={selected}
      onPress={onPress}
      colorIndex={colorIndex}
    />
  );
}

function PersonalityCard({
  label,
  selected,
  onPress,
  colorIndex,
}: {
  label: PersonalityOption;
  selected: boolean;
  onPress: () => void;
  colorIndex?: number;
}) {
  return (
    <SelectChip
      label={label}
      selected={selected}
      onPress={onPress}
      colorIndex={colorIndex}
    />
  );
}

function MoodCard({
  label,
  selected,
  onPress,
  colorIndex,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  colorIndex?: number;
}) {
  return (
    <SelectChip
      label={label}
      selected={selected}
      onPress={onPress}
      colorIndex={colorIndex}
    />
  );
}

function PlanTypeCard({
  label,
  selected,
  onPress,
  colorIndex,
}: {
  label: PlanCreationType;
  selected: boolean;
  onPress: () => void;
  colorIndex?: number;
}) {
  return (
    <SelectChip
      label={label}
      selected={selected}
      onPress={onPress}
      colorIndex={colorIndex}
    />
  );
}

const INITIAL_GENERATION_STEP = 0;

export default function HomeScreen() {
  const [planType, setPlanType] = useState<PlanCreationType>('今日のお出かけ');
  const [location, setLocation] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [baseArea, setBaseArea] = useState('');
  const [accommodation, setAccommodation] = useState('');
  const [arrivalPoint, setArrivalPoint] = useState('');
  const [tripSchedule, setTripSchedule] = useState<TripScheduleEditorValue>(() =>
    applyPlanTypeDefaults('今日のお出かけ', createDefaultTripSchedule()),
  );
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [budget, setBudget] = useState('');
  const [budgetScope, setBudgetScope] = useState<BudgetScopeSettings>(() =>
    createDefaultBudgetScope('今日のお出かけ'),
  );
  const [travelBudgetIncludes, setTravelBudgetIncludes] = useState<TravelBudgetIncludeOption[]>(
    () => createDefaultTravelBudgetIncludes(),
  );
  const [travelTiming, setTravelTiming] = useState<TravelTimingSettings>(() =>
    createDefaultTravelTiming(),
  );
  const [outfitStyleMode, setOutfitStyleMode] = useState<OutfitStyleMode>('AIに任せる');
  const [currency, setCurrency] = useState<CurrencyCode>('JPY');
  const [people, setPeople] = useState('');
  const [mood, setMood] = useState<HomeMoodOption | ''>('');
  const [travelIntent, setTravelIntent] = useState<TravelIntentOption | ''>('');
  const [customPreferences, setCustomPreferences] = useState<PlanCustomPreferences>({});
  const [companion, setCompanion] = useState<CompanionOption | null>(null);
  const [personality, setPersonality] = useState<PersonalityOption | null>(null);
  const [showItinerary, setShowItinerary] = useState(false);
  const [days, setDays] = useState<ItineraryDay[]>([]);
  const [itinerary, setItinerary] = useState<ItineraryItem[]>([]);
  const [planDetails, setPlanDetails] = useState<PlanDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [generationStepIndex, setGenerationStepIndex] = useState(INITIAL_GENERATION_STEP);
  const [error, setError] = useState<string | null>(null);
  const [saveWarning, setSaveWarning] = useState<string | null>(null);
  const userPreferences: UserPreferences = EMPTY_USER_PREFERENCES;
  const travelUserPreferences: TravelUserPreferences = EMPTY_TRAVEL_USER_PREFERENCES;
  const [travelMemories, setTravelMemories] = useState<import('@/types/travel-memory').TravelMemory[]>([]);
  const [isMemoryLoading, setIsMemoryLoading] = useState(false);
  const [openedPlanMode, setOpenedPlanMode] = useState<HomePlanMode | null>(null);
  const [travelValidationAttempted, setTravelValidationAttempted] = useState(false);
  const [selectedTravelPurposeId, setSelectedTravelPurposeId] = useState<string | null>(null);
  const [travelPurpose, setTravelPurpose] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const generationInFlightRef = useRef(false);
  const generationAbortRef = useRef<AbortController | null>(null);
  const progressHandleRef = useRef<PlanGenerationProgressHandle | null>(null);
  const travelSubmitSnapshotRef = useRef<TravelPlanSubmitSnapshotWithScope | null>(null);

  const stopGenerationProgress = () => {
    progressHandleRef.current?.stop();
    progressHandleRef.current = null;
    generationAbortRef.current = null;
  };

  const resetStaleGenerationUi = useCallback(() => {
    if (generationInFlightRef.current) return;
    setIsLoading(false);
    setGenerationStepIndex(INITIAL_GENERATION_STEP);
    stopGenerationProgress();
  }, []);

  const showGenerationOverlay = useCallback(async () => {
    setScheduleError(null);
    setIsLoading(true);
    setError(null);
    setSaveWarning(null);
    setShowItinerary(false);
    setGenerationStepIndex(INITIAL_GENERATION_STEP);
    await waitForOverlayPaint();
  }, []);

  const handleCancelGeneration = () => {
    generationAbortRef.current?.abort();
    stopGenerationProgress();
    generationInFlightRef.current = false;
    setIsLoading(false);
    setGenerationStepIndex(INITIAL_GENERATION_STEP);
  };

  const refreshTravelMemories = useCallback(async () => {
    if (isLightweightMvp()) {
      lightweightMvpLog('home:travelMemories', 'skipping travel memories fetch (Supabase)');
      return;
    }
    setIsMemoryLoading((prev) => (prev ? prev : true));
    try {
      const memories = await getTravelMemories();
      setTravelMemories((prev) =>
        JSON.stringify(prev) === JSON.stringify(memories) ? prev : memories,
      );
    } catch {
      setTravelMemories((prev) => (prev.length === 0 ? prev : []));
    } finally {
      setIsMemoryLoading((prev) => (prev ? false : prev));
    }
  }, []);

  const refreshMemorySummary = useCallback(async () => {
    await refreshTravelMemories();
  }, [refreshTravelMemories]);

  const memoryDisplay = useMemo(() => {
    return buildTravelMemoryDisplayData({
      preferences: userPreferences,
      memories: travelMemories,
    });
  }, [travelMemories, userPreferences]);

  useEffect(() => {
    void getPreferredPersonality().then((preferredPersonality) => {
      if (preferredPersonality) {
        setPersonality((prev) => (prev === preferredPersonality ? prev : preferredPersonality));
      }
    });
  }, []);

  useEffect(() => {
    if (__DEV__ && Platform.OS === 'web') {
      if (isLightweightMvp()) {
        // Lightweight MVP: keep the manual `globalThis.__nanisuruHealthCheck()` hook available,
        // but skip the automatic run so a localhost/LAN mismatch never logs on every boot.
        installPlanApiHealthCheckDevHook({ autoRun: false });
        return;
      }
      installPlanApiHealthCheckDevHook();
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshMemorySummary();
      void consumePendingLocalSpotForPlan().then((pending) => {
        if (!pending) return;
        setLocation((prev) => prev || pending.area);
        setCustomPreferences((prev) => ({
          ...prev,
          desiredPlaces: prev.desiredPlaces?.trim()
            ? `${prev.desiredPlaces}、${pending.name}`
            : pending.name,
        }));
      });
    }, [refreshMemorySummary]),
  );

  // NOTE: currency is never auto-changed from the destination text — the user's own
  // CurrencySelector choice is authoritative (e.g. JPY must stay JPY for a Korea trip).
  // `locationCurrencyHint` below is informational only (shows the local currency as a hint).
  const locationCurrencyHint = buildLocationCurrencyHint(city || country || location);

  const resetPlan = () => {
    setShowItinerary(false);
    setDays([]);
    setItinerary([]);
    setPlanDetails(null);
    setError(null);
    setSaveWarning(null);
  };

  const resolvedSchedule = resolveTripSchedule(tripSchedule);
  const effectivePersonality = resolvePersonalityForPlan({
    planType,
    personality,
    travelIntent,
    travelPurpose,
  });

  const handlePlanTypeChange = (nextType: PlanCreationType) => {
    setPlanType(nextType);
    setTripSchedule((prev) => applyPlanTypeDefaults(nextType, prev));
    setBudgetScope(createDefaultBudgetScope(nextType));
    if (nextType === 'デートプラン' && !companion) {
      setCompanion('カップル');
    }
    if (showsMoodQuestion(nextType)) {
      setTravelIntent('');
    } else if (showsTravelIntentQuestion(nextType)) {
      setMood('');
    }
    if (showItinerary) resetPlan();
  };

  const handlePlanFormOpen = (mode: HomePlanMode, planType: PlanCreationType) => {
    resetStaleGenerationUi();
    handlePlanTypeChange(planType);
    setOpenedPlanMode(mode);
    if (mode === 'travel') {
      loopTestLogOnce(
        'restore:travelPlanFormOpen',
        LOOP_TEST_RESTORE.travelPlanForm && !LOOP_TEST_RESTORE.travelPlanPlaceholder
          ? 'real travel plan form open'
          : 'travel plan form placeholder',
      );
      setTravelValidationAttempted(false);
      setSelectedTravelPurposeId(null);
      setTravelPurpose(null);
      setTravelIntent('');
      setCustomPreferences((prev) => ({
        ...prev,
        customTravelIntent: undefined,
      }));
      const defaultIncludes = createDefaultTravelBudgetIncludes();
      setTravelBudgetIncludes(defaultIncludes);
      setBudgetScope(travelBudgetIncludesToBudgetScope(defaultIncludes));
    }
  };

  const handlePlanFormClose = () => {
    resetStaleGenerationUi();
    generationInFlightRef.current = false;
    setOpenedPlanMode(null);
    setTravelValidationAttempted(false);
    setSelectedTravelPurposeId(null);
    setTravelPurpose(null);
  };

  const handleTravelPurposeSelect = (option: (typeof TRAVEL_SHEET_PURPOSE_OPTIONS)[number]) => {
    if (__DEV__) {
      console.log('[TravelPlanForm] selected purpose', option.label);
    }
    setSelectedTravelPurposeId(option.id);
    setTravelPurpose(option.label);
    if (option.travelIntent) {
      setTravelIntent(option.travelIntent);
      setCustomPreferences((prev) => ({ ...prev, customTravelIntent: undefined }));
    } else {
      setTravelIntent('');
      setCustomPreferences((prev) => ({
        ...prev,
        customTravelIntent: option.purposeCustom,
      }));
    }
    if (showItinerary) resetPlan();
  };

  const handleTravelIntentSelect = (option: TravelIntentOption) => {
    setTravelIntent(option);
    const companionHint = resolveCompanionHint(option);
    if (companionHint && !companion) {
      setCompanion(companionHint);
    }
    if (showItinerary) resetPlan();
  };

  const fetchPlan = async (avoidActivities?: string[], signal?: AbortSignal) => {
    const snap = travelSubmitSnapshotRef.current;
    const effectiveCompanion = snap?.companion ?? companion;
    if (!effectiveCompanion) throw new Error('Companion not selected');

    const effectiveLocation = snap?.location ?? location;
    const effectiveBudget = snap?.budget ?? budget;
    const effectivePeople = snap?.people ?? people;
    const effectiveTravelTiming = snap?.travelTiming ?? travelTiming;
    const effectiveTravelIntent = snap?.travelIntent ?? travelIntent;
    const effectiveCustomPreferences = snap?.customPreferences ?? customPreferences;

    const effectiveTravelPurpose =
      snap?.travelPurpose ??
      resolveTravelPurposeValue({
        travelPurpose,
        travelIntent: effectiveTravelIntent,
        customTravelIntent: effectiveCustomPreferences.customTravelIntent,
      });

    const resolvedPersonality = resolvePersonalityForPlan({
      planType,
      personality,
      travelIntent: effectiveTravelIntent,
      travelPurpose: effectiveTravelPurpose,
    });

    const effectiveTripSchedule = snap?.tripSchedule ?? tripSchedule;
    const effectiveResolvedSchedule = resolveTripSchedule(effectiveTripSchedule);

    const scheduleValidation = validateTripSchedule(effectiveTripSchedule);
    if (scheduleValidation) {
      throw new Error(scheduleValidation);
    }

    const travelPurposeForGeneration = effectiveTravelPurpose;

    const effectiveBudgetScope =
      snap?.budgetScope ?? budgetScope ?? travelBudgetIncludesToBudgetScope(travelBudgetIncludes);

    if (__DEV__ && planType === '旅行プラン' && snap) {
      logTravelPlanSubmitPayload(snap);
    }

    const plan = await generatePlanWithAi({
      location: effectiveLocation,
      country: snap?.country,
      city: snap?.city,
      baseArea: snap?.baseArea,
      arrivalPoint: snap?.arrivalPoint,
      destinationLabel: snap?.destinationLabel ?? effectiveLocation,
      budget: effectiveBudget,
      currency,
      people: effectivePeople,
      companion: effectiveCompanion,
      personality: resolvedPersonality,
      tripDuration: effectiveResolvedSchedule.durationPreset,
      tripDate: effectiveResolvedSchedule.departureDate,
      tripEndDate: effectiveResolvedSchedule.returnDate,
      customDuration: effectiveResolvedSchedule.customDuration,
      mood: showsTravelIntentQuestion(planType) ? travelPurposeForGeneration : mood,
      travelIntent: showsTravelIntentQuestion(planType) ? effectiveTravelIntent : '',
      travelPurpose: travelPurposeForGeneration,
      planCreationType: planType,
      planType,
      departureDate: effectiveResolvedSchedule.departureDate,
      returnDate: effectiveResolvedSchedule.returnDate,
      durationLabel: effectiveResolvedSchedule.durationLabel,
      companionType: effectiveCompanion,
      mustVisitPlaces: effectiveCustomPreferences.desiredPlaces,
      avoidPreferences: effectiveCustomPreferences.avoidPreferences,
      budgetScope: effectiveBudgetScope,
      customPreferences: effectiveCustomPreferences,
      avoidActivities,
      abortSignal: signal,
      travelTiming:
        planType === '旅行プラン' || planType === '週末プラン' ? effectiveTravelTiming : undefined,
      outfitStyleMode,
      ...normalizeAccommodationFields(snap?.accommodation),
    });
    return plan;
  };

  const syncActiveTrip = async (plan: {
    days: ItineraryDay[];
    details: PlanDetails;
  }) => {
    if (!companion) return;

    const stylePersonality = resolvePersonalityForPlan({
      planType,
      personality,
      travelIntent,
      travelPurpose,
    });

    await saveActiveTrip(
      buildActiveTripContext({
        location,
        budget,
        currency,
        people,
        mood:
          formatCombinedMood(mood, customPreferences.customMood) ||
          formatCombinedTravelIntent(travelIntent, customPreferences.customTravelIntent),
        companion,
        personality: stylePersonality,
        tripDuration: resolvedSchedule.durationPreset,
        days: plan.days,
        details: plan.details,
      }),
    );
  };

  const learnFromPlan = async (plan: {
    days: ItineraryDay[];
    items: ItineraryItem[];
  }) => {
    const stylePersonality = resolvePersonalityForPlan({
      planType,
      personality,
      travelIntent,
      travelPurpose,
    });

    await recordPlanPreferences({
      personality: stylePersonality,
      tripDuration: resolvedSchedule.durationPreset,
      budget,
      currency,
      activities: getAllActivities(plan.days),
    });
    await refreshMemorySummary();
  };

  const handleGenerate = async (options?: { overlayReady?: boolean }) => {
    const snap = travelSubmitSnapshotRef.current;
    const effectiveTravelIntent = snap?.travelIntent ?? travelIntent;
    const effectiveCustomPreferences = snap?.customPreferences ?? customPreferences;
    const effectiveTravelPurpose =
      snap?.travelPurpose ??
      resolveTravelPurposeValue({
        travelPurpose,
        travelIntent: effectiveTravelIntent,
        customTravelIntent: effectiveCustomPreferences.customTravelIntent,
      });

    if (generationInFlightRef.current && !options?.overlayReady) {
      if (__DEV__) console.log('[GenerateButton] blocked: generation already in flight');
      return;
    }

    const travelSubmitValidated =
      openedPlanMode === 'travel' && Boolean(snap?.travelPurpose?.trim());
    const hasTravelSubmitSnap = openedPlanMode === 'travel' && Boolean(snap);

    const effectiveCompanion = snap?.companion ?? companion;

    if (
      !hasTravelSubmitSnap &&
      !canGeneratePlan({
        planType,
        companion: effectiveCompanion,
        personality,
        mood,
        travelIntent: effectiveTravelIntent,
        customPreferences: effectiveCustomPreferences,
        travelPurpose: effectiveTravelPurpose,
      }) &&
      !travelSubmitValidated
    ) {
      if (__DEV__) {
        console.warn('[TravelPlanSubmit] canGeneratePlan blocked', {
          planType,
          companion: effectiveCompanion,
          personality,
          mood,
          travelPurpose: effectiveTravelPurpose,
          travelIntent: effectiveTravelIntent,
        });
      }
      if (openedPlanMode === 'travel') {
        setError(
          formatTravelPlanValidationUserMessage({
            companionType: !effectiveCompanion ? '誰と行くか選んでください' : undefined,
            travelPurpose:
              !effectiveTravelPurpose?.trim() ? '旅行の目的を選んでください' : undefined,
          }),
        );
      }
      if (options?.overlayReady) {
        generationInFlightRef.current = false;
        setIsLoading(false);
        setGenerationStepIndex(INITIAL_GENERATION_STEP);
      }
      return;
    }

    const submitSnap = travelSubmitSnapshotRef.current;
    const effectiveTripSchedule = submitSnap?.tripSchedule ?? tripSchedule;
    const effectiveResolvedSchedule = resolveTripSchedule(effectiveTripSchedule);

    const scheduleValidation = validateTripSchedule(effectiveTripSchedule);
    if (scheduleValidation) {
      if (__DEV__) {
        console.warn('[TravelPlanSubmit] schedule validation failed', scheduleValidation);
      }
      setScheduleError(scheduleValidation);
      if (openedPlanMode === 'travel') {
        setError(scheduleValidation);
      }
      if (options?.overlayReady) {
        generationInFlightRef.current = false;
        setIsLoading(false);
        setGenerationStepIndex(INITIAL_GENERATION_STEP);
      }
      return;
    }

    generationInFlightRef.current = true;

    try {
      if (!options?.overlayReady) {
        await showGenerationOverlay();
      }

      const abortController = new AbortController();
      generationAbortRef.current = abortController;
      const progress = createPlanGenerationProgress({
        tripDuration: effectiveResolvedSchedule.durationPreset,
        customDuration: effectiveResolvedSchedule.customDuration,
        durationLabel: effectiveResolvedSchedule.durationLabel,
        ...(openedPlanMode === 'travel'
          ? {
              headline: 'プランを作成中',
              subtitle: 'あなたにぴったりの旅を組み立てています',
            }
          : {}),
        onUpdate: (state) => {
          setGenerationStepIndex((prev) => (prev === state.step ? prev : state.step));
        },
      });
      progressHandleRef.current = progress;
      progress.start();

      const plan = await fetchPlan(undefined, abortController.signal);
      progress.complete();
      setGenerationStepIndex(PLAN_LOADING_STAGES.length - 1);

      setDays(plan.days);
      setItinerary(plan.items);
      setPlanDetails(plan.details);
      setShowItinerary(true);

      if (plan.devFallbackNotice) {
        setSaveWarning(plan.devFallbackNotice);
      }

      const snapForResult = travelSubmitSnapshotRef.current;
      if (openedPlanMode === 'travel' && snapForResult && LOOP_TEST_RESTORE.travelPlanGeneration) {
        const resolvedPersonalityForNav = resolvePersonalityForPlan({
          planType,
          personality,
          travelIntent: snapForResult.travelIntent,
          travelPurpose: snapForResult.travelPurpose,
        });
        const detailParams = buildPlanDetailParamsFromGeneration({
          snap: snapForResult,
          plan,
          personality: resolvedPersonalityForNav,
          tripDuration: effectiveResolvedSchedule.durationPreset,
        });
        try {
          navigateAfterTravelPlanGeneration(snapForResult, plan, detailParams);
        } catch (navError) {
          logTravelPlanGenerationFailed(navError);
          setError(
            formatPlanGenerationDevError(
              'プランは作成できましたが、結果画面を開けませんでした。もう一度お試しください。',
              navError instanceof Error ? navError : new Error(String(navError)),
            ),
          );
        }
      }

      if (!isLightweightMvp()) {
        try {
          await Promise.all([learnFromPlan(plan), syncActiveTrip(plan)]);
        } catch (saveErr) {
          logPlanGenerationError('post_generation_save', saveErr);
          setSaveWarning(
            isSupabaseError(saveErr)
              ? APP_MESSAGES.supabaseFailed
              : APP_MESSAGES.planSaveWarning,
          );
        }
      }
    } catch (err) {
      if (isAbortError(err)) {
        return;
      }
      if (openedPlanMode === 'travel') {
        logTravelPlanGenerationFailed(err);
        logPlanGenerationError('travel_plan_generate', err, {
          location: travelSubmitSnapshotRef.current?.location ?? location,
          budget: travelSubmitSnapshotRef.current?.budget ?? budget,
          people: travelSubmitSnapshotRef.current?.people ?? people,
        });
        const classified = classifyError(err);
        const isKnownFailure =
          classified.code === 'INPUT_INCOMPLETE' ||
          classified.code === 'NO_PLACES_FOUND' ||
          classified.code === 'OPENAI_FAILED' ||
          classified.code === 'NETWORK_ERROR' ||
          err instanceof OpenAiRequestError;
        const userMessage = isJsonParseError(err)
          ? 'プランの表示に失敗しました。もう一度お試しください。'
          : isKnownFailure
            ? getPlanGenerationErrorMessage(err)
            : TRAVEL_PLAN_USER_ERROR;
        setError(formatPlanGenerationDevError(userMessage, err));
      } else {
        logPlanGenerationError('generate_plan', err);
        setError(getPlanGenerationErrorMessage(err));
      }
      setShowItinerary(false);
    } finally {
      travelSubmitSnapshotRef.current = null;
      stopGenerationProgress();
      generationInFlightRef.current = false;
      setIsLoading(false);
      setGenerationStepIndex(INITIAL_GENERATION_STEP);
    }
  };

  const handleRegenerate = async () => {
    if (
      !canGeneratePlan({
        planType,
        companion,
        personality,
        mood,
        travelIntent,
        customPreferences,
      }) ||
      isLoading ||
      generationInFlightRef.current ||
      days.length === 0
    ) {
      return;
    }

    const scheduleValidation = validateTripSchedule(tripSchedule);
    if (scheduleValidation) {
      setScheduleError(scheduleValidation);
      return;
    }

    generationInFlightRef.current = true;

    try {
      await showGenerationOverlay();

      const avoidActivities = getAllActivities(days);
      const abortController = new AbortController();
      generationAbortRef.current = abortController;
      const progress = createPlanGenerationProgress({
        tripDuration: resolvedSchedule.durationPreset,
        customDuration: resolvedSchedule.customDuration,
        durationLabel: resolvedSchedule.durationLabel,
        onUpdate: (state) => {
          setGenerationStepIndex((prev) => (prev === state.step ? prev : state.step));
        },
      });
      progressHandleRef.current = progress;
      progress.start();

      const plan = await fetchPlan(avoidActivities, abortController.signal);
      progress.complete();
      setGenerationStepIndex(PLAN_LOADING_STAGES.length - 1);

      setDays(plan.days);
      setItinerary(plan.items);
      setPlanDetails(plan.details);
      setShowItinerary(true);

      try {
        await Promise.all([learnFromPlan(plan), syncActiveTrip(plan)]);
      } catch (saveErr) {
        logPlanGenerationError('post_regeneration_save', saveErr);
        setSaveWarning(
          isSupabaseError(saveErr)
            ? APP_MESSAGES.supabaseFailed
            : APP_MESSAGES.planSaveWarning,
        );
      }
    } catch (err) {
      if (isAbortError(err)) {
        return;
      }
      logPlanGenerationError('regenerate_plan', err);
      setError(getPlanGenerationErrorMessage(err));
    } finally {
      stopGenerationProgress();
      generationInFlightRef.current = false;
      setIsLoading(false);
      setGenerationStepIndex(INITIAL_GENERATION_STEP);
    }
  };

  const handleLocationChange = (text: string) => {
    setLocation(text);
    if (showItinerary) resetPlan();
  };

  const resolvedMood = formatCombinedMood(mood, customPreferences.customMood);
  const generateReady = canGeneratePlan({
    planType,
    companion,
    personality,
    mood,
    travelIntent,
    customPreferences,
  });
  const generateHelperText = getGenerateHelperText({
    planType,
    companion,
    personality,
    mood,
    travelIntent,
    customPreferences,
  });
  const scheduleSubtitle =
    planType === '今日のお出かけ' || planType === 'デートプラン'
      ? '日帰りの日程を設定（カレンダーから選択できます）'
      : '出発日と帰宅日、旅行の長さを設定';

  const travelValidationErrors = useMemo(
    () =>
      validateTravelPlanForm({
        destination: location,
        country,
        city,
        baseArea,
        arrivalPoint,
        tripSchedule,
        arrivalTime: travelTiming.arrivalTime,
        departureTime: travelTiming.departureTime,
        budget,
        currency,
        budgetIncludes: travelBudgetIncludes,
        peopleCount: people,
        companionType: companion,
        travelIntent,
        travelPurpose,
        customPreferences,
        accommodation,
      }),
    [
      location,
      country,
      city,
      baseArea,
      arrivalPoint,
      tripSchedule,
      travelTiming.arrivalTime,
      travelTiming.departureTime,
      budget,
      currency,
      travelBudgetIncludes,
      people,
      companion,
      travelIntent,
      travelPurpose,
      customPreferences,
      accommodation,
    ],
  );

  const travelValidationMessages = getTravelPlanValidationMessages(travelValidationErrors);

  const handleTravelGenerate = async () => {
    setTravelValidationAttempted(true);

    if (generationInFlightRef.current || isLoading) {
      return;
    }

    if (!isTravelPlanFormValid(travelValidationErrors)) {
      logTravelPlanValidationFailure(travelValidationErrors);
      setError(formatTravelPlanValidationUserMessage(travelValidationErrors));
      return;
    }

    loopTestLogOnce('restore:travelPlanGenerate', 'travel plan generation started');
    logTravelPlanAiAvailability();

    generationInFlightRef.current = true;

    const formState = {
      destination: location,
      country,
      city,
      baseArea,
      arrivalPoint,
      tripSchedule,
      arrivalTime: travelTiming.arrivalTime,
      departureTime: travelTiming.departureTime,
      budget,
      currency,
      budgetIncludes: travelBudgetIncludes,
      peopleCount: people,
      companionType: companion,
      travelIntent,
      travelPurpose,
      customPreferences,
      accommodation,
    };

    const resolvedTravelPurpose = resolveTravelPurpose(formState);

    await showGenerationOverlay();

    const formInput = formState;

    const normalizedState = applyNormalizedTravelPlanFormState(formInput);

    let nextTravelIntent = travelIntent;
    let nextCustomPreferences = normalizedState.customPreferences;
    let nextPurposeId = selectedTravelPurposeId;
    let nextTravelPurpose = travelPurpose ?? resolvedTravelPurpose;

    if (!travelPurpose && !formatCombinedTravelIntent(nextTravelIntent, nextCustomPreferences.customTravelIntent)) {
      nextTravelIntent = '';
      nextCustomPreferences = {
        ...nextCustomPreferences,
        customTravelIntent: 'AIに任せる',
      };
      nextPurposeId = 'ai';
      nextTravelPurpose = 'AIに任せる';
    }

    const nextTravelTiming: TravelTimingSettings = {
      ...travelTiming,
      arrivalTime: normalizedState.arrivalTime,
      departureTime: normalizedState.departureTime,
    };

    const resolvedForSubmit = resolveTravelPlanScheduleFromInput({
      ...formInput,
      destination: normalizedState.location,
      arrivalTime: normalizedState.arrivalTime,
      departureTime: normalizedState.departureTime,
      budget: normalizedState.budget,
      peopleCount: normalizedState.people,
      travelIntent: nextTravelIntent,
      customPreferences: nextCustomPreferences,
      travelPurpose: nextTravelPurpose,
    });

    const nextTripSchedule: TripScheduleEditorValue = {
      ...tripSchedule,
      departureDate: resolvedForSubmit.departureDate,
      returnDate: resolvedForSubmit.returnDate,
      durationPreset: resolvedForSubmit.durationPreset,
      customNights: resolvedForSubmit.customDuration
        ? String(resolvedForSubmit.customDuration.nights)
        : tripSchedule.customNights,
      customDays: resolvedForSubmit.customDuration
        ? String(resolvedForSubmit.customDuration.days)
        : tripSchedule.customDays,
    };

    const nextBudgetScope = travelBudgetIncludesToBudgetScope(travelBudgetIncludes);

    travelSubmitSnapshotRef.current = {
      location: normalizedState.location,
      country: normalizedState.country,
      city: normalizedState.city,
      baseArea: normalizedState.baseArea,
      arrivalPoint: normalizedState.arrivalPoint,
      destinationLabel: normalizedState.destinationLabel,
      budget: normalizedState.budget,
      people: normalizedState.people,
      currency,
      companion: companion!,
      travelTiming: nextTravelTiming,
      travelIntent: nextTravelIntent,
      customPreferences: nextCustomPreferences,
      travelPurpose: nextTravelPurpose,
      tripSchedule: nextTripSchedule,
      budgetScope: nextBudgetScope,
      budgetIncludes: travelBudgetIncludes,
      accommodation: normalizedState.accommodation,
    };

    logTravelPlanSubmitPayload(travelSubmitSnapshotRef.current);
    const formInputForLog = snapshotToTravelPlanFormInput(travelSubmitSnapshotRef.current);
    logTravelPlanSubmitFinalState(formInputForLog);
    logTravelPlanPayloadSafety(formInputForLog);

    setBudgetScope(nextBudgetScope);

    setTripSchedule(nextTripSchedule);

    setLocation(normalizedState.location);
    setCountry(normalizedState.country ?? '');
    setCity(normalizedState.city ?? '');
    setBaseArea(normalizedState.baseArea ?? '');
    setArrivalPoint(normalizedState.arrivalPoint ?? '');
    setAccommodation(normalizedState.accommodation ?? '');
    setBudget(normalizedState.budget);
    setPeople(normalizedState.people);
    setTravelTiming(nextTravelTiming);
    setTravelIntent(nextTravelIntent);
    setCustomPreferences(nextCustomPreferences);
    setSelectedTravelPurposeId(nextPurposeId);
    setTravelPurpose(nextTravelPurpose);
    setError(null);

    try {
      await handleGenerate({ overlayReady: true });
    } catch (error) {
      // Expected AI failures (timeout/502/network/parse) are handled via a dev fallback plan
      // upstream — must stay console.warn, not console.error (red screen in Expo/RN Web).
      if (__DEV__) console.warn('[GenerateButton] error', error);
      if (!isAbortError(error)) {
        logTravelPlanGenerationFailed(error);
        setError(formatPlanGenerationDevError(TRAVEL_PLAN_USER_ERROR, error));
      }
    }
  };

  const renderPlanCreationForm = (sheetScrollRef: RefObject<ScrollView | null>) => {
    if (openedPlanMode === 'travel') {
      if (!LOOP_TEST_RESTORE.travelPlanForm || shouldShowTravelPlanPlaceholder()) {
        return <Text style={styles.travelFormPlaceholder}>Travel Form OK</Text>;
      }

      return (
        <>
          <TravelPlanSheetForm
            country={country}
            onCountryChange={setCountry}
            city={city}
            onCityChange={setCity}
            baseArea={baseArea}
            onBaseAreaChange={setBaseArea}
            accommodation={accommodation}
            onAccommodationChange={setAccommodation}
            arrivalPoint={arrivalPoint}
            onArrivalPointChange={setArrivalPoint}
            tripSchedule={tripSchedule}
            onTripScheduleChange={(next) => {
              setTripSchedule(next);
              if (showItinerary) resetPlan();
            }}
            travelTiming={travelTiming}
            onTravelTimingChange={(next) => {
              setTravelTiming(next);
              if (showItinerary) resetPlan();
            }}
            budget={budget}
            onBudgetChange={setBudget}
            currency={currency}
            onCurrencyChange={setCurrency}
            budgetIncludes={travelBudgetIncludes}
            onBudgetIncludesChange={(next) => {
              setTravelBudgetIncludes(next);
              setBudgetScope(travelBudgetIncludesToBudgetScope(next));
              if (showItinerary) resetPlan();
            }}
            people={people}
            onPeopleChange={setPeople}
            companion={companion}
            onCompanionChange={setCompanion}
            travelIntent={travelIntent}
            onTravelIntentChange={setTravelIntent}
            customPreferences={customPreferences}
            onCustomPreferencesChange={setCustomPreferences}
            selectedPurposeId={selectedTravelPurposeId}
            onPurposeSelect={handleTravelPurposeSelect}
            validationErrors={travelValidationErrors}
            showValidation={travelValidationAttempted}
            isLoading={isLoading}
            error={error}
            onGenerate={handleTravelGenerate}
            validationMessages={travelValidationMessages}
            onRetry={handleTravelGenerate}
            sheetScrollRef={sheetScrollRef}
          />
          {showItinerary && companion && planDetails ? (
            <FadeInView
              key={days.map((day, i) => `${safeKey(day.dayNumber, 'n')}-${safeKey(day.label, `day-${i}`)}`).join('|')}
              delay={100}>
              <ItineraryTimeline
                companion={companion}
                personality={effectivePersonality}
                tripDuration={resolvedSchedule.durationPreset}
                customDuration={resolvedSchedule.customDuration}
                location={location}
                budget={budget}
                currency={currency}
                people={people}
                mood={resolvedMood}
                days={days}
                items={itinerary}
                details={planDetails}
                onRegenerate={handleRegenerate}
                isRegenerating={isLoading}
                planType={planType}
                budgetIncludes={travelBudgetIncludes}
                travelPurpose={travelPurpose ?? undefined}
                onPlanUpdated={(nextDays, nextItems, nextDetails) => {
                  setDays(nextDays);
                  setItinerary(nextItems);
                  setPlanDetails(nextDetails);
                }}
              />
            </FadeInView>
          ) : null}
        </>
      );
    }

    return (
    <>
      {openedPlanMode === 'night' ? (
        <View style={styles.formCard}>
          <AfterPlanLaunchButton location={location.trim() || undefined} />
          <Text style={styles.helperText}>または、日帰りの夜プランを下のフォームで作成</Text>
        </View>
      ) : null}
      <SectionHeader
        title="プランを作る"
        subtitle="行き先と気分を入れて、あなただけの過ごし方を"
      />

      <View style={styles.formCard}>
        <SectionHeader
          step={1}
          title="何を作りますか？"
          subtitle="まずはプランの種類を選んでね"
        />
        <View style={styles.companionGrid}>
          {PLAN_CREATION_TYPES.map((option, index) => (
            <PlanTypeCard
              key={option}
              label={option}
              selected={planType === option}
              onPress={() => handlePlanTypeChange(option)}
              colorIndex={index}
            />
          ))}
        </View>
      </View>

      <View style={styles.formCard}>
      <SectionHeader
        step={2}
        title={LOCATION_FIELD_LABEL}
        subtitle={LOCATION_FIELD_HELPER}
      />
      <FormField
        label={LOCATION_FIELD_LABEL}
        value={location}
        onChangeText={handleLocationChange}
        placeholder={getLocationPlaceholder(planType)}
      />
      <FormField
        label={`${SPOT_INTERESTS_LABEL}（任意）`}
        value={customPreferences.desiredPlaces ?? ''}
        onChangeText={(text) => {
          setCustomPreferences((prev) => ({ ...prev, desiredPlaces: text }));
          if (showItinerary) resetPlan();
        }}
        placeholder={SPOT_INTERESTS_PLACEHOLDER}
      />
      {locationCurrencyHint ? (
        <Text style={styles.locationCurrencyHint}>{locationCurrencyHint}</Text>
      ) : null}
    </View>

    <View style={styles.formCard}>
      <SectionHeader step={3} title="日程・期間" subtitle={scheduleSubtitle} />
      <TripScheduleEditor
        value={tripSchedule}
        onChange={setTripSchedule}
        error={scheduleError}
        compact={isCompactSchedule(planType)}
        onResetPlan={() => {
          if (showItinerary) resetPlan();
        }}
      />
    </View>

    <View style={styles.formCard}>
      <SectionHeader step={4} title="予算・人数" subtitle="ざっくりでOK。あとから調整できます 💰" />
      <CurrencySelector
        selected={currency}
        locationHint={locationCurrencyHint}
        onSelect={(code) => {
          setCurrency(code);
          if (showItinerary) resetPlan();
        }}
      />
      <BudgetField
        currency={currency}
        value={budget}
        onChangeText={setBudget}
      />
      <BudgetScopeEditor
        value={budgetScope}
        onChange={(next) => {
          setBudgetScope(next);
          if (showItinerary) resetPlan();
        }}
      />
      <OutfitStyleModePicker
        value={outfitStyleMode}
        onChange={(next) => {
          setOutfitStyleMode(next);
          if (showItinerary) resetPlan();
        }}
      />
      {planType === '旅行プラン' || planType === '週末プラン' ? (
        <>
          <TravelTimingEditor
            value={travelTiming}
            onChange={(next) => {
              setTravelTiming(next);
              if (showItinerary) resetPlan();
            }}
          />
          <PreTripPlanningSection
            destination={location}
            departureDate={resolvedSchedule.departureDate}
            returnDate={resolvedSchedule.returnDate}
            currencyCode={currency}
          />
        </>
      ) : null}
      <FormField
        label="人数"
        value={people}
        onChangeText={setPeople}
        placeholder="例）2"
        keyboardType="number-pad"
      />
    </View>

    {showsMoodQuestion(planType) ? (
      <View style={styles.companionSection}>
        <SectionHeader title="今日の気分は？" subtitle="ボタン選択に加え、自由入力もできます" />
        <View style={styles.companionGrid}>
          {HOME_MOOD_OPTIONS.map((option, index) => (
            <MoodCard
              key={option}
              label={option}
              selected={mood === option}
              onPress={() => {
                setMood(option);
                if (showItinerary) resetPlan();
              }}
              colorIndex={index}
            />
          ))}
        </View>
        <View style={styles.customPreferencesWrap}>
          <PlanCustomPreferencesFields
            value={customPreferences}
            onChange={(next) => {
              setCustomPreferences(next);
              if (showItinerary) resetPlan();
            }}
            showCustomTravelIntent={false}
            hideDesiredPlaces
          />
        </View>
      </View>
    ) : null}

    {showsTravelIntentQuestion(planType) ? (
      <View style={styles.companionSection}>
        <SectionHeader
          title="どんな旅行にしたいですか？"
          subtitle="旅行の目的に合わせてプランを提案します"
        />
        <View style={styles.companionGrid}>
          {TRAVEL_INTENT_OPTIONS.map((option, index) => (
            <MoodCard
              key={option}
              label={option}
              selected={travelIntent === option}
              onPress={() => handleTravelIntentSelect(option)}
              colorIndex={index}
            />
          ))}
        </View>
        <View style={styles.customPreferencesWrap}>
          <PlanCustomPreferencesFields
            value={customPreferences}
            onChange={(next) => {
              setCustomPreferences(next);
              if (showItinerary) resetPlan();
            }}
            showCustomMood={false}
            showCustomTravelIntent
            hideDesiredPlaces
          />
        </View>
      </View>
    ) : null}

    <View style={styles.companionSection}>
      <SectionHeader title="誰と行く？" subtitle="一緒に行く相手に合わせた提案" />
      <View style={styles.companionGrid}>
        {COMPANION_OPTIONS.map((option, index) => (
          <CompanionCard
            key={option}
            label={option}
            selected={companion === option}
            onPress={() => {
              setCompanion(option);
              if (showItinerary) resetPlan();
            }}
            colorIndex={index}
          />
        ))}
      </View>
    </View>

    {showsPersonalityQuestion(planType) ? (
      <View style={styles.companionSection}>
        <SectionHeader
          title="旅行タイプは？"
          subtitle="おまかせの場合も、参考にしたいスタイルがあれば選んでください"
        />
        <View style={styles.companionGrid}>
          {PERSONALITY_OPTIONS.map((option, index) => (
            <PersonalityCard
              key={option}
              label={option}
              selected={personality === option}
              onPress={() => {
                setPersonality(option);
                if (showItinerary) resetPlan();
              }}
              colorIndex={index}
            />
          ))}
        </View>
      </View>
    ) : null}

    {planType === 'AIに任せる' ? (
      <View style={styles.companionSection}>
        <SectionHeader
          title="行きたい場所・避けたいこと"
          subtitle="任意。入力するとプランに優先的に反映されます"
        />
        <PlanCustomPreferencesFields
          value={customPreferences}
          onChange={(next) => {
            setCustomPreferences(next);
            if (showItinerary) resetPlan();
          }}
          showCustomMood={false}
          showCustomTravelIntent={false}
          hideDesiredPlaces
        />
      </View>
    ) : null}

    <View style={styles.generateButtonWrap}>
      <PrimaryButton
        label={isLoading ? '生成中...' : 'プランを生成'}
        onPress={handleGenerate}
        disabled={!generateReady || isLoading}
      />
    </View>

    {generateHelperText ? (
      <Text style={styles.helperText}>{generateHelperText}</Text>
    ) : null}

    {!isOpenAiConfigured() ? (
      <AppErrorBanner message={APP_MESSAGES.openAiNotConfigured} variant="info" />
    ) : null}

    {error ? (
      <AppErrorBanner message={error} onRetry={handleGenerate} />
    ) : null}

    {saveWarning ? (
      <AppErrorBanner message={saveWarning} variant="info" />
    ) : null}

    {showItinerary && companion && planDetails && (
      <FadeInView
        key={days.map((day, i) => `${safeKey(day.dayNumber, 'n')}-${safeKey(day.label, `day-${i}`)}`).join('|')}
        delay={100}>
        <ItineraryTimeline
          companion={companion}
          personality={effectivePersonality}
          tripDuration={resolvedSchedule.durationPreset}
          customDuration={resolvedSchedule.customDuration}
          location={location}
          budget={budget}
          currency={currency}
          people={people}
          mood={resolvedMood}
          days={days}
          items={itinerary}
          details={planDetails}
          onRegenerate={handleRegenerate}
          isRegenerating={isLoading}
          planType={planType}
          onPlanUpdated={(nextDays, nextItems, nextDetails) => {
            setDays(nextDays);
            setItinerary(nextItems);
            setPlanDetails(nextDetails);
          }}
        />
      </FadeInView>
    )}
    </>
    );
  };

  return (
    <View style={styles.container}>
    <KeyboardAvoidingView
      style={styles.containerInner}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: 0,
            paddingBottom: insets.bottom + BottomTabInset + 120,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}>
        <ReferenceHomeScreen
          renderPlanForm={renderPlanCreationForm}
          onPlanFormOpen={handlePlanFormOpen}
          onPlanFormClose={handlePlanFormClose}
          afterPlanLocation={location.trim() || undefined}
          isPlanGenerating={isLoading}
          generationStepIndex={generationStepIndex}
          onAbortPlanGeneration={handleCancelGeneration}
          travelUserPreferences={null}
        />

      </ScrollView>
    </KeyboardAvoidingView>

    {isLoading && !openedPlanMode ? (
      <PlanGenerationOverlay visible currentStepIndex={generationStepIndex} />
    ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFCF8',
  },
  containerInner: {
    flex: 1,
    backgroundColor: '#FFFCF8',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 0,
    maxWidth: 430,
    width: '100%',
    alignSelf: 'center',
  },
  travelFormPlaceholder: {
    paddingVertical: Spacing.four,
    fontSize: 16,
    fontWeight: '700',
    color: '#64748B',
    textAlign: 'center',
  },
  hero: {
    marginBottom: Spacing.five,
    position: 'relative',
  },
  heroGlow: {
    position: 'absolute',
    top: -20,
    left: -40,
    right: -40,
    height: 180,
    backgroundColor: NS.colors.accentGlow,
    borderRadius: 999,
    transform: [{ scaleX: 1.2 }],
  },
  heroEyebrow: {
    color: accent,
    ...NS.typography.eyebrow,
    marginBottom: Spacing.two,
  },
  title: {
    color: NS.colors.text,
    ...NS.typography.display,
    marginBottom: Spacing.three,
  },
  tagline: {
    color: NS.colors.textSecondary,
    fontSize: 20,
    fontWeight: '500',
    lineHeight: 30,
    letterSpacing: -0.3,
  },
  taglineAccent: {
    color: NS.colors.text,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 32,
    letterSpacing: -0.4,
    marginBottom: Spacing.four,
  },
  featureList: {
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  imafimaCard: {
    marginTop: Spacing.one,
    overflow: 'hidden',
  },
  imafimaGlow: {
    position: 'absolute',
    top: -30,
    right: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: NS.colors.accentSoft,
  },
  imafimaContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  imafimaEmoji: {
    fontSize: 36,
  },
  imafimaTextWrap: {
    flex: 1,
  },
  imafimaTitle: {
    color: NS.colors.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  imafimaSubtitle: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  imafimaArrow: {
    color: accent,
    fontSize: 22,
    fontWeight: '700',
  },
  bestDayCard: {
    marginTop: Spacing.three,
    overflow: 'hidden',
    backgroundColor: NS.colors.bgElevated,
    borderColor: 'rgba(249, 115, 22, 0.25)',
  },
  bestDayGlow: {
    position: 'absolute',
    top: -30,
    right: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
  },
  bestDayContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  bestDayEmoji: {
    fontSize: 36,
  },
  bestDayTextWrap: {
    flex: 1,
  },
  bestDayTitle: {
    color: NS.colors.text,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  bestDaySubtitle: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  bestDayArrow: {
    color: NS.colors.orange,
    fontSize: 22,
    fontWeight: '700',
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.lg - 2,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderWidth: 1,
    borderColor: NS.colors.border,
    ...NS.shadow.card,
  },
  featureIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: NS.colors.accentSoft,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureIcon: {
    fontSize: 22,
  },
  featureTextWrap: {
    flex: 1,
  },
  featureTitle: {
    color: NS.colors.text,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  featureDescription: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  formSectionLabel: {
    marginBottom: Spacing.three,
  },
  formSectionTitle: {
    color: NS.colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  formSectionSubtitle: {
    color: NS.colors.textSecondary,
    fontSize: 14,
    marginTop: 4,
  },
  formCard: {
    backgroundColor: NS.colors.bgElevated,
    borderColor: NS.colors.border,
    borderWidth: 1,
    borderRadius: NS.radius.xxl,
    padding: Spacing.four + 4,
    gap: Spacing.three,
    marginBottom: Spacing.three,
    ...NS.shadow.card,
  },
  field: {
    gap: Spacing.two,
  },
  label: {
    color: NS.colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    backgroundColor: NS.colors.bgInput,
    borderColor: NS.colors.borderStrong,
    borderWidth: 1,
    borderRadius: NS.radius.sm + 2,
    color: NS.colors.text,
    fontSize: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
  },
  dateInput: {
    backgroundColor: NS.colors.bgInput,
    borderColor: NS.colors.borderStrong,
    borderWidth: 1,
    borderRadius: NS.radius.sm + 2,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateInputText: {
    color: NS.colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  dateInputHint: {
    color: NS.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  datePickerDone: {
    alignSelf: 'flex-end',
    marginTop: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  datePickerDoneText: {
    color: NS.colors.accent,
    fontSize: 15,
    fontWeight: '700',
  },
  currencyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  currencyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: NS.radius.pill,
    backgroundColor: NS.colors.bgInput,
    borderWidth: 1.5,
    borderColor: NS.colors.borderStrong,
  },
  currencyChipSelected: {
    backgroundColor: NS.colors.accentSoft,
    borderColor: NS.colors.accent,
  },
  currencyCode: {
    color: NS.colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  currencyCodeSelected: {
    color: NS.colors.text,
  },
  currencyAutoHint: {
    color: accent,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: Spacing.two,
  },
  fieldHint: {
    color: NS.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: Spacing.one,
  },
  locationCurrencyHint: {
    color: accent,
    fontSize: 13,
    fontWeight: '600',
    marginTop: -Spacing.two,
    marginBottom: Spacing.three,
  },
  currencySymbol: {
    color: NS.colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  currencySymbolSelected: {
    color: accent,
  },
  budgetInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: NS.colors.bgInput,
    borderColor: NS.colors.borderStrong,
    borderWidth: 1,
    borderRadius: NS.radius.sm + 2,
    paddingLeft: Spacing.three,
  },
  budgetPrefix: {
    color: accent,
    fontSize: 17,
    fontWeight: '700',
    marginRight: Spacing.two,
  },
  budgetInput: {
    flex: 1,
    color: NS.colors.text,
    fontSize: 16,
    paddingVertical: 14,
    paddingRight: Spacing.three,
  },
  companionSection: {
    marginTop: NS.layout.sectionGap,
  },
  customPreferencesWrap: {
    marginTop: Spacing.three,
  },
  generateButtonWrap: {
    marginTop: NS.layout.sectionGap,
  },
  companionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: Spacing.two,
  },
  afterPlanBannerWrap: {
    marginTop: Spacing.three,
  },
  companionCard: {
    width: '48%',
    backgroundColor: NS.colors.bgElevated,
    borderColor: NS.colors.border,
    borderWidth: 1,
    borderRadius: NS.radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  companionCardSelected: {
    backgroundColor: NS.colors.accentSoft,
    borderColor: NS.colors.accent,
  },
  companionCardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  companionLabel: {
    color: NS.colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  companionLabelSelected: {
    color: NS.colors.text,
    fontWeight: '700',
  },
  companionCheck: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: accent,
  },
  button: {
    marginTop: Spacing.four,
    backgroundColor: accent,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    backgroundColor: NS.colors.borderStrong,
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  helperText: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    marginTop: Spacing.two,
    lineHeight: 20,
  },
  errorText: {
    color: '#F87171',
    fontSize: 13,
    textAlign: 'center',
    marginTop: Spacing.two,
    lineHeight: 20,
  },
  itinerarySection: {
    marginTop: Spacing.five,
    backgroundColor: NS.colors.bgElevated,
    borderColor: NS.colors.accentBorder,
    borderWidth: 1,
    borderRadius: NS.radius.xxl,
    padding: Spacing.four,
    ...NS.shadow.cardLg,
  },
  confirmButtonWrap: {
    marginTop: Spacing.two,
  },
  saveButtonWrap: {
    marginTop: Spacing.two,
  },
  shareButtonWrap: {
    marginTop: Spacing.two,
  },
  regenerateButtonWrap: {
    marginTop: Spacing.four,
  },
  itinerarySectionPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  itineraryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.four,
  },
  itineraryHeaderText: {
    flex: 1,
    paddingRight: Spacing.two,
  },
  itineraryEyebrow: {
    color: accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  itineraryTitle: {
    color: NS.colors.text,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  itinerarySubtitle: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
  },
  itineraryCompanionNote: {
    color: NS.colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
    opacity: 0.85,
  },
  personalityBadge: {
    alignSelf: 'flex-start',
    backgroundColor: NS.colors.purpleSoft,
    borderRadius: NS.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.35)',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  durationBadge: {
    backgroundColor: NS.colors.bgCard,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: NS.colors.border,
  },
  durationBadgeText: {
    color: NS.colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  personalityBadgeText: {
    color: accent,
    fontSize: 12,
    fontWeight: '700',
  },
  budgetPill: {
    marginTop: Spacing.two,
    alignSelf: 'flex-start',
    backgroundColor: NS.colors.mintSoft,
    borderRadius: NS.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.28)',
  },
  budgetPillLabel: {
    color: NS.colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  budgetPillValue: {
    color: NS.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  plannerMessageBox: {
    marginTop: Spacing.two,
    backgroundColor: NS.colors.skySoft,
    borderRadius: NS.radius.md - 2,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.28)',
  },
  plannerMessageLabel: {
    color: accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  plannerMessageText: {
    color: NS.colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  itineraryBadge: {
    backgroundColor: NS.colors.accentSoft,
    borderRadius: NS.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
  },
  itineraryBadgeText: {
    color: accent,
    fontSize: 12,
    fontWeight: '700',
  },
  timelineList: {
    paddingTop: Spacing.one,
  },
  detailHint: {
    marginTop: Spacing.four,
    paddingTop: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: NS.colors.border,
    alignItems: 'center',
  },
  detailHintText: {
    color: accent,
    fontSize: 14,
    fontWeight: '600',
  },
  reasonsSection: {
    marginTop: Spacing.four,
    paddingTop: Spacing.four,
    borderTopWidth: 1,
    borderTopColor: NS.colors.border,
  },
  reasonsTitle: {
    color: NS.colors.text,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: Spacing.three,
    letterSpacing: -0.2,
  },
  reasonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: Spacing.two,
  },
  reasonCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: NS.colors.bgCard,
    borderRadius: NS.radius.md,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: NS.colors.border,
    ...NS.shadow.card,
  },
  reasonCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: NS.colors.mintSoft,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reasonCheckIcon: {
    color: accent,
    fontSize: 13,
    fontWeight: '700',
  },
  reasonText: {
    flex: 1,
    color: NS.colors.text,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  confirmButton: {
    marginTop: Spacing.four,
    backgroundColor: NS.colors.mint,
    borderRadius: NS.radius.md,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: NS.colors.mint,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  confirmButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  confirmButtonText: {
    color: NS.colors.textOnAccent,
    fontSize: 17,
    fontWeight: '800',
  },
});
