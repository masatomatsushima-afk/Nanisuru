import { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { PLAN_LOADING_STAGES } from '@/lib/plan-generation-progress';

type StepStatus = 'pending' | 'active' | 'done';

function StepRow({
  icon,
  label,
  status,
}: {
  icon: string;
  label: string;
  status: StepStatus;
}) {
  return (
    <View style={styles.stepRow}>
      <View
        style={[
          styles.stepIconWrap,
          status === 'active' && styles.stepIconWrapActive,
          status === 'done' && styles.stepIconWrapDone,
        ]}>
        {status === 'done' ? (
          <Text style={styles.stepCheck}>✓</Text>
        ) : status === 'active' ? (
          <ActivityIndicator size="small" color={NS.colors.orange} />
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
    </View>
  );
}

function PlanGenerationOverlayCard({
  stepIndex,
  title,
  subtitle,
}: {
  stepIndex: number;
  title: string;
  subtitle: string;
}) {
  const safeStep = Math.min(Math.max(stepIndex, 0), PLAN_LOADING_STAGES.length - 1);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const progress = (safeStep + 1) / PLAN_LOADING_STAGES.length;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [progress, progressAnim]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.card}>
      <Text style={styles.brand}>✨</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
      </View>

      <View style={styles.dotsRow}>
        {PLAN_LOADING_STAGES.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              index <= safeStep && styles.dotActive,
              index === safeStep && styles.dotCurrent,
            ]}
          />
        ))}
      </View>

      <View style={styles.stepsList}>
        {PLAN_LOADING_STAGES.map((step, index) => {
          let status: StepStatus = 'pending';
          if (index < safeStep) status = 'done';
          else if (index === safeStep) status = 'active';

          return (
            <StepRow key={step.label} icon={step.icon} label={step.label} status={status} />
          );
        })}
      </View>
    </View>
  );
}

export type PlanGenerationOverlayProps = {
  visible: boolean;
  /** @deprecated use currentStepIndex */
  stepIndex?: number;
  currentStepIndex?: number;
  title?: string;
  subtitle?: string;
  /** Render above bottom-sheet content inside an existing Modal (no nested Modal). */
  embedded?: boolean;
};

const DEFAULT_TITLE = 'プランを作成中';
const DEFAULT_SUBTITLE = 'あなたにぴったりの旅を組み立てています';

export function PlanGenerationOverlay({
  visible,
  stepIndex,
  currentStepIndex,
  title = DEFAULT_TITLE,
  subtitle = DEFAULT_SUBTITLE,
  embedded = false,
}: PlanGenerationOverlayProps) {
  const resolvedStepIndex = currentStepIndex ?? stepIndex ?? 0;

  useEffect(() => {
    if (__DEV__) {
      console.log('[PlanGenerationOverlay] visible', visible, { embedded, stepIndex: resolvedStepIndex });
    }
  }, [embedded, resolvedStepIndex, visible]);

  if (!visible) {
    return null;
  }

  if (embedded) {
    return (
      <View style={styles.embeddedRoot} pointerEvents="auto">
        <PlanGenerationOverlayCard
          stepIndex={resolvedStepIndex}
          title={title}
          subtitle={subtitle}
        />
      </View>
    );
  }

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onShow={() => {
        if (__DEV__) console.log('[PlanGenerationOverlay] modal shown');
      }}>
      <View style={styles.backdrop}>
        <PlanGenerationOverlayCard
          stepIndex={resolvedStepIndex}
          title={title}
          subtitle={subtitle}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  embeddedRoot: {
    ...StyleSheet.absoluteFill,
    zIndex: 99999,
    elevation: 999,
    backgroundColor: 'rgba(15, 23, 42, 0.48)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    ...(Platform.OS === 'web'
      ? ({
          position: 'fixed',
        } as object)
      : null),
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.48)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    ...(Platform.OS === 'web'
      ? ({
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 99999,
        } as object)
      : null),
  },
  card: {
    width: '88%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: Spacing.four,
    gap: Spacing.two,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 28,
    elevation: 16,
    borderWidth: 1,
    borderColor: 'rgba(251, 146, 60, 0.18)',
  },
  brand: {
    fontSize: 28,
    textAlign: 'center',
  },
  title: {
    color: '#0F172A',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 28,
  },
  subtitle: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 22,
  },
  progressTrack: {
    height: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: Spacing.one,
  },
  progressFill: {
    height: '100%',
    backgroundColor: NS.colors.orange,
    borderRadius: 999,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
  },
  dotActive: {
    backgroundColor: '#FDBA74',
  },
  dotCurrent: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: NS.colors.orange,
  },
  stepsList: {
    gap: 10,
    marginTop: Spacing.one,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIconWrapActive: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FDBA74',
  },
  stepIconWrapDone: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  stepIcon: {
    fontSize: 14,
  },
  stepCheck: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '800',
  },
  stepLabel: {
    flex: 1,
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
  },
  stepLabelActive: {
    color: '#0F172A',
    fontWeight: '800',
  },
  stepLabelDone: {
    color: '#64748B',
  },
});
