import { router } from 'expo-router';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PERSONALITY_SUBTITLES } from '@/lib/itineraries';
import { completeOnboarding } from '@/lib/onboarding-storage';
import { NS } from '@/constants/nanisuru-ui';
import { Colors, Spacing } from '@/constants/theme';
import type { PersonalityOption } from '@/types/plan';
import { PERSONALITY_OPTIONS } from '@/types/plan';

const theme = Colors.dark;
const accent = '#818CF8';
const TOTAL_STEPS = 4;

const PERSONALITY_EMOJI: Record<PersonalityOption, string> = {
  冒険家: '🧭',
  グルメ: '🍽️',
  のんびり: '☕',
  映え重視: '📸',
  穴場好き: '🗺️',
};

const FEATURES = [
  {
    icon: '🤖',
    title: 'AIが1日を提案',
    description: '場所と気分を入力するだけ。朝から夜まで、あなただけのプランが完成します。',
  },
  {
    icon: '💰',
    title: '予算に合わせる',
    description: '設定した予算内で、無理のないスポットと移動ルートを提案します。',
  },
  {
    icon: '☀️',
    title: '天気も考慮',
    description: '雨の日の代替案も。天候が変わっても、楽しめる1日をサポートします。',
  },
] as const;

function ProgressBar({ step }: { step: number }) {
  return (
    <View style={styles.progressTrack}>
      {Array.from({ length: TOTAL_STEPS }, (_, index) => (
        <View
          key={index}
          style={[styles.progressDot, index <= step && styles.progressDotActive]}
        />
      ))}
    </View>
  );
}

function WelcomeStep() {
  return (
    <Animated.View entering={FadeIn.duration(500)} style={styles.stepContent}>
      <View style={styles.heroGlowLarge} />
      <View style={styles.heroGlowSmall} />

      <Animated.View entering={FadeInDown.delay(100).duration(600)} style={styles.welcomeBadge}>
        <Text style={styles.welcomeBadgeText}>AI DAY PLANNER</Text>
      </Animated.View>

      <Animated.Text entering={FadeInDown.delay(200).duration(600)} style={styles.brandTitle}>
        Nanisuru
      </Animated.Text>

      <Animated.Text entering={FadeInUp.delay(350).duration(600)} style={styles.welcomeTagline}>
        今日を、ちょっと特別に。
      </Animated.Text>

      <Animated.Text entering={FadeInUp.delay(450).duration(600)} style={styles.welcomeSubtext}>
        考えなくていい。最高の1日を、AIがあなたのために作ります。
      </Animated.Text>
    </Animated.View>
  );
}

function FeaturesStep() {
  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.stepContent}>
      <Text style={styles.stepEyebrow}>Nanisuruとは</Text>
      <Text style={styles.stepTitle}>あなたの1日を、{'\n'}AIがデザイン</Text>
      <Text style={styles.stepDescription}>
        旅行プランナーのように、あなたに合ったお出かけプランを提案します。
      </Text>

      <View style={styles.featureList}>
        {FEATURES.map((feature, index) => (
          <Animated.View
            key={feature.title}
            entering={FadeInDown.delay(index * 100).duration(500)}
            style={styles.featureCard}>
            <View style={styles.featureIconWrap}>
              <Text style={styles.featureIcon}>{feature.icon}</Text>
            </View>
            <View style={styles.featureTextWrap}>
              <Text style={styles.featureTitle}>{feature.title}</Text>
              <Text style={styles.featureDescription}>{feature.description}</Text>
            </View>
          </Animated.View>
        ))}
      </View>
    </Animated.View>
  );
}

function PersonalityStep({
  selected,
  onSelect,
}: {
  selected: PersonalityOption | null;
  onSelect: (option: PersonalityOption) => void;
}) {
  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.stepContent}>
      <Text style={styles.stepEyebrow}>STEP 3</Text>
      <Text style={styles.stepTitle}>あなたのスタイルは？</Text>
      <Text style={styles.stepDescription}>選んだスタイルをもとに、AIがプランを提案します。</Text>

      <ScrollView
        style={styles.personalityScroll}
        contentContainerStyle={styles.personalityList}
        showsVerticalScrollIndicator={false}>
        {PERSONALITY_OPTIONS.map((option, index) => {
          const isSelected = selected === option;
          return (
            <Animated.View key={option} entering={FadeInDown.delay(index * 60).duration(450)}>
              <Pressable
                style={({ pressed }) => [
                  styles.personalityCard,
                  isSelected && styles.personalityCardSelected,
                  pressed && styles.personalityCardPressed,
                ]}
                onPress={() => onSelect(option)}>
                <View style={[styles.personalityIconWrap, isSelected && styles.personalityIconWrapSelected]}>
                  <Text style={styles.personalityEmoji}>{PERSONALITY_EMOJI[option]}</Text>
                </View>
                <View style={styles.personalityTextWrap}>
                  <Text style={[styles.personalityLabel, isSelected && styles.personalityLabelSelected]}>
                    {option}
                  </Text>
                  <Text style={styles.personalitySubtitle}>{PERSONALITY_SUBTITLES[option]}</Text>
                </View>
                {isSelected ? <View style={styles.personalityCheck} /> : null}
              </Pressable>
            </Animated.View>
          );
        })}
      </ScrollView>
    </Animated.View>
  );
}

function ReadyStep({ personality }: { personality: PersonalityOption }) {
  return (
    <Animated.View entering={FadeIn.duration(500)} style={styles.stepContentCentered}>
      <View style={styles.readyGlow} />
      <Animated.View entering={FadeInDown.delay(150).duration(600)} style={styles.readyIconWrap}>
        <Text style={styles.readyIcon}>✨</Text>
      </Animated.View>

      <Animated.Text entering={FadeInDown.delay(250).duration(600)} style={styles.stepTitleCentered}>
        準備完了！
      </Animated.Text>

      <Animated.Text entering={FadeInUp.delay(350).duration(600)} style={styles.readyDescription}>
        Nanisuruをはじめましょう。{'\n'}あなただけの特別な1日が、すぐそこに。
      </Animated.Text>

      <Animated.View entering={FadeInUp.delay(450).duration(600)} style={styles.readyStyleCard}>
        <Text style={styles.readyStyleLabel}>あなたのスタイル</Text>
        <View style={styles.readyStyleRow}>
          <Text style={styles.readyStyleEmoji}>{PERSONALITY_EMOJI[personality]}</Text>
          <Text style={styles.readyStyleName}>{personality}</Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [personality, setPersonality] = useState<PersonalityOption | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isLastStep = step === TOTAL_STEPS - 1;
  const canContinue = step === 2 ? personality !== null : true;

  const handleNext = async () => {
    if (!canContinue || isSaving) return;

    if (!isLastStep) {
      setStep((current) => current + 1);
      return;
    }

    if (!personality) return;

    setIsSaving(true);
    try {
      await completeOnboarding(personality);
      router.replace('/');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    if (step > 0) setStep((current) => current - 1);
  };

  const buttonLabel = isLastStep
    ? isSaving
      ? 'はじめています...'
      : 'Nanisuruをはじめる'
    : step === 0
      ? 'はじめる'
      : '次へ';

  return (
    <View style={[styles.container, { paddingTop: insets.top + Spacing.three }]}>
      <View style={styles.topBar}>
        {step > 0 ? (
          <Pressable style={styles.backButton} onPress={handleBack} hitSlop={12}>
            <Text style={styles.backButtonText}>← 戻る</Text>
          </Pressable>
        ) : (
          <View style={styles.backButtonPlaceholder} />
        )}
        <ProgressBar step={step} />
        <View style={styles.backButtonPlaceholder} />
      </View>

      <View style={styles.body}>
        {step === 0 && <WelcomeStep />}
        {step === 1 && <FeaturesStep />}
        {step === 2 && <PersonalityStep selected={personality} onSelect={setPersonality} />}
        {step === 3 && personality && <ReadyStep personality={personality} />}
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.four }]}>
        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            !canContinue && styles.primaryButtonDisabled,
            pressed && canContinue && !isSaving && styles.primaryButtonPressed,
          ]}
          onPress={handleNext}
          disabled={!canContinue || isSaving}>
          <View style={styles.primaryButtonGlow} />
          <Text style={styles.primaryButtonText}>{buttonLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NS.colors.bg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.two,
  },
  backButton: {
    width: 72,
    paddingVertical: Spacing.two,
  },
  backButtonPlaceholder: {
    width: 72,
  },
  backButtonText: {
    color: accent,
    fontSize: 15,
    fontWeight: '600',
  },
  progressTrack: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  progressDotActive: {
    width: 28,
    backgroundColor: accent,
  },
  body: {
    flex: 1,
    paddingHorizontal: Spacing.four,
  },
  stepContent: {
    flex: 1,
    paddingTop: Spacing.four,
  },
  stepContentCentered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: Spacing.six,
  },
  heroGlowLarge: {
    position: 'absolute',
    top: -40,
    alignSelf: 'center',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(129, 140, 248, 0.12)',
  },
  heroGlowSmall: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(167, 139, 250, 0.08)',
  },
  welcomeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(129, 140, 248, 0.12)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.25)',
    marginBottom: Spacing.four,
  },
  welcomeBadgeText: {
    color: accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  brandTitle: {
    color: theme.text,
    fontSize: 52,
    fontWeight: '800',
    letterSpacing: -1.5,
    marginBottom: Spacing.three,
  },
  welcomeTagline: {
    color: theme.text,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 38,
    marginBottom: Spacing.three,
  },
  welcomeSubtext: {
    color: theme.textSecondary,
    fontSize: 16,
    lineHeight: 26,
    maxWidth: 320,
  },
  stepEyebrow: {
    color: accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: Spacing.two,
  },
  stepTitle: {
    color: theme.text,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.8,
    lineHeight: 40,
    marginBottom: Spacing.two,
  },
  stepTitleCentered: {
    color: theme.text,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.8,
    textAlign: 'center',
    marginBottom: Spacing.three,
  },
  stepDescription: {
    color: theme.textSecondary,
    fontSize: 16,
    lineHeight: 26,
    marginBottom: Spacing.four,
    maxWidth: 340,
  },
  featureList: {
    gap: Spacing.three,
  },
  featureCard: {
    flexDirection: 'row',
    gap: Spacing.three,
    backgroundColor: '#121214',
    borderRadius: 20,
    padding: Spacing.three + 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  featureIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(129, 140, 248, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.2)',
  },
  featureIcon: {
    fontSize: 24,
  },
  featureTextWrap: {
    flex: 1,
    paddingTop: 2,
  },
  featureTitle: {
    color: theme.text,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },
  featureDescription: {
    color: theme.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  personalityScroll: {
    flex: 1,
  },
  personalityList: {
    gap: Spacing.two,
    paddingBottom: Spacing.two,
  },
  personalityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: '#121214',
    borderRadius: 18,
    padding: Spacing.three,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  personalityCardSelected: {
    backgroundColor: 'rgba(129, 140, 248, 0.1)',
    borderColor: accent,
  },
  personalityCardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  personalityIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  personalityIconWrapSelected: {
    backgroundColor: 'rgba(129, 140, 248, 0.18)',
  },
  personalityEmoji: {
    fontSize: 22,
  },
  personalityTextWrap: {
    flex: 1,
  },
  personalityLabel: {
    color: theme.textSecondary,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  personalityLabelSelected: {
    color: theme.text,
  },
  personalitySubtitle: {
    color: theme.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  personalityCheck: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: accent,
  },
  readyGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(129, 140, 248, 0.1)',
  },
  readyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(129, 140, 248, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.3)',
    marginBottom: Spacing.four,
  },
  readyIcon: {
    fontSize: 40,
  },
  readyDescription: {
    color: theme.textSecondary,
    fontSize: 16,
    lineHeight: 26,
    textAlign: 'center',
    marginBottom: Spacing.five,
    maxWidth: 300,
  },
  readyStyleCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#121214',
    borderRadius: 20,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.2)',
  },
  readyStyleLabel: {
    color: theme.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: Spacing.two,
    letterSpacing: 0.5,
  },
  readyStyleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  readyStyleEmoji: {
    fontSize: 24,
  },
  readyStyleName: {
    color: theme.text,
    fontSize: 22,
    fontWeight: '800',
  },
  footer: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  primaryButton: {
    backgroundColor: accent,
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8,
  },
  primaryButtonDisabled: {
    opacity: 0.45,
    shadowOpacity: 0,
  },
  primaryButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  primaryButtonGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
