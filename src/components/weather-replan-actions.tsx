import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { WeatherReplanPreviewSheet } from '@/components/weather-replan-preview-sheet';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { isOpenAiConfigured } from '@/lib/generate-plan';
import { getWeatherReplanEligibility } from '@/lib/weather-replan';
import type { SavedTripPayload } from '@/types/trip';
import type { WeatherReplanPreviewSuccess } from '@/types/weather-replan';

type WeatherReplanActionsProps = {
  payload: SavedTripPayload;
  onApply: (nextPayload: SavedTripPayload, preview: WeatherReplanPreviewSuccess) => Promise<void>;
  compact?: boolean;
};

export function WeatherReplanActions({ payload, onApply, compact = false }: WeatherReplanActionsProps) {
  const [showSheet, setShowSheet] = useState(false);
  const tripDate = payload.details.tripDate;
  const eligibility = useMemo(
    () => getWeatherReplanEligibility(tripDate, payload.details.weather),
    [tripDate, payload.details.weather],
  );

  if (eligibility.status === 'hidden' || !isOpenAiConfigured()) {
    return null;
  }

  if (eligibility.status === 'future') {
    return (
      <Text style={[styles.futureNote, compact && styles.futureNoteCompact]}>{eligibility.message}</Text>
    );
  }

  return (
    <>
      <View style={[styles.wrap, compact && styles.wrapCompact]}>
        {eligibility.highlight ? (
          <Text style={styles.highlightNote}>
            季節の傾向で作成したプランです。出発が近づいたので、最新の天気に合わせて調整できます。
          </Text>
        ) : null}
        <Pressable
          style={[styles.button, compact && styles.buttonCompact]}
          onPress={() => setShowSheet(true)}>
          <Text style={styles.buttonText}>天気に合わせて再調整</Text>
        </Pressable>
      </View>

      <WeatherReplanPreviewSheet
        visible={showSheet}
        payload={payload}
        onClose={() => setShowSheet(false)}
        onApply={onApply}
      />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: Spacing.three,
    gap: Spacing.two,
  },
  wrapCompact: {
    marginTop: Spacing.two,
  },
  highlightNote: {
    color: NS.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  futureNote: {
    color: NS.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: Spacing.two,
    fontStyle: 'italic',
  },
  futureNoteCompact: {
    marginTop: Spacing.one,
  },
  button: {
    alignSelf: 'stretch',
    backgroundColor: NS.colors.coralSoft,
    borderRadius: NS.radius.lg,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two + 2,
    borderWidth: 1.5,
    borderColor: NS.colors.coral,
    alignItems: 'center',
  },
  buttonCompact: {
    paddingVertical: Spacing.one + 2,
    paddingHorizontal: Spacing.three,
  },
  buttonText: {
    color: NS.colors.coral,
    fontSize: 14,
    fontWeight: '800',
  },
});
