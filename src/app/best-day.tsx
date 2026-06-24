import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BestDayResultScreen } from '@/components/best-day-result-screen';
import { FadeInView } from '@/components/ui/fade-in-view';
import { PrimaryButton, PremiumCard } from '@/components/ui/premium-card';
import { getBudgetPlaceholder, getBudgetPresets, getCurrency, type CurrencyCode } from '@/constants/currency';
import { buildLocationCurrencyHint, inferCurrencyFromLocation } from '@/lib/location-currency';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { buildActiveTripContext, saveActiveTrip } from '@/lib/active-trip';
import {
  BEST_DAY_LOADING_STEPS,
  BEST_DAY_LOADING_STEPS_NO_MEMORY,
  getBestDayTripDuration,
  resolveBestDayPreferences,
  runBestDayLoadingAnimation,
} from '@/lib/best-day';
import { buildBestDayPresentation } from '@/lib/best-day-presentation';
import { getCurrentCityLabel } from '@/lib/current-location';
import { generateBestDayPlan, isOpenAiConfigured } from '@/lib/generate-plan';
import { flattenItineraryDays } from '@/lib/trip-duration';
import { getTravelMemories } from '@/lib/travel-memory';
import {
  BEST_DAY_MOOD_EMOJI,
  BEST_DAY_MOOD_OPTIONS,
  BEST_DAY_PEOPLE_OPTIONS,
  BEST_DAY_TIME_EMOJI,
  BEST_DAY_TIME_OPTIONS,
  type BestDayMoodOption,
  type BestDayTimeOption,
} from '@/types/best-day';
import type { CompanionOption, ItineraryDay, PersonalityOption, PlanDetails } from '@/types/plan';

const fireAccent = '#F97316';

type WizardStep = 'location' | 'budget' | 'people' | 'time' | 'mood' | 'result';

const STEP_ORDER: WizardStep[] = ['location', 'budget', 'people', 'time', 'mood'];
const STEP_TITLES: Record<WizardStep, string> = {
  location: 'どこで過ごす？',
  budget: '予算は？',
  people: '人数は？',
  time: '空き時間は？',
  mood: '今日の気分は？',
  result: '最高の1日',
};

function ProgressBar({ step }: { step: WizardStep }) {
  const index = STEP_ORDER.indexOf(step);
  if (index < 0) return null;

  return (
    <View style={styles.progressWrap}>
      {STEP_ORDER.map((s, i) => (
        <View
          key={s}
          style={[
            styles.progressDot,
            i <= index && styles.progressDotActive,
            i < index && styles.progressDotDone,
          ]}
        />
      ))}
    </View>
  );
}

function OptionCard({
  emoji,
  label,
  selected,
  onPress,
  wide,
}: {
  emoji: string;
  label: string;
  selected: boolean;
  onPress: () => void;
  wide?: boolean;
}) {
  return (
    <Pressable
      style={[
        styles.optionCard,
        wide && styles.optionCardWide,
        selected && styles.optionCardSelected,
      ]}
      onPress={onPress}>
      <Text style={styles.optionEmoji}>{emoji}</Text>
      <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

function BestDayLoadingModal({
  visible,
  currentStep,
  hasTravelMemory,
}: {
  visible: boolean;
  currentStep: number;
  hasTravelMemory: boolean;
}) {
  const steps = hasTravelMemory ? BEST_DAY_LOADING_STEPS : BEST_DAY_LOADING_STEPS_NO_MEMORY;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.loadingOverlay}>
        <View style={styles.loadingCard}>
          <Text style={styles.loadingEmoji}>🔥</Text>
          <Text style={styles.loadingTitle}>最高の1日を設計中</Text>
          <Text style={styles.loadingSubtitle}>
            {hasTravelMemory
              ? 'あなたの旅行メモリーを踏まえて最適化しています'
              : 'プレミアムコンシェルジュが最適化しています'}
          </Text>
          <View style={styles.loadingSteps}>
            {steps.map((step, index) => {
              const status =
                index < currentStep ? 'done' : index === currentStep ? 'active' : 'pending';
              return (
                <View key={step.label} style={styles.loadingStepRow}>
                  <Text style={styles.loadingStepIcon}>
                    {status === 'done' ? '✓' : step.icon}
                  </Text>
                  <Text
                    style={[
                      styles.loadingStepLabel,
                      status === 'active' && styles.loadingStepLabelActive,
                      status === 'done' && styles.loadingStepLabelDone,
                    ]}>
                    {step.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function BestDayScreen() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<WizardStep>('location');
  const [location, setLocation] = useState('');
  const [budget, setBudget] = useState('');
  const [people, setPeople] = useState<string | null>(null);
  const [availableTime, setAvailableTime] = useState<BestDayTimeOption | null>(null);
  const [mood, setMood] = useState<BestDayMoodOption | null>(null);
  const [locationHint, setLocationHint] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [usedTravelMemory, setUsedTravelMemory] = useState(false);

  const [days, setDays] = useState<ItineraryDay[]>([]);
  const [planDetails, setPlanDetails] = useState<PlanDetails | null>(null);
  const [companion, setCompanion] = useState<CompanionOption>('一人');
  const [personality, setPersonality] = useState<PersonalityOption>('のんびり');
  const [currency, setCurrency] = useState<CurrencyCode>('JPY');

  const { symbol } = getCurrency(currency);
  const resolvedLocation = location.trim() || locationHint || '';
  const locationCurrencyHint = buildLocationCurrencyHint(resolvedLocation);
  const budgetPresets = getBudgetPresets(currency);
  const theme = days[0]?.theme ?? '最高の1日';
  const items = flattenItineraryDays(days);
  const presentation = buildBestDayPresentation(theme, planDetails);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setIsLocating(true);
      const result = await getCurrentCityLabel();
      if (mounted && result) {
        setLocationHint(result.label);
        if (!location.trim()) setLocation(result.label);
      }
      if (mounted) setIsLocating(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const trimmed = resolvedLocation.trim();
    if (!trimmed) return;
    setCurrency(inferCurrencyFromLocation(trimmed));
  }, [resolvedLocation]);

  const goBack = () => {
    const prev: Partial<Record<WizardStep, WizardStep>> = {
      budget: 'location',
      people: 'budget',
      time: 'people',
      mood: 'time',
    };
    if (step === 'result') {
      setStep('mood');
      setPlanDetails(null);
      setDays([]);
    } else if (prev[step]) {
      setStep(prev[step]!);
    } else {
      router.back();
    }
  };

  const handleGenerate = async () => {
    if (!mood || !people || !availableTime || !budget.trim() || !resolvedLocation) return;

    if (!isOpenAiConfigured()) {
      setError('OpenAI APIキーが未設定です。.env を確認してください。');
      return;
    }

    setError(null);
    setIsLoading(true);
    setLoadingStep(0);

    const moodPrefs = resolveBestDayPreferences(mood, people);
    setCompanion(moodPrefs.companion);
    setPersonality(moodPrefs.personality);

    try {
      const memories = await getTravelMemories();
      const hasTravelMemory = memories.length > 0;
      setUsedTravelMemory(hasTravelMemory);

      const [plan] = await Promise.all([
        generateBestDayPlan({
          location: resolvedLocation,
          budget: budget.trim(),
          currency,
          people: moodPrefs.effectivePeople,
          availableTime,
          mood,
        }),
        runBestDayLoadingAnimation(setLoadingStep, hasTravelMemory),
      ]);

      setDays(plan.days);
      setPlanDetails(plan.details);
      setStep('result');

      const tripDuration = plan.details.tripDuration ?? getBestDayTripDuration(availableTime);
      await saveActiveTrip(
        buildActiveTripContext({
          location: resolvedLocation,
          budget: budget.trim(),
          currency,
          people: moodPrefs.effectivePeople,
          mood,
          companion: moodPrefs.companion,
          personality: moodPrefs.personality,
          tripDuration,
          days: plan.days,
          details: plan.details,
        }),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'プランの生成に失敗しました';
      setError(message);
    } finally {
      setIsLoading(false);
      setLoadingStep(0);
    }
  };

  const renderLocationStep = () => (
    <FadeInView key="location">
      <Text style={styles.stepHint}>計画は不要。場所だけ教えてください</Text>
      <PremiumCard style={styles.inputCard}>
        <Text style={styles.inputLabel}>📍 場所</Text>
        <TextInput
          style={styles.locationInput}
          value={location}
          onChangeText={setLocation}
          placeholder={isLocating ? '現在地を取得中...' : '例）渋谷、京都、箱根'}
          placeholderTextColor={NS.colors.textMuted}
        />
        {locationHint ? (
          <Pressable onPress={() => setLocation(locationHint)}>
            <Text style={styles.locationHint}>現在地を使う: {locationHint}</Text>
          </Pressable>
        ) : null}
        {locationCurrencyHint ? (
          <Text style={styles.locationCurrencyHint}>{locationCurrencyHint}</Text>
        ) : null}
      </PremiumCard>
      <PrimaryButton
        label="次へ"
        onPress={() => setStep('budget')}
        disabled={!resolvedLocation}
      />
    </FadeInView>
  );

  const renderBudgetStep = () => (
    <FadeInView key="budget">
      <Text style={styles.stepHint}>この時間帯の予算目安を教えてください</Text>
      <View style={styles.budgetInputWrap}>
        <Text style={styles.currencySymbol}>{symbol}</Text>
        <TextInput
          style={styles.budgetInput}
          value={budget}
          onChangeText={setBudget}
          placeholder={getBudgetPlaceholder(currency)}
          placeholderTextColor={NS.colors.textMuted}
          keyboardType="number-pad"
        />
      </View>
      <View style={styles.presetRow}>
        {budgetPresets.map((amount) => (
          <Pressable
            key={amount}
            style={[styles.presetChip, budget === String(amount) && styles.presetChipSelected]}
            onPress={() => setBudget(String(amount))}>
            <Text
              style={[
                styles.presetChipText,
                budget === String(amount) && styles.presetChipTextSelected,
              ]}>
              {symbol}{amount.toLocaleString('ja-JP')}
            </Text>
          </Pressable>
        ))}
      </View>
      <PrimaryButton label="次へ" onPress={() => setStep('people')} disabled={!budget.trim()} />
    </FadeInView>
  );

  const renderPeopleStep = () => (
    <FadeInView key="people">
      <Text style={styles.stepHint}>何人で過ごしますか？</Text>
      <View style={styles.optionsGrid}>
        {BEST_DAY_PEOPLE_OPTIONS.map((option) => (
          <OptionCard
            key={option.value}
            emoji={option.value === '1' ? '🧍' : option.value === '2' ? '👫' : '👨‍👩‍👧'}
            label={option.label}
            selected={people === option.value}
            onPress={() => {
              setPeople(option.value);
              setStep('time');
            }}
          />
        ))}
      </View>
    </FadeInView>
  );

  const renderTimeStep = () => (
    <FadeInView key="time">
      <Text style={styles.stepHint}>使える時間に合わせて、最高の流れを設計します</Text>
      <View style={styles.optionsGrid}>
        {BEST_DAY_TIME_OPTIONS.map((option) => (
          <OptionCard
            key={option}
            emoji={BEST_DAY_TIME_EMOJI[option]}
            label={option}
            selected={availableTime === option}
            onPress={() => {
              setAvailableTime(option);
              setStep('mood');
            }}
          />
        ))}
      </View>
    </FadeInView>
  );

  const renderMoodStep = () => (
    <FadeInView key="mood">
      <Text style={styles.stepHint}>今日の気分を選んで。あとはAIコンシェルジュにお任せ</Text>
      <View style={styles.moodGrid}>
        {BEST_DAY_MOOD_OPTIONS.map((option) => (
          <OptionCard
            key={option}
            emoji={BEST_DAY_MOOD_EMOJI[option]}
            label={option}
            selected={mood === option}
            wide
            onPress={() => setMood(option)}
          />
        ))}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <PrimaryButton
        label={isLoading ? '最高の1日を設計中...' : '🔥 最高の1日をつくる'}
        onPress={handleGenerate}
        disabled={!mood || isLoading}
      />
    </FadeInView>
  );

  const renderResultStep = () => {
    if (!planDetails || !mood || !people || !availableTime) return null;

    return (
      <BestDayResultScreen
        location={resolvedLocation}
        budget={budget}
        currency={currency}
        people={people}
        mood={mood}
        availableTime={availableTime}
        companion={companion}
        personality={personality}
        days={days}
        items={items}
        planDetails={planDetails}
        presentation={presentation}
        usedTravelMemory={usedTravelMemory}
        placesNotice={planDetails.placesNotice}
      />
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.inner, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={goBack}>
            <Text style={styles.backBtnText}>←</Text>
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>🔥 最高の1日</Text>
            <Text style={styles.headerStep}>{STEP_TITLES[step]}</Text>
          </View>
          <View style={styles.backBtn} />
        </View>

        {step !== 'result' ? <ProgressBar step={step} /> : null}

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + Spacing.six },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {step === 'location' && renderLocationStep()}
          {step === 'budget' && renderBudgetStep()}
          {step === 'people' && renderPeopleStep()}
          {step === 'time' && renderTimeStep()}
          {step === 'mood' && renderMoodStep()}
          {step === 'result' && renderResultStep()}
        </ScrollView>
      </View>

      <BestDayLoadingModal
        visible={isLoading}
        currentStep={loadingStep}
        hasTravelMemory={usedTravelMemory}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: NS.colors.bg },
  inner: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: NS.colors.border,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backBtnText: { color: fireAccent, fontSize: 22, fontWeight: '600' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { color: NS.colors.text, fontSize: 17, fontWeight: '800' },
  headerStep: { color: NS.colors.textSecondary, fontSize: 12, marginTop: 2 },
  progressWrap: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.three,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: NS.colors.borderStrong,
  },
  progressDotActive: { backgroundColor: fireAccent, width: 20 },
  progressDotDone: { backgroundColor: NS.colors.success },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  stepHint: {
    color: NS.colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: Spacing.four,
    textAlign: 'center',
  },
  inputCard: { padding: Spacing.four, marginBottom: Spacing.four },
  inputLabel: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: Spacing.two,
  },
  locationInput: {
    color: NS.colors.text,
    fontSize: 18,
    fontWeight: '600',
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: NS.colors.border,
    marginBottom: Spacing.two,
  },
  locationHint: { color: fireAccent, fontSize: 13, fontWeight: '600' },
  locationCurrencyHint: {
    color: fireAccent,
    fontSize: 13,
    fontWeight: '600',
    marginTop: Spacing.two,
  },
  budgetInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.lg,
    borderWidth: 1,
    borderColor: NS.colors.borderStrong,
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.three,
  },
  currencySymbol: {
    color: NS.colors.textSecondary,
    fontSize: 20,
    fontWeight: '700',
    marginRight: Spacing.two,
  },
  budgetInput: {
    flex: 1,
    color: NS.colors.text,
    fontSize: 28,
    fontWeight: '800',
    paddingVertical: Spacing.four,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginBottom: Spacing.five,
  },
  presetChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: NS.radius.pill,
    backgroundColor: NS.colors.bgCard,
    borderWidth: 1,
    borderColor: NS.colors.border,
  },
  presetChipSelected: {
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
    borderColor: 'rgba(249, 115, 22, 0.35)',
  },
  presetChipText: { color: NS.colors.textSecondary, fontSize: 13, fontWeight: '700' },
  presetChipTextSelected: { color: fireAccent },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    justifyContent: 'center',
    marginBottom: Spacing.four,
  },
  moodGrid: { gap: Spacing.two, marginBottom: Spacing.four },
  optionCard: {
    width: '44%',
    minWidth: 140,
    backgroundColor: NS.colors.bgCard,
    borderRadius: NS.radius.lg,
    padding: Spacing.four,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: NS.colors.border,
  },
  optionCardWide: { width: '100%', flexDirection: 'row', gap: Spacing.three },
  optionCardSelected: {
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
    borderColor: 'rgba(249, 115, 22, 0.4)',
  },
  optionEmoji: { fontSize: 28, marginBottom: Spacing.one },
  optionLabel: {
    color: NS.colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    flex: 1,
  },
  optionLabelSelected: { color: NS.colors.text },
  errorText: {
    color: NS.colors.danger,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: Spacing.three,
  },
  loadingOverlay: {
    flex: 1,
    backgroundColor: NS.colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  loadingCard: {
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.xl,
    padding: Spacing.five,
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.3)',
  },
  loadingEmoji: { fontSize: 48, textAlign: 'center', marginBottom: Spacing.three },
  loadingTitle: {
    color: NS.colors.text,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: Spacing.one,
  },
  loadingSubtitle: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: Spacing.four,
  },
  loadingSteps: { gap: Spacing.two },
  loadingStepRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  loadingStepIcon: { width: 24, textAlign: 'center', fontSize: 14 },
  loadingStepLabel: { color: NS.colors.textMuted, fontSize: 14 },
  loadingStepLabelActive: { color: fireAccent, fontWeight: '700' },
  loadingStepLabelDone: { color: NS.colors.success },
});
