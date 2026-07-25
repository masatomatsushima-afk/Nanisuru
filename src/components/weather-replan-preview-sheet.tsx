import { useCallback, useEffect, useRef, useState } from 'react';
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
import { previewWeatherReplan } from '@/lib/weather-replan';
import { WEATHER_REPLAN_TIMEOUT_MS } from '@/lib/weather-replan-pipeline';
import type { SavedTripPayload } from '@/types/trip';
import type { WeatherReplanPreviewSuccess } from '@/types/weather-replan';

type WeatherReplanPreviewSheetProps = {
  visible: boolean;
  payload: SavedTripPayload;
  onClose: () => void;
  onApply: (nextPayload: SavedTripPayload, preview: WeatherReplanPreviewSuccess) => Promise<void>;
};

type SheetStatus = 'idle' | 'loading' | 'success' | 'error';

export function WeatherReplanPreviewSheet({
  visible,
  payload,
  onClose,
  onApply,
}: WeatherReplanPreviewSheetProps) {
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<SheetStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<WeatherReplanPreviewSuccess | null>(null);
  const [applying, setApplying] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const safeSet = useCallback(<T,>(setter: (value: T) => void, value: T) => {
    if (mountedRef.current) setter(value);
  }, []);

  const loadPreview = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = ++requestIdRef.current;

    safeSet(setStatus, 'loading');
    safeSet(setErrorMessage, null);
    safeSet(setPreview, null);

    const watchdog = setTimeout(() => {
      controller.abort();
    }, WEATHER_REPLAN_TIMEOUT_MS + 2_000);

    let settled = false;
    try {
      const result = await previewWeatherReplan(payload, { abortSignal: controller.signal });
      if (!mountedRef.current || requestId !== requestIdRef.current) return;

      settled = true;
      if (!result.success) {
        safeSet(setErrorMessage, result.errorMessage);
        safeSet(setStatus, 'error');
        return;
      }
      safeSet(setPreview, result);
      safeSet(setStatus, 'success');
    } catch {
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      settled = true;
      safeSet(
        setErrorMessage,
        '再調整できませんでした。元のプランは変更されていません。',
      );
      safeSet(setStatus, 'error');
    } finally {
      clearTimeout(watchdog);
      if (mountedRef.current && requestId === requestIdRef.current) {
        console.info('[weather-replan]', { loadingCleared: true });
        if (!settled) {
          safeSet(
            setErrorMessage,
            '再調整できませんでした。元のプランは変更されていません。',
          );
          safeSet(setStatus, 'error');
        }
      }
    }
  }, [payload, safeSet]);

  useEffect(() => {
    if (visible) {
      void loadPreview();
    } else {
      abortRef.current?.abort();
      setPreview(null);
      setErrorMessage(null);
      setStatus('idle');
      setApplying(false);
    }
  }, [visible, loadPreview]);

  const handleClose = () => {
    abortRef.current?.abort();
    onClose();
  };

  const handleApply = async () => {
    if (!preview || applying || status !== 'success') return;
    setApplying(true);
    try {
      await onApply(preview.afterPayload, preview);
      handleClose();
    } catch {
      if (mountedRef.current) {
        setErrorMessage('再調整できませんでした。元のプランは変更されていません。');
        setStatus('error');
        setPreview(null);
      }
    } finally {
      if (mountedRef.current) setApplying(false);
    }
  };

  const forecastDayCount =
    preview?.forecastDayCount ?? preview?.freshWeather.days.length ?? 0;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.four }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>天気に合わせて再調整</Text>
          <Text style={styles.subtitle}>
            雨の時間帯や暑さをもとに必要な予定だけ調整します
          </Text>

          {status === 'loading' ? (
            <View style={styles.centerBlock}>
              <ActivityIndicator color={NS.colors.accent} size="large" />
              <Text style={styles.loadingText}>天気に合わせて調整しています…</Text>
              <PrimaryButton label="キャンセル" variant="secondary" onPress={handleClose} />
            </View>
          ) : status === 'error' ? (
            <View style={styles.centerBlock}>
              <Text style={styles.errorText}>
                {errorMessage ?? '再調整できませんでした。元のプランは変更されていません。'}
              </Text>
              <PrimaryButton label="閉じる" variant="secondary" onPress={handleClose} />
            </View>
          ) : status === 'success' && preview ? (
            <>
              <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                <Text style={styles.sectionLabel}>対象の予報</Text>
                <Text style={styles.weatherSummary}>
                  {forecastDayCount > 0
                    ? `${forecastDayCount}日分の予報をもとに調整します`
                    : preview.freshWeather.summary}
                </Text>

                <Text style={styles.sectionLabel}>変更したポイント</Text>
                <View style={styles.changeList}>
                  {preview.changePoints.map((point) => (
                    <View key={point} style={styles.changeRow}>
                      <Text style={styles.changeBullet}>•</Text>
                      <Text style={styles.changeText}>{point}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>

              <View style={styles.actions}>
                <PrimaryButton
                  label={applying ? '反映中…' : '再調整する'}
                  onPress={() => void handleApply()}
                  disabled={applying}
                />
                <PrimaryButton
                  label="元のプランのままにする"
                  variant="secondary"
                  onPress={handleClose}
                  disabled={applying}
                />
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
  scroll: {
    maxHeight: 360,
  },
  scrollContent: {
    gap: Spacing.two,
    paddingBottom: Spacing.three,
  },
  sectionLabel: {
    color: NS.colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginTop: Spacing.two,
  },
  weatherSummary: {
    color: NS.colors.text,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
  },
  changeList: {
    gap: Spacing.two,
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
  actions: {
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
});
