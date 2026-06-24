import { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Modal, StyleSheet, Text, View } from 'react-native';

import { APP_MESSAGES } from '@/lib/app-errors';
import { Colors, Spacing } from '@/constants/theme';
import { NS } from '@/constants/nanisuru-ui';

const theme = Colors.dark;
const accent = NS.colors.accent;

export const LOADING_STEPS = [
  { icon: '📍', label: APP_MESSAGES.loadingSearchingPlaces },
  { icon: '🤖', label: APP_MESSAGES.loadingAiPlanning },
  { icon: '☀️', label: '天気を確認しています…' },
  { icon: '💰', label: '予算を最適化しています…' },
  { icon: '🗺', label: APP_MESSAGES.loadingPreparingRoute },
  { icon: '✨', label: 'コンシェルジュプラン完成' },
] as const;

const STEP_SUBTITLES = [
  'Google Places から実在スポットを取得中',
  'あなたの条件に合わせてAIが設計中',
  '天候に合わせた提案を準備中',
  '現地通貨で予算を調整中',
  '移動しやすいルートを組み立て中',
  'もうすぐ完成です',
] as const;

type StepStatus = 'pending' | 'active' | 'done';

function LoadingStepRow({
  icon,
  label,
  status,
}: {
  icon: string;
  label: string;
  status: StepStatus;
}) {
  const opacity = useRef(new Animated.Value(status === 'pending' ? 0.35 : 1)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: status === 'pending' ? 0.35 : 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [opacity, status]);

  return (
    <Animated.View style={[styles.stepRow, { opacity }]}>
      <View
        style={[
          styles.stepIconWrap,
          status === 'active' && styles.stepIconWrapActive,
          status === 'done' && styles.stepIconWrapDone,
        ]}>
        {status === 'done' ? (
          <Text style={styles.stepCheck}>✓</Text>
        ) : status === 'active' ? (
          <ActivityIndicator size="small" color={accent} />
        ) : (
          <Text style={styles.stepIcon}>{icon}</Text>
        )}
      </View>
      <Text
        style={[
          styles.stepLabel,
          status === 'active' && styles.stepLabelActive,
          status === 'done' && styles.stepLabelDone,
        ]}>
        {label}
      </Text>
    </Animated.View>
  );
}

type PlanLoadingScreenProps = {
  visible: boolean;
  currentStep: number;
};

export function PlanLoadingScreen({ visible, currentStep }: PlanLoadingScreenProps) {
  const progress = useRef(new Animated.Value(0)).current;
  const safeStep = Math.min(Math.max(currentStep, 0), LOADING_STEPS.length - 1);

  useEffect(() => {
    if (!visible) {
      progress.setValue(0);
      return;
    }

    Animated.timing(progress, {
      toValue: (safeStep + 1) / LOADING_STEPS.length,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [safeStep, progress, visible]);

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Nanisuru</Text>
          <Text style={styles.subtitle}>{LOADING_STEPS[safeStep].label}</Text>
          <Text style={styles.subtitleHint}>{STEP_SUBTITLES[safeStep]}</Text>

          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
          </View>

          <View style={styles.stepsList}>
            {LOADING_STEPS.map((step, index) => {
              let status: StepStatus = 'pending';
              if (index < safeStep) status = 'done';
              else if (index === safeStep) status = 'active';

              return (
                <LoadingStepRow key={step.label} icon={step.icon} label={step.label} status={status} />
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runLoadingAnimation(
  setCurrentStep: (step: number) => void,
  stepDelayMs = 900,
): Promise<void> {
  for (let i = 0; i < LOADING_STEPS.length; i++) {
    setCurrentStep(i);
    await delay(stepDelayMs);
  }
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: NS.colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.xxl,
    padding: Spacing.five,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
    ...NS.shadow.accent,
  },
  title: {
    color: theme.text,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    color: theme.text,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: Spacing.two,
    fontWeight: '700',
  },
  subtitleHint: {
    color: theme.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: Spacing.one,
    marginBottom: Spacing.four,
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: Spacing.four,
  },
  progressFill: {
    height: '100%',
    backgroundColor: accent,
    borderRadius: 2,
  },
  stepsList: {
    gap: Spacing.three,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  stepIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1A1A1D',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIconWrapActive: {
    backgroundColor: 'rgba(129, 140, 248, 0.12)',
    borderColor: 'rgba(129, 140, 248, 0.4)',
  },
  stepIconWrapDone: {
    backgroundColor: NS.colors.successSoft,
    borderColor: 'rgba(52, 211, 153, 0.35)',
  },
  stepIcon: {
    fontSize: 16,
  },
  stepCheck: {
    color: NS.colors.success,
    fontSize: 16,
    fontWeight: '700',
  },
  stepLabel: {
    color: theme.textSecondary,
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  stepLabelActive: {
    color: theme.text,
    fontWeight: '700',
  },
  stepLabelDone: {
    color: theme.textSecondary,
  },
});
