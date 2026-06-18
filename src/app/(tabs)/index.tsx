import { router } from 'expo-router';
import { useState } from 'react';
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

import { BottomTabInset, Colors, Spacing } from '@/constants/theme';
import { SuccessOverlay } from '@/components/success-overlay';
import { PlanLoadingScreen, runLoadingAnimation } from '@/components/plan-loading-screen';
import { generatePlanWithAi, isOpenAiConfigured } from '@/lib/generate-plan';
import { buildPlanDetails } from '@/lib/plan-details';
import { COMPANION_SUBTITLES, getItinerary, getItineraryEyebrow } from '@/lib/itineraries';
import type { CompanionOption, ItineraryItem, PlanDetails } from '@/types/plan';
import { COMPANION_OPTIONS } from '@/types/plan';

const theme = Colors.dark;
const accent = '#818CF8';

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

const CLOCK_EMOJIS: Record<number, string> = {
  1: '🕐',
  2: '🕑',
  3: '🕒',
  4: '🕓',
  5: '🕔',
  6: '🕕',
  7: '🕖',
  8: '🕗',
  9: '🕘',
  10: '🕙',
  11: '🕚',
  12: '🕛',
};

function getClockEmoji(time: string): string {
  const hour = parseInt(time.split(':')[0], 10);
  const hour12 = hour % 12 || 12;
  return CLOCK_EMOJIS[hour12] ?? '🕐';
}

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
    <View style={styles.hero}>
      <View style={styles.heroGlow} />
      <Text style={styles.title}>Nanisuru</Text>
      <Text style={styles.tagline}>考えなくていい。</Text>
      <Text style={styles.taglineAccent}>最高の1日をAIが作る。</Text>

      <View style={styles.featureList}>
        {FEATURE_CARDS.map((feature) => (
          <FeatureCard key={feature.title} {...feature} />
        ))}
      </View>
    </View>
  );
}

function TimelineActivityCard({ item, index, isLast }: { item: ItineraryItem; index: number; isLast: boolean }) {
  return (
    <View style={styles.timelineStep}>
      <View style={styles.timelineTrack}>
        <View style={styles.timelineDotRing}>
          <View style={styles.timelineDot} />
        </View>
        {!isLast && <View style={styles.timelineConnector} />}
      </View>

      <View style={[styles.activityCard, isLast && styles.activityCardLast]}>
        <View style={styles.activityCardGlow} />
        <View style={styles.activityCardInner}>
          <View style={styles.timeRow}>
            <Text style={styles.clockEmoji}>{getClockEmoji(item.time)}</Text>
            <Text style={styles.timeText}>{item.time}</Text>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>{index + 1}</Text>
            </View>
          </View>
          <Text style={styles.activityName}>{item.activity}</Text>
        </View>
      </View>
    </View>
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
  location,
  budget,
  people,
  mood,
  items,
  details,
}: {
  companion: CompanionOption;
  location: string;
  budget: string;
  people: string;
  mood: string;
  items: ItineraryItem[];
  details: PlanDetails;
}) {
  const [showSuccess, setShowSuccess] = useState(false);

  const planParams = {
    location,
    budget,
    people,
    mood,
    companion,
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
              <Text style={styles.itineraryTitle}>今日のプラン</Text>
              <Text style={styles.itinerarySubtitle}>{COMPANION_SUBTITLES[companion]}</Text>
            </View>
            <View style={styles.itineraryBadge}>
              <Text style={styles.itineraryBadgeText}>{items.length}件</Text>
            </View>
          </View>

          <View style={styles.timelineList}>
            {items.map((item, index) => (
              <TimelineActivityCard
                key={`${item.time}-${item.activity}`}
                item={item}
                index={index}
                isLast={index === items.length - 1}
              />
            ))}
          </View>

          <View style={styles.detailHint}>
            <Text style={styles.detailHintText}>タップしてプラン詳細を見る →</Text>
          </View>
        </Pressable>

        <RecommendReasonsSection />

        <Pressable
          style={({ pressed }) => [styles.confirmButton, pressed && styles.confirmButtonPressed]}
          onPress={handleConfirm}>
          <Text style={styles.confirmButtonText}>このプランで決定</Text>
        </Pressable>
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

function FormField({ label, value, onChangeText, placeholder, keyboardType = 'default' }: FormFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#6B7280"
        keyboardType={keyboardType}
      />
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
  return (
    <Pressable
      style={({ pressed }) => [
        styles.companionCard,
        selected && styles.companionCardSelected,
        pressed && styles.companionCardPressed,
      ]}
      onPress={onPress}>
      <Text style={[styles.companionLabel, selected && styles.companionLabelSelected]}>{label}</Text>
      {selected && <View style={styles.companionCheck} />}
    </Pressable>
  );
}

export default function HomeScreen() {
  const [location, setLocation] = useState('');
  const [budget, setBudget] = useState('');
  const [people, setPeople] = useState('');
  const [mood, setMood] = useState('');
  const [companion, setCompanion] = useState<CompanionOption | null>(null);
  const [showItinerary, setShowItinerary] = useState(false);
  const [itinerary, setItinerary] = useState<ItineraryItem[]>([]);
  const [planDetails, setPlanDetails] = useState<PlanDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  const resetPlan = () => {
    setShowItinerary(false);
    setItinerary([]);
    setPlanDetails(null);
    setError(null);
    setLoadingStep(0);
  };

  const fetchPlan = async () => {
    if (!companion) throw new Error('Companion not selected');

    if (isOpenAiConfigured()) {
      const plan = await generatePlanWithAi({
        location,
        budget,
        people,
        relationship: companion,
        mood,
      });
      return { items: plan.items, details: plan.details };
    }

    const items = getItinerary(companion, location);
    return {
      items,
      details: buildPlanDetails({ location, budget, people, mood, companion, items }),
    };
  };

  const handleGenerate = async () => {
    if (!companion || isLoading) return;

    setIsLoading(true);
    setLoadingStep(0);
    setError(null);
    setShowItinerary(false);

    try {
      const [plan] = await Promise.all([fetchPlan(), runLoadingAnimation(setLoadingStep)]);

      setItinerary(plan.items);
      setPlanDetails(plan.details);
      setShowItinerary(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'プランの作成に失敗しました';
      setError(message);
      setShowItinerary(false);
    } finally {
      setIsLoading(false);
      setLoadingStep(0);
    }
  };

  const handleLocationChange = (text: string) => {
    setLocation(text);
    if (showItinerary) resetPlan();
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
            paddingTop: insets.top + Spacing.four,
            paddingBottom: insets.bottom + BottomTabInset + Spacing.five,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <HeroSection />

        <View style={styles.formSectionLabel}>
          <Text style={styles.formSectionTitle}>プランを作成</Text>
          <Text style={styles.formSectionSubtitle}>条件を入力して、あなただけの1日を</Text>
        </View>

        <View style={styles.formCard}>
          <FormField
            label="場所"
            value={location}
            onChangeText={handleLocationChange}
            placeholder="例）東京・渋谷"
          />
          <FormField
            label="予算"
            value={budget}
            onChangeText={setBudget}
            placeholder="例）10000"
            keyboardType="numeric"
          />
          <FormField
            label="人数"
            value={people}
            onChangeText={setPeople}
            placeholder="例）2"
            keyboardType="number-pad"
          />
          <FormField
            label="今日の気分"
            value={mood}
            onChangeText={(text) => {
              setMood(text);
              if (showItinerary) resetPlan();
            }}
            placeholder="例）のんびり、グルメ重視"
          />
        </View>

        <View style={styles.companionSection}>
          <Text style={styles.sectionTitle}>誰と行く？</Text>
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

        <Pressable
          style={({ pressed }) => [
            styles.button,
            (!companion || isLoading) && styles.buttonDisabled,
            pressed && companion && !isLoading && styles.buttonPressed,
          ]}
          onPress={handleGenerate}
          disabled={!companion || isLoading}>
          <Text style={styles.buttonText}>{isLoading ? '作成中...' : 'プランを作成'}</Text>
        </Pressable>

        {!companion && (
          <Text style={styles.helperText}>「誰と行く？」を選んでからプランを作成してください</Text>
        )}

        {!isOpenAiConfigured() && (
          <Text style={styles.helperText}>
            APIキー未設定のためサンプルプランを表示します（.env に EXPO_PUBLIC_OPENAI_API_KEY を設定）
          </Text>
        )}

        {error && <Text style={styles.errorText}>{error}</Text>}

        {showItinerary && companion && planDetails && (
          <ItineraryTimeline
            companion={companion}
            location={location}
            budget={budget}
            people={people}
            mood={mood}
            items={itinerary}
            details={planDetails}
          />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0B',
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
    backgroundColor: 'rgba(129, 140, 248, 0.08)',
    borderRadius: 999,
    transform: [{ scaleX: 1.2 }],
  },
  title: {
    color: theme.text,
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -1.5,
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
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: '#121214',
    borderRadius: 18,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
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
    backgroundColor: theme.backgroundElement,
    borderColor: theme.backgroundSelected,
    borderWidth: 1,
    borderRadius: 20,
    padding: Spacing.four,
    gap: Spacing.three,
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
    backgroundColor: '#161618',
    borderColor: theme.backgroundSelected,
    borderWidth: 1,
    borderRadius: 14,
    color: theme.text,
    fontSize: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
  },
  companionSection: {
    marginTop: Spacing.four,
  },
  sectionTitle: {
    color: theme.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: Spacing.three,
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
    backgroundColor: '#121214',
    borderColor: 'rgba(129, 140, 248, 0.18)',
    borderWidth: 1,
    borderRadius: 28,
    padding: Spacing.four,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.45,
    shadowRadius: 32,
    elevation: 12,
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
  timelineStep: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  timelineTrack: {
    width: 28,
    alignItems: 'center',
  },
  timelineDotRing: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(129, 140, 248, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    shadowColor: accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: accent,
  },
  timelineConnector: {
    flex: 1,
    width: 2,
    backgroundColor: 'rgba(129, 140, 248, 0.25)',
    marginVertical: 6,
    borderRadius: 1,
  },
  activityCard: {
    flex: 1,
    marginBottom: Spacing.three,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#1A1A1D',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  activityCardLast: {
    marginBottom: 0,
  },
  activityCardGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(129, 140, 248, 0.45)',
  },
  activityCardInner: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three + 2,
    gap: Spacing.two,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  clockEmoji: {
    fontSize: 22,
    lineHeight: 28,
  },
  timeText: {
    color: accent,
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.3,
    flex: 1,
  },
  stepBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 8,
    minWidth: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  stepBadgeText: {
    color: theme.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  activityName: {
    color: theme.text,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    lineHeight: 28,
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
