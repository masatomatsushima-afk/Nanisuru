import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { previewDelayAdjustment } from '@/lib/trip-day-mode-delay';
import type { SavedTripPayload } from '@/types/trip';
import { TRIP_DAY_DELAY_OPTIONS, type TripDayDelayPreviewSuccess } from '@/types/trip-day-mode';

type TripDayModeDelaySheetProps = {
  visible: boolean;
  payload: SavedTripPayload;
  dayIndex: number;
  onClose: () => void;
  onApply: (nextPayload: SavedTripPayload, preview: TripDayDelayPreviewSuccess) => Promise<void>;
  onDelaySelected?: (delayMinutes: number) => void;
};

export function TripDayModeDelaySheet({
  visible,
  payload,
  dayIndex,
  onClose,
  onApply,
  onDelaySelected,
}: TripDayModeDelaySheetProps) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<'pick' | 'preview'>('pick');
  const [selectedMinutes, setSelectedMinutes] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<TripDayDelayPreviewSuccess | null>(null);
  const [applying, setApplying] = useState(false);

  const reset = useCallback(() => {
    setStep('pick');
    setSelectedMinutes(null);
    setLoading(false);
    setErrorMessage(null);
    setPreview(null);
    setApplying(false);
  }, []);

  useEffect(() => {
    if (!visible) {
      reset();
    }
  }, [visible, reset]);

  const loadPreview = async (delayMinutes: number) => {
    setLoading(true);
    setErrorMessage(null);
    setPreview(null);
    console.log('[TripDayMode] delay selected', delayMinutes);
    onDelaySelected?.(delayMinutes);

    try {
      const result = await previewDelayAdjustment(payload, dayIndex, delayMinutes);
      if (!result.success) {
        setErrorMessage(result.errorMessage);
        return;
      }
      setPreview(result);
      setStep('preview');
    } catch {
      setErrorMessage('遅れに合わせた調整案の作成に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handlePickDelay = (minutes: number) => {
    setSelectedMinutes(minutes);
    void loadPreview(minutes);
  };

  const handleApply = async () => {
    if (!preview) return;
    setApplying(true);
    try {
      await onApply(preview.afterPayload, preview);
      onClose();
    } finally {
      setApplying(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.four }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>遅れてる</Text>
          <Text style={styles.subtitle}>どのくらい遅れていますか？</Text>

          {step === 'pick' && !loading ? (
            <View style={styles.optionList}>
              {TRIP_DAY_DELAY_OPTIONS.map((option) => (
                <Pressable
                  key={option.id}
                  style={({ pressed }) => [styles.optionButton, pressed && styles.optionPressed]}
                  onPress={() => handlePickDelay(option.minutes)}>
                  <Text style={styles.optionLabel}>{option.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {loading ? (
            <View style={styles.centerBlock}>
              <ActivityIndicator color={NS.colors.accent} size="large" />
              <Text style={styles.loadingText}>遅れに合わせた調整案を作成中…</Text>
            </View>
          ) : null}

          {errorMessage ? (
            <View style={styles.centerBlock}>
              <Text style={styles.errorText}>{errorMessage}</Text>
              <PrimaryButton label="閉じる" variant="secondary" onPress={onClose} />
            </View>
          ) : null}

          {step === 'preview' && preview ? (
            <>
              <Text style={styles.previewTitle}>遅れに合わせた調整案</Text>
              <Text style={styles.previewSummary}>{preview.changeSummary}</Text>

              <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                {preview.changePoints.map((point) => (
                  <View key={point} style={styles.changeRow}>
                    <Text style={styles.changeBullet}>•</Text>
                    <Text style={styles.changeText}>{point}</Text>
                  </View>
                ))}
              </ScrollView>

              {selectedMinutes ? (
                <Text style={styles.delayNote}>{selectedMinutes}分の遅れを想定した調整です</Text>
              ) : null}

              <View style={styles.actions}>
                <PrimaryButton
                  label={applying ? '反映中…' : 'この変更を反映'}
                  onPress={() => void handleApply()}
                  disabled={applying}
                />
                <PrimaryButton label="元のまま" variant="secondary" onPress={onClose} disabled={applying} />
              </View>
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  sheet: {
    backgroundColor: NS.colors.bgElevated,
    borderTopLeftRadius: NS.radius.xl,
    borderTopRightRadius: NS.radius.xl,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    maxHeight: '85%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: NS.colors.border,
    marginBottom: Spacing.three,
  },
  title: {
    color: NS.colors.text,
    ...NS.typography.headline,
  },
  subtitle: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginTop: Spacing.one,
    marginBottom: Spacing.three,
  },
  optionList: {
    gap: Spacing.two,
  },
  optionButton: {
    backgroundColor: NS.colors.bgCard,
    borderRadius: NS.radius.lg,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderWidth: 1,
    borderColor: NS.colors.border,
  },
  optionPressed: {
    opacity: 0.9,
  },
  optionLabel: {
    color: NS.colors.text,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  centerBlock: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.six,
  },
  loadingText: {
    color: NS.colors.textSecondary,
    fontSize: 14,
  },
  errorText: {
    color: NS.colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: Spacing.two,
  },
  previewTitle: {
    color: NS.colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: Spacing.two,
  },
  previewSummary: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: Spacing.three,
  },
  scroll: {
    maxHeight: 220,
  },
  scrollContent: {
    gap: Spacing.two,
    paddingBottom: Spacing.two,
  },
  changeRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  changeBullet: {
    color: NS.colors.accent,
    fontSize: 14,
    lineHeight: 20,
  },
  changeText: {
    flex: 1,
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  delayNote: {
    color: NS.colors.textMuted,
    fontSize: 12,
    marginTop: Spacing.two,
  },
  actions: {
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
});
