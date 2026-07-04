import { ActivityIndicator, Modal, Platform, StyleSheet, Text, View } from 'react-native';

import { PLAN_LOADING_STAGES } from '@/lib/plan-generation-progress';

type StepStatus = 'pending' | 'active' | 'done';

function StepRow({ label, status }: { label: string; status: StepStatus }) {
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
          <ActivityIndicator size="small" color="#FB923C" />
        ) : (
          <View style={styles.stepDot} />
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

export type PlanGenerationOverlayProps = {
  visible: boolean;
  stepIndex: number;
  title?: string;
  subtitle?: string;
};

const DEFAULT_TITLE = 'プランを作成中';
const DEFAULT_SUBTITLE = 'あなたにぴったりの旅を組み立てています';

export function PlanGenerationOverlay({
  visible,
  stepIndex,
  title = DEFAULT_TITLE,
  subtitle = DEFAULT_SUBTITLE,
}: PlanGenerationOverlayProps) {
  const safeStep = Math.min(Math.max(stepIndex, 0), PLAN_LOADING_STAGES.length - 1);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      presentationStyle="overFullScreen">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          <View style={styles.stepsList}>
            {PLAN_LOADING_STAGES.map((step, index) => {
              let status: StepStatus = 'pending';
              if (index < safeStep) status = 'done';
              else if (index === safeStep) status = 'active';

              return <StepRow key={step.label} label={step.label} status={status} />;
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
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
    width: '85%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    gap: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
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
  stepsList: {
    gap: 10,
    marginTop: 4,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
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
  stepDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#CBD5E1',
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
