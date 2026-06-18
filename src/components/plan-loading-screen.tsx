import { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Modal, StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

const theme = Colors.dark;
const accent = '#818CF8';

export const LOADING_STEPS = [
  { icon: '📍', label: '場所を分析中' },
  { icon: '☀️', label: '天気を確認中' },
  { icon: '🍽️', label: 'おすすめスポットを検索中' },
  { icon: '🤖', label: '最適なプランを作成中' },
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

  useEffect(() => {
    if (!visible) {
      progress.setValue(0);
      return;
    }

    Animated.timing(progress, {
      toValue: (currentStep + 1) / LOADING_STEPS.length,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [currentStep, progress, visible]);

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Nanisuru</Text>
          <Text style={styles.subtitle}>あなたにぴったりの1日を準備しています</Text>

          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
          </View>

          <View style={styles.stepsList}>
            {LOADING_STEPS.map((step, index) => {
              let status: StepStatus = 'pending';
              if (index < currentStep) status = 'done';
              else if (index === currentStep) status = 'active';

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
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#121214',
    borderRadius: 28,
    padding: Spacing.five,
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.2)',
    shadowColor: accent,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.3,
    shadowRadius: 32,
    elevation: 16,
  },
  title: {
    color: theme.text,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    color: theme.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: Spacing.two,
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
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    borderColor: 'rgba(52, 211, 153, 0.35)',
  },
  stepIcon: {
    fontSize: 16,
  },
  stepCheck: {
    color: '#34D399',
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
