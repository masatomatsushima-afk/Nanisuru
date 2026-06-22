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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AiAdviceSection } from '@/components/ai-advice-section';
import { BudgetBreakdownSection } from '@/components/budget-breakdown-section';
import { ConciergeAccessSection } from '@/components/concierge-access-section';
import { ItineraryDaysView } from '@/components/itinerary-days-view';
import { PlanLoadingScreen, runLoadingAnimation } from '@/components/plan-loading-screen';
import { WeatherSection } from '@/components/weather-section';
import { FadeInView } from '@/components/ui/fade-in-view';
import { PrimaryButton, PremiumCard } from '@/components/ui/premium-card';
import { Spacing } from '@/constants/theme';
import { getBudgetPlaceholder, getCurrency, type CurrencyCode } from '@/constants/currency';
import { NS } from '@/constants/nanisuru-ui';
import { getCurrentCityLabel } from '@/lib/current-location';
import { generateImaHimaPlan, isOpenAiConfigured } from '@/lib/generate-plan';
import {
  IMA_HIMA_MOOD_EMOJI,
  IMA_HIMA_TIME_EMOJI,
  resolveMoodPreferences,
} from '@/lib/imafima';
import { getItineraryEyebrow } from '@/lib/itineraries';
import {
  IMA_HIMA_MOOD_OPTIONS,
  IMA_HIMA_TIME_OPTIONS,
  type ImaHimaMoodOption,
  type ImaHimaTimeOption,
} from '@/types/imafima';
import type { CompanionOption, ItineraryDay, PersonalityOption, PlanDetails } from '@/types/plan';
import { isDateRelatedCompanion } from '@/types/plan';

const accent = NS.colors.accent;

const BUDGET_PRESETS_JPY = [1000, 3000, 5000, 10000, 20000] as const;

type WizardStep = 'time' | 'budget' | 'mood' | 'result';

const STEP_ORDER: WizardStep[] = ['time', 'budget', 'mood'];
const STEP_TITLES: Record<WizardStep, string> = {
  time: '今何時間空いてる？',
  budget: '予算は？',
  mood: '今の気分は？',
  result: 'プラン完成',
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

function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryChip}>
      <Text style={styles.summaryChipLabel}>{label}</Text>
      <Text style={styles.summaryChipValue}>{value}</Text>
    </View>
  );
}

export default function ImaHimaScreen() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<WizardStep>('time');
  const [availableTime, setAvailableTime] = useState<ImaHimaTimeOption | null>(null);
  const [budget, setBudget] = useState('');
  const [mood, setMood] = useState<ImaHimaMoodOption | null>(null);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [manualLocation, setManualLocation] = useState('');
  const [isLocating, setIsLocating] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [days, setDays] = useState<ItineraryDay[]>([]);
  const [planDetails, setPlanDetails] = useState<PlanDetails | null>(null);
  const [companion, setCompanion] = useState<CompanionOption>('一人');
  const [personality, setPersonality] = useState<PersonalityOption>('のんびり');

  const currency: CurrencyCode = 'JPY';
  const { symbol } = getCurrency(currency);
  const resolvedLocation = (locationLabel ?? manualLocation.trim()) || '';

  useEffect(() => {
    let mounted = true;
    (async () => {
      setIsLocating(true);
      const result = await getCurrentCityLabel();
      if (mounted && result) {
        setLocationLabel(result.label);
      }
      if (mounted) setIsLocating(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const goBack = () => {
    if (step === 'budget') setStep('time');
    else if (step === 'mood') setStep('budget');
    else if (step === 'result') {
      setStep('mood');
      setPlanDetails(null);
    } else router.back();
  };

  const handleGenerate = async () => {
    if (!availableTime || !mood || !budget.trim()) return;

    const location = resolvedLocation;
    if (!location) {
      setError('場所を入力するか、位置情報を許可してください');
      return;
    }

    setError(null);
    setIsLoading(true);
    setLoadingStep(0);

    const moodPrefs = resolveMoodPreferences(mood);
    setCompanion(moodPrefs.companion);
    setPersonality(moodPrefs.personality);

    try {
      const [plan] = await Promise.all([
        generateImaHimaPlan({
          location,
          budget: budget.trim(),
          currency,
          availableTime,
          mood,
        }),
        runLoadingAnimation(setLoadingStep),
      ]);

      setDays(plan.days);
      setPlanDetails(plan.details);
      setStep('result');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'プランの生成に失敗しました';
      setError(message);
    } finally {
      setIsLoading(false);
      setLoadingStep(0);
    }
  };

  const renderTimeStep = () => (
    <FadeInView key="time">
      <Text style={styles.stepHint}>空き時間に合わせて、今すぐ行けるプランを作ります</Text>
      <View style={styles.optionsGrid}>
        {IMA_HIMA_TIME_OPTIONS.map((option) => (
          <OptionCard
            key={option}
            emoji={IMA_HIMA_TIME_EMOJI[option]}
            label={option}
            selected={availableTime === option}
            onPress={() => {
              setAvailableTime(option);
              setStep('budget');
            }}
          />
        ))}
      </View>
    </FadeInView>
  );

  const renderBudgetStep = () => (
    <FadeInView key="budget">
      <Text style={styles.stepHint}>この時間帯の予算目安を教えてください</Text>

      <View style={styles.locationBanner}>
        <Text style={styles.locationIcon}>📍</Text>
        <View style={styles.locationTextWrap}>
          {isLocating ? (
            <Text style={styles.locationText}>現在地を取得中...</Text>
          ) : locationLabel ? (
            <>
              <Text style={styles.locationLabel}>現在地</Text>
              <Text style={styles.locationText}>{locationLabel}</Text>
            </>
          ) : (
            <>
              <Text style={styles.locationLabel}>場所を入力</Text>
              <TextInput
                style={styles.locationInput}
                value={manualLocation}
                onChangeText={setManualLocation}
                placeholder="例）渋谷・新宿"
                placeholderTextColor={NS.colors.textMuted}
              />
            </>
          )}
        </View>
      </View>

      <View style={styles.presetRow}>
        {BUDGET_PRESETS_JPY.map((amount) => {
          const label = `${symbol}${amount.toLocaleString('ja-JP')}`;
          const selected = budget === String(amount);
          return (
            <Pressable
              key={amount}
              style={[styles.presetChip, selected && styles.presetChipSelected]}
              onPress={() => setBudget(String(amount))}>
              <Text style={[styles.presetChipText, selected && styles.presetChipTextSelected]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.budgetInputRow}>
        <Text style={styles.budgetPrefix}>{symbol}</Text>
        <TextInput
          style={styles.budgetInput}
          value={budget}
          onChangeText={setBudget}
          placeholder={getBudgetPlaceholder(currency)}
          placeholderTextColor={NS.colors.textMuted}
          keyboardType="numeric"
        />
      </View>

      <View style={styles.nextButtonWrap}>
        <PrimaryButton
          label="次へ"
          onPress={() => setStep('mood')}
          disabled={!budget.trim()}
        />
      </View>
    </FadeInView>
  );

  const renderMoodStep = () => (
    <FadeInView key="mood">
      <Text style={styles.stepHint}>今の気分にぴったりのスポットを選びます</Text>
      <View style={styles.moodGrid}>
        {IMA_HIMA_MOOD_OPTIONS.map((option) => (
          <OptionCard
            key={option}
            emoji={IMA_HIMA_MOOD_EMOJI[option]}
            label={option}
            selected={mood === option}
            wide
            onPress={() => setMood(option)}
          />
        ))}
      </View>

      {mood ? (
        <FadeInView delay={80}>
          <PremiumCard variant="accent" style={styles.readyCard}>
            <Text style={styles.readyEmoji}>✨</Text>
            <Text style={styles.readyTitle}>準備OK！</Text>
            <Text style={styles.readySubtitle}>
              {availableTime}・{symbol}
              {parseInt(budget, 10).toLocaleString('ja-JP')}・{mood}
            </Text>
          </PremiumCard>

          <View style={styles.nextButtonWrap}>
            <PrimaryButton
              label={isLoading ? '生成中...' : '⚡ 今すぐプランを作る'}
              onPress={handleGenerate}
              disabled={isLoading || !isOpenAiConfigured()}
            />
          </View>
        </FadeInView>
      ) : null}

      {!isOpenAiConfigured() ? (
        <Text style={styles.helperText}>
          .env に EXPO_PUBLIC_OPENAI_API_KEY を設定してください
        </Text>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </FadeInView>
  );

  const renderResult = () => {
    if (!planDetails || !availableTime || !mood) return null;

    return (
      <FadeInView key="result">
        <View style={styles.resultHero}>
          <View style={styles.resultBadge}>
            <Text style={styles.resultBadgeText}>⚡ 今暇プラン</Text>
          </View>
          <Text style={styles.resultTitle}>出発準備完了！</Text>
          <Text style={styles.resultSubtitle}>
            {getItineraryEyebrow(companion, resolvedLocation)}
          </Text>
          <View style={styles.summaryRow}>
            <SummaryChip label="時間" value={availableTime} />
            <SummaryChip label="気分" value={mood} />
            <SummaryChip label="タイプ" value={personality} />
          </View>
        </View>

        {planDetails.plannerMessage ? (
          <PremiumCard style={styles.messageCard}>
            <Text style={styles.messageText}>{planDetails.plannerMessage}</Text>
          </PremiumCard>
        ) : null}

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>💰</Text>
            <Text style={styles.statLabel}>予算</Text>
            <Text style={styles.statValue}>{planDetails.totalBudget}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>⏱</Text>
            <Text style={styles.statLabel}>所要</Text>
            <Text style={styles.statValue}>{planDetails.duration}</Text>
          </View>
        </View>

        {planDetails.budgetBreakdown ? (
          <BudgetBreakdownSection breakdown={planDetails.budgetBreakdown} compact />
        ) : null}

        {planDetails.weather ? <WeatherSection weather={planDetails.weather} /> : null}

        <ItineraryDaysView days={days} />

        <ConciergeAccessSection days={days} location={resolvedLocation} compact />

        {isDateRelatedCompanion(companion) && planDetails.aiAdvice ? (
          <AiAdviceSection advice={planDetails.aiAdvice} />
        ) : null}

        <View style={styles.resultActions}>
          <PrimaryButton label="もう一度" onPress={() => {
            setStep('time');
            setAvailableTime(null);
            setBudget('');
            setMood(null);
            setPlanDetails(null);
            setError(null);
          }} />
          <Pressable style={styles.homeLink} onPress={() => router.replace('/')}>
            <Text style={styles.homeLinkText}>ホームに戻る</Text>
          </Pressable>
        </View>
      </FadeInView>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <PlanLoadingScreen visible={isLoading} currentStep={loadingStep} />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + Spacing.three,
            paddingBottom: insets.bottom + Spacing.five,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={goBack}>
            <Text style={styles.backButtonText}>←</Text>
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerEyebrow}>SPONTANEOUS</Text>
            <Text style={styles.headerTitle}>⚡ 今暇</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        {step !== 'result' ? (
          <>
            <ProgressBar step={step} />
            <Text style={styles.question}>{STEP_TITLES[step]}</Text>
            {step === 'time' && renderTimeStep()}
            {step === 'budget' && renderBudgetStep()}
            {step === 'mood' && renderMoodStep()}
          </>
        ) : (
          renderResult()
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.four,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: NS.radius.sm,
    backgroundColor: NS.colors.bgCard,
    borderWidth: 1,
    borderColor: NS.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    color: NS.colors.text,
    fontSize: 20,
    fontWeight: '600',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  headerEyebrow: {
    color: accent,
    ...NS.typography.eyebrow,
    marginBottom: 2,
  },
  headerTitle: {
    color: NS.colors.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  progressWrap: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.four,
    justifyContent: 'center',
  },
  progressDot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: NS.colors.borderStrong,
    maxWidth: 80,
  },
  progressDotActive: {
    backgroundColor: accent,
  },
  progressDotDone: {
    backgroundColor: NS.colors.success,
  },
  question: {
    color: NS.colors.text,
    ...NS.typography.titleSm,
    textAlign: 'center',
    marginBottom: Spacing.two,
  },
  stepHint: {
    color: NS.colors.textSecondary,
    ...NS.typography.bodySm,
    textAlign: 'center',
    marginBottom: Spacing.four,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    justifyContent: 'center',
  },
  optionCard: {
    width: '30%',
    minWidth: 96,
    aspectRatio: 0.85,
    backgroundColor: NS.colors.bgCard,
    borderRadius: NS.radius.lg,
    borderWidth: 1.5,
    borderColor: NS.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.two,
    gap: 6,
  },
  optionCardWide: {
    width: '47%',
    minWidth: 140,
    aspectRatio: 1.4,
  },
  optionCardSelected: {
    borderColor: accent,
    backgroundColor: NS.colors.accentSoft,
    ...NS.shadow.accent,
  },
  optionEmoji: {
    fontSize: 28,
  },
  optionLabel: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  optionLabelSelected: {
    color: NS.colors.text,
  },
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    justifyContent: 'space-between',
  },
  locationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: NS.colors.bgCard,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
    padding: Spacing.three,
    marginBottom: Spacing.four,
  },
  locationIcon: {
    fontSize: 22,
  },
  locationTextWrap: {
    flex: 1,
  },
  locationLabel: {
    color: NS.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  locationText: {
    color: NS.colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  locationInput: {
    color: NS.colors.text,
    fontSize: 16,
    fontWeight: '600',
    padding: 0,
    marginTop: 2,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  presetChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: NS.radius.pill,
    backgroundColor: NS.colors.bgInput,
    borderWidth: 1,
    borderColor: NS.colors.border,
  },
  presetChipSelected: {
    backgroundColor: NS.colors.accentSoft,
    borderColor: accent,
  },
  presetChipText: {
    color: NS.colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  presetChipTextSelected: {
    color: accent,
  },
  budgetInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.sm + 2,
    borderWidth: 1,
    borderColor: NS.colors.borderStrong,
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.four,
  },
  budgetPrefix: {
    color: NS.colors.textMuted,
    fontSize: 18,
    fontWeight: '700',
    marginRight: Spacing.one,
  },
  budgetInput: {
    flex: 1,
    color: NS.colors.text,
    fontSize: 20,
    fontWeight: '700',
    paddingVertical: Spacing.three,
  },
  nextButtonWrap: {
    marginTop: Spacing.two,
  },
  readyCard: {
    alignItems: 'center',
    padding: Spacing.four,
    marginTop: Spacing.three,
    marginBottom: Spacing.two,
  },
  readyEmoji: {
    fontSize: 32,
    marginBottom: Spacing.one,
  },
  readyTitle: {
    color: NS.colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  readySubtitle: {
    color: NS.colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  helperText: {
    color: NS.colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: Spacing.two,
  },
  errorText: {
    color: NS.colors.danger,
    fontSize: 14,
    textAlign: 'center',
    marginTop: Spacing.three,
  },
  resultHero: {
    alignItems: 'center',
    marginBottom: Spacing.four,
  },
  resultBadge: {
    backgroundColor: NS.colors.accentSoft,
    borderRadius: NS.radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
    marginBottom: Spacing.two,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
  },
  resultBadgeText: {
    color: accent,
    fontSize: 13,
    fontWeight: '800',
  },
  resultTitle: {
    color: NS.colors.text,
    ...NS.typography.title,
    textAlign: 'center',
    marginBottom: Spacing.one,
  },
  resultSubtitle: {
    color: NS.colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    marginBottom: Spacing.three,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    justifyContent: 'center',
  },
  summaryChip: {
    backgroundColor: NS.colors.bgCard,
    borderRadius: NS.radius.sm,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderWidth: 1,
    borderColor: NS.colors.border,
  },
  summaryChipLabel: {
    color: NS.colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  summaryChipValue: {
    color: NS.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  messageCard: {
    padding: Spacing.four,
    marginBottom: Spacing.four,
  },
  messageText: {
    color: NS.colors.textSecondary,
    ...NS.typography.bodySm,
    lineHeight: 24,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.four,
  },
  statCard: {
    flex: 1,
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.border,
    padding: Spacing.three,
    alignItems: 'center',
  },
  statIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  statLabel: {
    color: NS.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  statValue: {
    color: NS.colors.text,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  resultActions: {
    marginTop: Spacing.five,
    gap: Spacing.three,
    marginBottom: Spacing.four,
  },
  homeLink: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  homeLinkText: {
    color: NS.colors.textMuted,
    fontSize: 15,
    fontWeight: '600',
  },
});
