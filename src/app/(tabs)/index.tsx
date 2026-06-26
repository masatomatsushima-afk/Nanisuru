import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { APP_MESSAGES, getPlanGenerationErrorMessage, isSupabaseError } from '@/lib/app-errors';
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
import { buildLocationCurrencyHint, inferCurrencyFromLocation } from '@/lib/location-currency';
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
  PlanLoadingScreen,
  createPlanGenerationProgress,
  isAbortError,
  type PlanGenerationProgressHandle,
  type PlanLoadingUiState,
} from '@/components/plan-loading-screen';
import { PLAN_LOADING_STAGES } from '@/lib/plan-generation-progress';
import { PlacesNoticeBanner } from '@/components/places-notice-banner';
import { WeatherSection } from '@/components/weather-section';
import { TravelMemoryHomeCard } from '@/components/travel-memory-home-card';
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
  syncScheduleOnPresetChange,
  validateTripSchedule,
} from '@/lib/trip-schedule';
import {
  getAverageBudgetAmount,
  getUserPreferences,
  recordPlanPreferences,
} from '@/lib/user-memory';
import type { UserPreferences } from '@/types/user-memory';
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
import type { ItineraryEditTarget, PartialItineraryEditResult } from '@/types/itinerary-edit';
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
import { ScreenBackground } from '@/components/ui/screen-background';
import { HomeHeroSection } from '@/components/home-hero-section';

const accent = NS.colors.accent;

const RECOMMEND_REASONS = [
  '雨の日でも楽しめる',
  '初デートで会話しやすい',
  '予算内に収まる',
  '移動時間が少ない',
] as const;

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

function RecommendReasonsSection() {
  return (
    <View style={styles.reasonsSection}>
      <Text style={styles.reasonsTitle}>おすすめ理由</Text>
      <View style={styles.reasonsGrid}>
        {RECOMMEND_REASONS.map((reason) => (
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
}) {
  const [showSuccess, setShowSuccess] = useState(false);
  const [savedTripId, setSavedTripId] = useState<string | null>(null);
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
  };

  const handleApplyEdit = async (result: PartialItineraryEditResult, _editRequest: string) => {
    const nextPayload = applyPartialEditResult(editPayload, result);
    onPlanUpdated?.(nextPayload.days, nextPayload.items, nextPayload.details);
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
    if (pendingRatingId) {
      void linkPlanRatingToTrip(pendingRatingId, trip.id);
    }
  };

  const planParams = {
    location,
    budget,
    currency,
    people,
    mood,
    companion,
    personality,
    tripDuration,
    days: JSON.stringify(days),
    items: JSON.stringify(items),
    details: JSON.stringify(details),
  };

  const openDetail = () => {
    router.push({
      pathname: '/plan-detail',
      params: planParams,
    });
  };

  const handleConfirm = () => {
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      router.push({
        pathname: '/today-schedule',
        params: planParams,
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
                <WeatherSection weather={details.weather} compact />
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

        <RecommendReasonsSection />

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

const INITIAL_LOADING_UI: PlanLoadingUiState = {
  step: 0,
  progress: 0,
  headline: 'プランを作成中です',
  estimateLabel: '完成まで約30秒かかります',
  remainingLabel: '準備中…',
  statusHint: PLAN_LOADING_STAGES[0].hint,
  isLongRunning: false,
  showMultiDayNote: false,
};

export default function HomeScreen() {
  const [planType, setPlanType] = useState<PlanCreationType>('今日のお出かけ');
  const [location, setLocation] = useState('');
  const [tripSchedule, setTripSchedule] = useState<TripScheduleEditorValue>(() =>
    applyPlanTypeDefaults('今日のお出かけ', createDefaultTripSchedule()),
  );
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [budget, setBudget] = useState('');
  const [budgetScope, setBudgetScope] = useState<BudgetScopeSettings>(() =>
    createDefaultBudgetScope('今日のお出かけ'),
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
  const [loadingUiState, setLoadingUiState] = useState<PlanLoadingUiState>(INITIAL_LOADING_UI);
  const [error, setError] = useState<string | null>(null);
  const [saveWarning, setSaveWarning] = useState<string | null>(null);
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null);
  const [travelMemories, setTravelMemories] = useState<import('@/types/travel-memory').TravelMemory[]>([]);
  const [isMemoryLoading, setIsMemoryLoading] = useState(false);
  const insets = useSafeAreaInsets();
  const generationAbortRef = useRef<AbortController | null>(null);
  const progressHandleRef = useRef<PlanGenerationProgressHandle | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const formAnchorY = useRef(0);

  const stopGenerationProgress = () => {
    progressHandleRef.current?.stop();
    progressHandleRef.current = null;
    generationAbortRef.current = null;
  };

  const handleCancelGeneration = () => {
    generationAbortRef.current?.abort();
    stopGenerationProgress();
    setIsLoading(false);
    setLoadingUiState(INITIAL_LOADING_UI);
  };

  const refreshUserPreferences = useCallback(async () => {
    setUserPreferences(await getUserPreferences());
  }, []);

  const refreshTravelMemories = useCallback(async () => {
    setIsMemoryLoading(true);
    try {
      setTravelMemories(await getTravelMemories());
    } catch {
      setTravelMemories([]);
    } finally {
      setIsMemoryLoading(false);
    }
  }, []);

  const refreshMemorySummary = useCallback(async () => {
    await Promise.all([refreshUserPreferences(), refreshTravelMemories()]);
  }, [refreshTravelMemories, refreshUserPreferences]);

  const memoryDisplay = useMemo(() => {
    if (!userPreferences) return null;
    return buildTravelMemoryDisplayData({
      preferences: userPreferences,
      memories: travelMemories,
    });
  }, [travelMemories, userPreferences]);

  useEffect(() => {
    const loadDefaults = async () => {
      const [preferredPersonality, prefs, averageBudget] = await Promise.all([
        getPreferredPersonality(),
        getUserPreferences(),
        getAverageBudgetAmount(),
      ]);

      setUserPreferences(prefs);
      void refreshTravelMemories();

      if (prefs.favoriteTravelStyle) {
        setPersonality(prefs.favoriteTravelStyle);
      } else if (preferredPersonality) {
        setPersonality(preferredPersonality);
      }

      if (prefs.preferredTripDuration) {
        setTripSchedule((prev) => syncScheduleOnPresetChange(prev, prefs.preferredTripDuration!));
      }

      if (averageBudget && !budget) {
        setBudget(String(averageBudget.amount));
        setCurrency(averageBudget.currency);
      }
    };

    loadDefaults();
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

  useEffect(() => {
    const trimmed = location.trim();
    if (!trimmed) return;
    setCurrency(inferCurrencyFromLocation(trimmed));
  }, [location]);

  const locationCurrencyHint = buildLocationCurrencyHint(location);

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

  const handleHomePrimaryPress = () => {
    handlePlanTypeChange('今日のお出かけ');
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(formAnchorY.current - Spacing.four, 0),
        animated: true,
      });
    });
  };

  const handleTravelPressFromHero = () => {
    handlePlanTypeChange('旅行プラン');
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(formAnchorY.current - Spacing.four, 0),
        animated: true,
      });
    });
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
    if (!companion) throw new Error('Companion not selected');

    const resolvedPersonality = resolvePersonalityForPlan({
      planType,
      personality,
      travelIntent,
    });

    const scheduleValidation = validateTripSchedule(tripSchedule);
    if (scheduleValidation) {
      throw new Error(scheduleValidation);
    }

    const travelPurpose = formatCombinedTravelIntent(
      travelIntent,
      customPreferences.customTravelIntent,
    );

    const plan = await generatePlanWithAi({
      location,
      budget,
      currency,
      people,
      companion,
      personality: resolvedPersonality,
      tripDuration: resolvedSchedule.durationPreset,
      tripDate: resolvedSchedule.departureDate,
      tripEndDate: resolvedSchedule.returnDate,
      customDuration: resolvedSchedule.customDuration,
      mood: showsTravelIntentQuestion(planType) ? '' : mood,
      travelIntent: showsTravelIntentQuestion(planType) ? travelIntent : '',
      travelPurpose,
      planCreationType: planType,
      planType,
      departureDate: resolvedSchedule.departureDate,
      returnDate: resolvedSchedule.returnDate,
      durationLabel: resolvedSchedule.durationLabel,
      companionType: companion,
      mustVisitPlaces: customPreferences.desiredPlaces,
      avoidPreferences: customPreferences.avoidPreferences,
      budgetScope,
      customPreferences,
      avoidActivities,
      abortSignal: signal,
      travelTiming:
        planType === '旅行プラン' || planType === '週末プラン' ? travelTiming : undefined,
      outfitStyleMode,
    });
    return { days: plan.days, items: plan.items, details: plan.details };
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

  const handleGenerate = async () => {
    if (
      !canGeneratePlan({
        planType,
        companion,
        personality,
        mood,
        travelIntent,
        customPreferences,
      }) ||
      isLoading
    ) {
      return;
    }

    const scheduleValidation = validateTripSchedule(tripSchedule);
    if (scheduleValidation) {
      setScheduleError(scheduleValidation);
      return;
    }

    setScheduleError(null);
    setIsLoading(true);
    setError(null);
    setSaveWarning(null);
    setShowItinerary(false);

    const abortController = new AbortController();
    generationAbortRef.current = abortController;
    const progress = createPlanGenerationProgress({
      tripDuration: resolvedSchedule.durationPreset,
      customDuration: resolvedSchedule.customDuration,
      durationLabel: resolvedSchedule.durationLabel,
      onUpdate: (state) => {
        setLoadingUiState(state);
      },
    });
    progressHandleRef.current = progress;
    progress.start();

    try {
      const plan = await fetchPlan(undefined, abortController.signal);
      progress.complete();

      setDays(plan.days);
      setItinerary(plan.items);
      setPlanDetails(plan.details);
      setShowItinerary(true);

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
    } catch (err) {
      if (isAbortError(err)) {
        return;
      }
      logPlanGenerationError('generate_plan', err);
      setError(getPlanGenerationErrorMessage(err));
      setShowItinerary(false);
    } finally {
      stopGenerationProgress();
      setIsLoading(false);
      setLoadingUiState(INITIAL_LOADING_UI);
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
      days.length === 0
    ) {
      return;
    }

    const scheduleValidation = validateTripSchedule(tripSchedule);
    if (scheduleValidation) {
      setScheduleError(scheduleValidation);
      return;
    }

    setScheduleError(null);
    setIsLoading(true);
    setError(null);
    setSaveWarning(null);

    const avoidActivities = getAllActivities(days);
    const abortController = new AbortController();
    generationAbortRef.current = abortController;
    const progress = createPlanGenerationProgress({
      tripDuration: resolvedSchedule.durationPreset,
      customDuration: resolvedSchedule.customDuration,
      durationLabel: resolvedSchedule.durationLabel,
      onUpdate: (state) => {
        setLoadingUiState(state);
      },
    });
    progressHandleRef.current = progress;
    progress.start();

    try {
      const plan = await fetchPlan(avoidActivities, abortController.signal);
      progress.complete();

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
      setIsLoading(false);
      setLoadingUiState(INITIAL_LOADING_UI);
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

  return (
    <ScreenBackground>
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <PlanLoadingScreen
        visible={isLoading}
        uiState={loadingUiState}
        onCancel={handleCancelGeneration}
      />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + Spacing.four,
            paddingBottom: insets.bottom + BottomTabInset + Spacing.five,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <HomeHeroSection
          onPrimaryPress={handleHomePrimaryPress}
          onTravelPress={handleTravelPressFromHero}
          afterPlanLocation={location.trim() || undefined}
        />

        {userPreferences && memoryDisplay ? (
          <FadeInView delay={40}>
            <TravelMemoryHomeCard
              preferenceChips={memoryDisplay.preferenceChips}
              placeChips={memoryDisplay.placeChips}
              totalPlaceCount={memoryDisplay.totalPlaceCount}
              hasMemory={memoryDisplay.hasMemory}
              isLoading={isMemoryLoading}
            />
          </FadeInView>
        ) : null}

        <View
          onLayout={(event) => {
            formAnchorY.current = event.nativeEvent.layout.y;
          }}>
          <SectionHeader
            title="プランを作る"
            subtitle="行き先や気分を入れるだけ。あとはお任せ"
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
            key={days.map((day) => `${day.dayNumber}-${day.label}`).join('|')}
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
      </ScrollView>
    </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.four,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
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
