import { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Spacing } from '@/constants/theme';
import { NS, gradientStyle } from '@/constants/nanisuru-ui';
import {
  getMultiDayTimingNote,
  PLAN_LOADING_STAGES,
  type PlanLoadingUiState,
} from '@/lib/plan-generation-progress';

const accent = NS.colors.accent;

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

export type PlanLoadingScreenProps = {
  visible: boolean;
  uiState: PlanLoadingUiState;
  onCancel?: () => void;
};

const DEFAULT_UI_STATE: PlanLoadingUiState = {
  step: 0,
  progress: 0,
  headline: 'プランを作成中です',
  estimateLabel: '完成まで約30秒かかります',
  remainingLabel: '準備中…',
  statusHint: PLAN_LOADING_STAGES[0].hint,
  isLongRunning: false,
  showMultiDayNote: false,
};

export function PlanLoadingScreen({
  visible,
  uiState = DEFAULT_UI_STATE,
  onCancel,
}: PlanLoadingScreenProps) {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const safeStep = Math.min(Math.max(uiState.step, 0), PLAN_LOADING_STAGES.length - 1);

  useEffect(() => {
    if (!visible) {
      progressAnim.setValue(0);
      return;
    }

    Animated.timing(progressAnim, {
      toValue: uiState.progress,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [progressAnim, uiState.progress, visible]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={[styles.card, gradientStyle('hero')]}>
          <Text style={styles.brand}>✨ Nanisuru</Text>
          <Text style={styles.headline}>{uiState.headline}</Text>
          <Text style={styles.estimate}>{uiState.estimateLabel}</Text>
          <Text style={styles.remaining}>{uiState.remainingLabel}</Text>

          {uiState.showMultiDayNote ? (
            <Text style={styles.multiDayNote}>{getMultiDayTimingNote()}</Text>
          ) : null}

          {uiState.stagedMessage ? (
            <View style={styles.stagedBadge}>
              <Text style={styles.stagedBadgeText}>{uiState.stagedMessage}</Text>
            </View>
          ) : null}

          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
          </View>

          <Text style={styles.statusHint}>
            {uiState.isLongRunning ? uiState.statusHint : PLAN_LOADING_STAGES[safeStep].label}
          </Text>
          {!uiState.isLongRunning ? (
            <Text style={styles.statusSubHint}>{uiState.statusHint}</Text>
          ) : null}

          <View style={styles.stepsList}>
            {PLAN_LOADING_STAGES.map((step, index) => {
              let status: StepStatus = 'pending';
              if (index < safeStep) status = 'done';
              else if (index === safeStep) status = 'active';

              return (
                <LoadingStepRow key={step.label} icon={step.icon} label={step.label} status={status} />
              );
            })}
          </View>

          {onCancel ? (
            <Pressable
              style={({ pressed }) => [styles.cancelButton, pressed && styles.cancelButtonPressed]}
              onPress={onCancel}>
              <Text style={styles.cancelButtonText}>キャンセル</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

export {
  createPlanGenerationProgress,
  getGenerationTimeEstimate,
  isAbortError,
  type PlanGenerationProgressHandle,
  type PlanLoadingUiState,
} from '@/lib/plan-generation-progress';

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
    maxWidth: 380,
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.xxl,
    padding: Spacing.five,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
    ...NS.shadow.cardLg,
  },
  brand: {
    color: NS.colors.accent,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  headline: {
    color: NS.colors.text,
    fontSize: 17,
    lineHeight: 26,
    textAlign: 'center',
    marginTop: Spacing.three,
    fontWeight: '800',
  },
  estimate: {
    color: NS.colors.coral,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: Spacing.two,
    fontWeight: '800',
  },
  remaining: {
    color: NS.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: Spacing.one,
  },
  multiDayNote: {
    color: NS.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  stagedBadge: {
    alignSelf: 'center',
    marginTop: Spacing.two,
    backgroundColor: NS.colors.yellowSoft,
    borderRadius: NS.radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.35)',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  stagedBadgeText: {
    color: '#B45309',
    fontSize: 12,
    fontWeight: '800',
  },
  progressTrack: {
    height: 10,
    backgroundColor: NS.colors.bgInput,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: Spacing.four,
    marginBottom: Spacing.three,
    borderWidth: 1,
    borderColor: NS.colors.border,
  },
  progressFill: {
    height: '100%',
    backgroundColor: NS.colors.sky,
    borderRadius: 999,
  },
  statusHint: {
    color: NS.colors.text,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    fontWeight: '800',
  },
  statusSubHint: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: Spacing.three,
  },
  stepsList: {
    gap: Spacing.two + 2,
    marginTop: Spacing.one,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  stepIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: NS.colors.bgElevated,
    borderWidth: 1,
    borderColor: NS.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIconWrapActive: {
    backgroundColor: NS.colors.orangeSoft,
    borderColor: 'rgba(251, 146, 60, 0.35)',
  },
  stepIconWrapDone: {
    backgroundColor: NS.colors.mintSoft,
    borderColor: 'rgba(52, 211, 153, 0.35)',
  },
  stepIcon: {
    fontSize: 15,
  },
  stepCheck: {
    color: NS.colors.success,
    fontSize: 15,
    fontWeight: '800',
  },
  stepLabel: {
    color: NS.colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  stepLabelActive: {
    color: NS.colors.text,
    fontWeight: '800',
  },
  stepLabelDone: {
    color: NS.colors.textSecondary,
  },
  cancelButton: {
    marginTop: Spacing.four,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: NS.radius.pill,
    borderWidth: 1,
    borderColor: NS.colors.borderStrong,
    backgroundColor: NS.colors.bgElevated,
  },
  cancelButtonPressed: {
    opacity: 0.85,
  },
  cancelButtonText: {
    color: NS.colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
});
