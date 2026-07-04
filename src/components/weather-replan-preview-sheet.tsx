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
import { previewWeatherReplan } from '@/lib/weather-replan';
import type { SavedTripPayload } from '@/types/trip';
import type { WeatherReplanPreviewSuccess } from '@/types/weather-replan';

type WeatherReplanPreviewSheetProps = {
  visible: boolean;
  payload: SavedTripPayload;
  onClose: () => void;
  onApply: (nextPayload: SavedTripPayload, preview: WeatherReplanPreviewSuccess) => Promise<void>;
};

export function WeatherReplanPreviewSheet({
  visible,
  payload,
  onClose,
  onApply,
}: WeatherReplanPreviewSheetProps) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<WeatherReplanPreviewSuccess | null>(null);
  const [applying, setApplying] = useState(false);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    setPreview(null);

    try {
      const result = await previewWeatherReplan(payload);
      if (!result.success) {
        setErrorMessage(result.errorMessage);
        return;
      }
      setPreview(result);
    } catch {
      setErrorMessage('最新の天気を取得できませんでした。現在のプランのまま利用できます。');
    } finally {
      setLoading(false);
    }
  }, [payload]);

  useEffect(() => {
    if (visible) {
      void loadPreview();
    } else {
      setPreview(null);
      setErrorMessage(null);
      setLoading(false);
      setApplying(false);
    }
  }, [visible, loadPreview]);

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
          <Text style={styles.title}>天気に合わせて再調整</Text>
          <Text style={styles.subtitle}>予報をもとに、必要な部分だけプランを更新します</Text>

          {loading ? (
            <View style={styles.centerBlock}>
              <ActivityIndicator color={NS.colors.accent} size="large" />
              <Text style={styles.loadingText}>最新の天気を確認しています…</Text>
            </View>
          ) : errorMessage ? (
            <View style={styles.centerBlock}>
              <Text style={styles.errorText}>{errorMessage}</Text>
              <PrimaryButton label="閉じる" variant="secondary" onPress={onClose} />
            </View>
          ) : preview ? (
            <>
              <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                <Text style={styles.sectionLabel}>最新の天気予報</Text>
                <Text style={styles.weatherSummary}>{preview.freshWeather.summary}</Text>

                <Text style={styles.sectionLabel}>変更したポイント</Text>
                <View style={styles.changeList}>
                  {preview.changePoints.map((point) => (
                    <View key={point} style={styles.changeRow}>
                      <Text style={styles.changeBullet}>•</Text>
                      <Text style={styles.changeText}>{point}</Text>
                    </View>
                  ))}
                </View>

                {preview.afterPayload.details.plannerMessage ? (
                  <>
                    <Text style={styles.sectionLabel}>プランナーより</Text>
                    <Text style={styles.plannerText}>{preview.afterPayload.details.plannerMessage}</Text>
                  </>
                ) : null}
              </ScrollView>

              <View style={styles.actions}>
                <PrimaryButton
                  label={applying ? '反映中…' : 'この変更を反映'}
                  onPress={() => void handleApply()}
                  disabled={applying}
                />
                <PrimaryButton
                  label="元のプランのままにする"
                  variant="secondary"
                  onPress={onClose}
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
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
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
  plannerText: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  actions: {
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
});
