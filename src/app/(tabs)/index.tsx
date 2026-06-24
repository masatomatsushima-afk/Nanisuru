import { router } from 'expo-router';
import { useEffect, useState } from 'react';
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
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset, Colors, Spacing } from '@/constants/theme';
import {
  CURRENCY_OPTIONS,
  getBudgetPlaceholder,
  getCurrency,
  type CurrencyCode,
} from '@/constants/currency';
import { AppErrorBanner } from '@/components/app-error-banner';
import { APP_MESSAGES, getErrorMessage } from '@/lib/app-errors';
import { linkPlanRatingToTrip } from '@/lib/plan-rating';
import { formatCombinedMood } from '@/lib/custom-preferences';
import { buildLocationCurrencyHint, inferCurrencyFromLocation } from '@/lib/location-currency';
import { SuccessOverlay } from '@/components/success-overlay';
import { AiAdviceSection } from '@/components/ai-advice-section';
import { BudgetBreakdownSection } from '@/components/budget-breakdown-section';
import { ConciergeAccessSection } from '@/components/concierge-access-section';
import { ConciergeAnalysisSection } from '@/components/concierge-analysis-section';
import { ShareTripButton } from '@/components/share-trip-button';
import { SaveTripButton } from '@/components/save-trip-button';
import { PlanRatingSection } from '@/components/plan-rating-section';
import { ItineraryDaysView } from '@/components/itinerary-days-view';
import { CurrentLocationButton } from '@/components/current-location-button';
import { PlanCustomPreferencesFields } from '@/components/plan-custom-preferences-fields';
import { PlanLoadingScreen, runLoadingAnimation } from '@/components/plan-loading-screen';
import { PlacesNoticeBanner } from '@/components/places-notice-banner';
import { WeatherSection } from '@/components/weather-section';
import { UserPreferencesSection } from '@/components/user-preferences-section';
import { FadeInView } from '@/components/ui/fade-in-view';
import { PrimaryButton, PremiumCard, SectionHeader, SelectChip } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { generatePlanWithAi, isOpenAiConfigured } from '@/lib/generate-plan';
import { buildActiveTripContext, saveActiveTrip } from '@/lib/active-trip';
import { COMPANION_SUBTITLES, getItineraryEyebrow, PERSONALITY_SUBTITLES } from '@/lib/itineraries';
import { getPreferredPersonality } from '@/lib/onboarding-storage';
import { getAllActivities } from '@/lib/trip-duration';
import { getDurationBadgeLabel } from '@/lib/trip-duration';
import { formatIsoDate, formatTripDateLabel, getTodayIsoDate } from '@/lib/weather';
import {
  getAverageBudgetAmount,
  getUserPreferences,
  recordPlanPreferences,
} from '@/lib/user-memory';
import type { UserPreferences } from '@/types/user-memory';
import type { PlanRatingContext } from '@/types/plan-rating';
import type { PlanCustomPreferences } from '@/types/plan-preferences';
import { HOME_MOOD_OPTIONS, type HomeMoodOption } from '@/types/plan-preferences';
import type { SavedTrip } from '@/types/trip';
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
  TRIP_DURATION_OPTIONS,
} from '@/types/plan';

const theme = Colors.dark;
const accent = NS.colors.accent;

const RECOMMEND_REASONS = [
  '雨の日でも楽しめる',
  '初デートで会話しやすい',
  '予算内に収まる',
  '移動時間が少ない',
] as const;

const FEATURE_CARDS = [
  { icon: '📍', title: '場所選び不要', description: 'エリアを入力するだけ' },
  { icon: '🗓️', title: '1日まるごと提案', description: '朝から夜まで完結' },
  { icon: '🤖', title: 'AIコンシェルジュ付き', description: '天気変更にも対応' },
] as const;

function FeatureCard({ icon, title, description }: (typeof FEATURE_CARDS)[number]) {
  return (
    <View style={styles.featureCard}>
      <View style={styles.featureIconWrap}>
        <Text style={styles.featureIcon}>{icon}</Text>
      </View>
      <View style={styles.featureTextWrap}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDescription}>{description}</Text>
      </View>
    </View>
  );
}

function HeroSection() {
  return (
    <FadeInView>
      <View style={styles.hero}>
        <View style={styles.heroGlow} />
        <Text style={styles.heroEyebrow}>AI DAY PLANNER</Text>
        <Text style={styles.title}>Nanisuru</Text>
        <Text style={styles.tagline}>考えなくていい。</Text>
        <Text style={styles.taglineAccent}>最高の1日をAIが作る。</Text>

        <View style={styles.featureList}>
          {FEATURE_CARDS.map((feature, index) => (
            <FadeInView key={feature.title} delay={index * 80} direction="down">
              <FeatureCard {...feature} />
            </FadeInView>
          ))}
        </View>

        <FadeInView delay={280}>
          <PremiumCard
            variant="accent"
            style={styles.imafimaCard}
            onPress={() => router.push('/imafima')}>
            <View style={styles.imafimaGlow} />
            <View style={styles.imafimaContent}>
              <Text style={styles.imafimaEmoji}>⚡</Text>
              <View style={styles.imafimaTextWrap}>
                <Text style={styles.imafimaTitle}>今暇</Text>
                <Text style={styles.imafimaSubtitle}>今から出かける！即興プランをAIが作成</Text>
              </View>
              <Text style={styles.imafimaArrow}>→</Text>
            </View>
          </PremiumCard>
        </FadeInView>

        <FadeInView delay={320}>
          <PremiumCard style={styles.bestDayCard} onPress={() => router.push('/best-day')}>
            <View style={styles.bestDayGlow} />
            <View style={styles.bestDayContent}>
              <Text style={styles.bestDayEmoji}>🔥</Text>
              <View style={styles.bestDayTextWrap}>
                <Text style={styles.bestDayTitle}>最高の1日</Text>
                <Text style={styles.bestDaySubtitle}>
                  計画は不要。AIコンシェルジュが最高の1日を設計
                </Text>
              </View>
              <Text style={styles.bestDayArrow}>→</Text>
            </View>
          </PremiumCard>
        </FadeInView>
      </View>
    </FadeInView>
  );
}

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
}: {
  companion: CompanionOption;
  personality: PersonalityOption;
  tripDuration: TripDurationOption;
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
}) {
  const [showSuccess, setShowSuccess] = useState(false);
  const [savedTripId, setSavedTripId] = useState<string | null>(null);
  const [pendingRatingId, setPendingRatingId] = useState<string | null>(null);

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
                  <Text style={styles.durationBadgeText}>{getDurationBadgeLabel(tripDuration)}</Text>
                </View>
              </View>
              <Text style={styles.itinerarySubtitle}>{PERSONALITY_SUBTITLES[personality]}</Text>
              <Text style={styles.itineraryCompanionNote}>{COMPANION_SUBTITLES[companion]}</Text>
              {details.weather ? (
                <WeatherSection weather={details.weather} compact />
              ) : null}
              {details.placesNotice ? (
                <PlacesNoticeBanner message={details.placesNotice} />
              ) : null}
              {details.budgetBreakdown ? (
                <BudgetBreakdownSection breakdown={details.budgetBreakdown} compact />
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
            <CurrentLocationButton compact />
            <ItineraryDaysView days={days} variant="timeline" location={location} />
          </View>

          <View style={styles.detailHint}>
            <Text style={styles.detailHintText}>タップしてプラン詳細を見る →</Text>
          </View>
        </Pressable>

        <ConciergeAccessSection days={days} location={location} compact />

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
            days={days}
            items={items}
            details={details}
          />
        </View>

        <View style={styles.confirmButtonWrap}>
          <PrimaryButton label="このプランで決定" onPress={handleConfirm} variant="secondary" />
        </View>
      </View>
    </>
  );
}

type FormFieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'numeric' | 'number-pad';
};

function TripDateField({
  isoDate,
  onChange,
  onResetPlan,
}: {
  isoDate: string;
  onChange: (date: string) => void;
  onResetPlan?: () => void;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const dateValue = new Date(`${isoDate}T12:00:00`);
  const label = formatTripDateLabel(isoDate);

  const handleChange = (nextDate: Date) => {
    onChange(formatIsoDate(nextDate));
    onResetPlan?.();
  };

  if (Platform.OS === 'web') {
    return (
      <FormField
        label="出発日"
        value={isoDate}
        onChangeText={(text) => {
          if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
            onChange(text);
            onResetPlan?.();
          }
        }}
        placeholder="YYYY-MM-DD"
      />
    );
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>出発日</Text>
      <Pressable style={styles.dateInput} onPress={() => setShowPicker(true)}>
        <Text style={styles.dateInputText}>{label}</Text>
        <Text style={styles.dateInputHint}>タップして変更</Text>
      </Pressable>
      {showPicker ? (
        <DateTimePicker
          value={dateValue}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={new Date()}
          locale="ja-JP"
          onChange={(event, selectedDate) => {
            if (Platform.OS === 'android') setShowPicker(false);
            if (event.type === 'dismissed') {
              setShowPicker(false);
              return;
            }
            if (selectedDate) handleChange(selectedDate);
          }}
        />
      ) : null}
      {Platform.OS === 'ios' && showPicker ? (
        <Pressable style={styles.datePickerDone} onPress={() => setShowPicker(false)}>
          <Text style={styles.datePickerDoneText}>完了</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function FormField({ label, value, onChangeText, placeholder, keyboardType = 'default' }: FormFieldProps) {
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
}: {
  label: CompanionOption;
  selected: boolean;
  onPress: () => void;
}) {
  return <SelectChip label={label} selected={selected} onPress={onPress} />;
}

function PersonalityCard({
  label,
  selected,
  onPress,
}: {
  label: PersonalityOption;
  selected: boolean;
  onPress: () => void;
}) {
  return <SelectChip label={label} selected={selected} onPress={onPress} />;
}

function MoodCard({
  label,
  selected,
  onPress,
}: {
  label: HomeMoodOption;
  selected: boolean;
  onPress: () => void;
}) {
  return <SelectChip label={label} selected={selected} onPress={onPress} />;
}

function DurationCard({
  label,
  selected,
  onPress,
}: {
  label: TripDurationOption;
  selected: boolean;
  onPress: () => void;
}) {
  return <SelectChip label={label} selected={selected} onPress={onPress} />;
}

export default function HomeScreen() {
  const [location, setLocation] = useState('');
  const [tripDate, setTripDate] = useState(getTodayIsoDate());
  const [budget, setBudget] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('JPY');
  const [people, setPeople] = useState('');
  const [mood, setMood] = useState<HomeMoodOption | ''>('');
  const [customPreferences, setCustomPreferences] = useState<PlanCustomPreferences>({});
  const [companion, setCompanion] = useState<CompanionOption | null>(null);
  const [personality, setPersonality] = useState<PersonalityOption | null>(null);
  const [tripDuration, setTripDuration] = useState<TripDurationOption>('1日');
  const [showItinerary, setShowItinerary] = useState(false);
  const [days, setDays] = useState<ItineraryDay[]>([]);
  const [itinerary, setItinerary] = useState<ItineraryItem[]>([]);
  const [planDetails, setPlanDetails] = useState<PlanDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null);
  const insets = useSafeAreaInsets();

  const refreshUserPreferences = async () => {
    setUserPreferences(await getUserPreferences());
  };

  useEffect(() => {
    const loadDefaults = async () => {
      const [preferredPersonality, prefs, averageBudget] = await Promise.all([
        getPreferredPersonality(),
        getUserPreferences(),
        getAverageBudgetAmount(),
      ]);

      setUserPreferences(prefs);

      if (prefs.favoriteTravelStyle) {
        setPersonality(prefs.favoriteTravelStyle);
      } else if (preferredPersonality) {
        setPersonality(preferredPersonality);
      }

      if (prefs.preferredTripDuration) {
        setTripDuration(prefs.preferredTripDuration);
      }

      if (averageBudget && !budget) {
        setBudget(String(averageBudget.amount));
        setCurrency(averageBudget.currency);
      }
    };

    loadDefaults();
  }, []);

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
    setLoadingStep(0);
  };

  const fetchPlan = async (avoidActivities?: string[]) => {
    if (!companion) throw new Error('Companion not selected');
    if (!personality) throw new Error('Personality not selected');

    const plan = await generatePlanWithAi({
      location,
      budget,
      currency,
      people,
      companion,
      personality,
      tripDuration,
      tripDate,
      mood,
      customPreferences,
      avoidActivities,
    });
    return { days: plan.days, items: plan.items, details: plan.details };
  };

  const syncActiveTrip = async (plan: {
    days: ItineraryDay[];
    details: PlanDetails;
  }) => {
    if (!companion || !personality) return;

    await saveActiveTrip(
      buildActiveTripContext({
        location,
        budget,
        currency,
        people,
        mood: formatCombinedMood(mood, customPreferences.customMood),
        companion,
        personality,
        tripDuration,
        days: plan.days,
        details: plan.details,
      }),
    );
  };

  const learnFromPlan = async (plan: {
    days: ItineraryDay[];
    items: ItineraryItem[];
  }) => {
    if (!personality) return;

    await recordPlanPreferences({
      personality,
      tripDuration,
      budget,
      currency,
      activities: getAllActivities(plan.days),
    });
    await refreshUserPreferences();
  };

  const handleGenerate = async () => {
    if (!companion || !personality || isLoading) return;

    setIsLoading(true);
    setLoadingStep(0);
    setError(null);
    setShowItinerary(false);

    try {
      const [plan] = await Promise.all([fetchPlan(), runLoadingAnimation(setLoadingStep)]);

      setDays(plan.days);
      setItinerary(plan.items);
      setPlanDetails(plan.details);
      setShowItinerary(true);
      await Promise.all([learnFromPlan(plan), syncActiveTrip(plan)]);
    } catch (err) {
      setError(getErrorMessage(err));
      setShowItinerary(false);
    } finally {
      setIsLoading(false);
      setLoadingStep(0);
    }
  };

  const handleRegenerate = async () => {
    if (!companion || !personality || isLoading || days.length === 0) return;

    setIsLoading(true);
    setLoadingStep(0);
    setError(null);

    const avoidActivities = getAllActivities(days);

    try {
      const [plan] = await Promise.all([
        fetchPlan(avoidActivities),
        runLoadingAnimation(setLoadingStep),
      ]);

      setDays(plan.days);
      setItinerary(plan.items);
      setPlanDetails(plan.details);
      setShowItinerary(true);
      await Promise.all([learnFromPlan(plan), syncActiveTrip(plan)]);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
      setLoadingStep(0);
    }
  };

  const handleLocationChange = (text: string) => {
    setLocation(text);
    if (showItinerary) resetPlan();
  };

  const resolvedMood = formatCombinedMood(mood, customPreferences.customMood);
  const hasMoodSelection = Boolean(resolvedMood);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <PlanLoadingScreen visible={isLoading} currentStep={loadingStep} />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + Spacing.four,
            paddingBottom: insets.bottom + BottomTabInset + Spacing.five,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <HeroSection />

        {userPreferences ? (
          <FadeInView delay={40}>
            <UserPreferencesSection preferences={userPreferences} compact />
          </FadeInView>
        ) : null}

        <SectionHeader
          title="プランを生成"
          subtitle="条件を入力して、AIがあなただけの1日を提案"
        />

        <View style={styles.formCard}>
          <FormField
            label="場所"
            value={location}
            onChangeText={handleLocationChange}
            placeholder="例）東京・Melbourne・Seoul"
          />
          {locationCurrencyHint ? (
            <Text style={styles.locationCurrencyHint}>{locationCurrencyHint}</Text>
          ) : null}
          <TripDateField
            isoDate={tripDate}
            onChange={setTripDate}
            onResetPlan={() => {
              if (showItinerary) resetPlan();
            }}
          />
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
          <FormField
            label="人数"
            value={people}
            onChangeText={setPeople}
            placeholder="例）2"
            keyboardType="number-pad"
          />
        </View>

        <View style={styles.companionSection}>
          <SectionHeader title="今日の気分は？" subtitle="ボタン選択に加え、自由入力もできます" />
          <View style={styles.companionGrid}>
            {HOME_MOOD_OPTIONS.map((option) => (
              <MoodCard
                key={option}
                label={option}
                selected={mood === option}
                onPress={() => {
                  setMood(option);
                  if (showItinerary) resetPlan();
                }}
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
            />
          </View>
        </View>

        <View style={styles.companionSection}>
          <SectionHeader title="期間は？" subtitle="旅行の長さに合わせてプランを作成" />
          <View style={styles.companionGrid}>
            {TRIP_DURATION_OPTIONS.map((option) => (
              <DurationCard
                key={option}
                label={option}
                selected={tripDuration === option}
                onPress={() => {
                  setTripDuration(option);
                  if (showItinerary) resetPlan();
                }}
              />
            ))}
          </View>
        </View>

        <View style={styles.companionSection}>
          <SectionHeader title="旅行タイプは？" subtitle="あなたの好みに合わせてプランを提案" />
          <View style={styles.companionGrid}>
            {PERSONALITY_OPTIONS.map((option) => (
              <PersonalityCard
                key={option}
                label={option}
                selected={personality === option}
                onPress={() => {
                  setPersonality(option);
                  if (showItinerary) resetPlan();
                }}
              />
            ))}
          </View>
        </View>

        <View style={styles.companionSection}>
          <SectionHeader title="誰と行く？" subtitle="一緒に行く相手に合わせた提案" />
          <View style={styles.companionGrid}>
            {COMPANION_OPTIONS.map((option) => (
              <CompanionCard
                key={option}
                label={option}
                selected={companion === option}
                onPress={() => {
                  setCompanion(option);
                  if (showItinerary) resetPlan();
                }}
              />
            ))}
          </View>
        </View>

        <View style={styles.generateButtonWrap}>
          <PrimaryButton
            label={isLoading ? '生成中...' : 'プランを生成'}
            onPress={handleGenerate}
            disabled={!companion || !personality || !hasMoodSelection || isLoading}
          />
        </View>

        {(!companion || !personality || !hasMoodSelection) && (
          <Text style={styles.helperText}>
            {!personality && !companion && !hasMoodSelection
              ? '旅行タイプ・同行者・気分を選んでからプランを生成してください'
              : !hasMoodSelection
                ? '気分ボタンを選ぶか、「その他の気分を入力」に記入してください'
              : !personality && !companion
              ? '「旅行タイプ」と「誰と行く？」を選んでからプランを生成してください'
              : !personality
                ? '「旅行タイプは？」を選んでからプランを生成してください'
                : '「誰と行く？」を選んでからプランを生成してください'}
          </Text>
        )}

        {!isOpenAiConfigured() ? (
          <AppErrorBanner message={APP_MESSAGES.openAiNotConfigured} variant="info" />
        ) : null}

        {error ? (
          <AppErrorBanner message={error} onRetry={handleGenerate} />
        ) : null}

        {showItinerary && companion && personality && planDetails && (
          <FadeInView
            key={days.map((day) => `${day.dayNumber}-${day.label}`).join('|')}
            delay={100}>
            <ItineraryTimeline
              companion={companion}
              personality={personality}
              tripDuration={tripDuration}
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
            />
          </FadeInView>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NS.colors.bg,
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
    color: theme.text,
    ...NS.typography.display,
    marginBottom: Spacing.three,
  },
  tagline: {
    color: theme.textSecondary,
    fontSize: 20,
    fontWeight: '500',
    lineHeight: 30,
    letterSpacing: -0.3,
  },
  taglineAccent: {
    color: theme.text,
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
    backgroundColor: 'rgba(129, 140, 248, 0.15)',
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
    color: '#F97316',
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
    backgroundColor: 'rgba(129, 140, 248, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.2)',
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
    color: theme.text,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  featureDescription: {
    color: theme.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  formSectionLabel: {
    marginBottom: Spacing.three,
  },
  formSectionTitle: {
    color: theme.text,
    fontSize: 18,
    fontWeight: '700',
  },
  formSectionSubtitle: {
    color: theme.textSecondary,
    fontSize: 14,
    marginTop: 4,
  },
  formCard: {
    backgroundColor: NS.colors.bgElevated,
    borderColor: NS.colors.border,
    borderWidth: 1,
    borderRadius: NS.radius.lg,
    padding: Spacing.four,
    gap: Spacing.three,
    ...NS.shadow.card,
  },
  field: {
    gap: Spacing.two,
  },
  label: {
    color: theme.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    backgroundColor: NS.colors.bgInput,
    borderColor: NS.colors.borderStrong,
    borderWidth: 1,
    borderRadius: NS.radius.sm + 2,
    color: theme.text,
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
    color: theme.text,
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
    borderRadius: 12,
    backgroundColor: '#161618',
    borderWidth: 1.5,
    borderColor: theme.backgroundSelected,
  },
  currencyChipSelected: {
    backgroundColor: 'rgba(129, 140, 248, 0.12)',
    borderColor: accent,
  },
  currencyCode: {
    color: theme.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  currencyCodeSelected: {
    color: theme.text,
  },
  currencyAutoHint: {
    color: accent,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: Spacing.two,
  },
  locationCurrencyHint: {
    color: accent,
    fontSize: 13,
    fontWeight: '600',
    marginTop: -Spacing.two,
    marginBottom: Spacing.three,
  },
  currencySymbol: {
    color: theme.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  currencySymbolSelected: {
    color: accent,
  },
  budgetInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161618',
    borderColor: theme.backgroundSelected,
    borderWidth: 1,
    borderRadius: 14,
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
    color: theme.text,
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
  companionCard: {
    width: '48%',
    backgroundColor: theme.backgroundElement,
    borderColor: theme.backgroundSelected,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  companionCardSelected: {
    backgroundColor: 'rgba(129, 140, 248, 0.12)',
    borderColor: accent,
  },
  companionCardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  companionLabel: {
    color: theme.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  companionLabelSelected: {
    color: theme.text,
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
    backgroundColor: theme.backgroundSelected,
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  helperText: {
    color: theme.textSecondary,
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
    color: theme.text,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  itinerarySubtitle: {
    color: theme.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
  },
  itineraryCompanionNote: {
    color: theme.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
    opacity: 0.85,
  },
  personalityBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(129, 140, 248, 0.15)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.3)',
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
    color: theme.textSecondary,
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
    backgroundColor: 'rgba(129, 140, 248, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.2)',
  },
  budgetPillLabel: {
    color: theme.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  budgetPillValue: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '700',
  },
  plannerMessageBox: {
    marginTop: Spacing.two,
    backgroundColor: 'rgba(129, 140, 248, 0.08)',
    borderRadius: 14,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.18)',
  },
  plannerMessageLabel: {
    color: accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  plannerMessageText: {
    color: theme.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  itineraryBadge: {
    backgroundColor: 'rgba(129, 140, 248, 0.15)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.25)',
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
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
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
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  reasonsTitle: {
    color: theme.text,
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
    backgroundColor: '#1A1A1D',
    borderRadius: 16,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  reasonCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(129, 140, 248, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.3)',
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
    color: theme.text,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  confirmButton: {
    marginTop: Spacing.four,
    backgroundColor: '#34D399',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#34D399',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  confirmButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  confirmButtonText: {
    color: '#0A0A0B',
    fontSize: 17,
    fontWeight: '800',
  },
});
