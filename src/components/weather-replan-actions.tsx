import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { WeatherReplanPreviewSheet } from '@/components/weather-replan-preview-sheet';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { getWeatherReplanEligibility } from '@/lib/weather-replan-eligibility';
import type { SavedTripPayload } from '@/types/trip';
import type { WeatherReplanPreviewSuccess } from '@/types/weather-replan';

type WeatherReplanActionsProps = {
  payload: SavedTripPayload;
  onApply: (nextPayload: SavedTripPayload, preview: WeatherReplanPreviewSuccess) => Promise<void>;
  compact?: boolean;
  /** inline = note + button; weather-note = note only; actions = button in action group */
  placement?: 'inline' | 'weather-note' | 'actions';
};

export function WeatherReplanActions({
  payload,
  onApply,
  compact = false,
  placement = 'inline',
}: WeatherReplanActionsProps) {
  const [showSheet, setShowSheet] = useState(false);
  const tripDate = payload.details.tripDate;
  const eligibility = useMemo(
    () => getWeatherReplanEligibility(tripDate, payload.details.weather),
    [tripDate, payload.details.weather],
  );

  // Replan itself is local + Places gates (no OpenAI required for β stability).
  if (eligibility.status === 'hidden') {
    return null;
  }

  if (eligibility.status === 'future') {
    if (placement === 'actions') return null;
    return (
      <Text style={[styles.futureNote, compact && styles.futureNoteCompact]}>
        {eligibility.message}
      </Text>
    );
  }

  const openSheet = () => {
    if (showSheet) return;
    setShowSheet(true);
  };

  const buttonLabel = eligibility.buttonLabel;
  const button = (
    <Pressable
      style={[styles.button, compact && styles.buttonCompact, placement === 'actions' && styles.buttonAction]}
      onPress={openSheet}
      disabled={showSheet}>
      <Text style={styles.buttonText}>{buttonLabel}</Text>
    </Pressable>
  );

  if (placement === 'weather-note') {
    return eligibility.highlight ? (
      <Text style={[styles.highlightNote, compact && styles.highlightNoteCompact]}>
        季節の傾向で作成したプランです。出発が近づいたら、最新の天気に合わせて再調整できます。
      </Text>
    ) : null;
  }

  if (placement === 'actions') {
    return (
      <>
        {button}
        <WeatherReplanPreviewSheet
          visible={showSheet}
          payload={payload}
          onClose={() => setShowSheet(false)}
          onApply={onApply}
        />
      </>
    );
  }

  return (
    <>
      <View style={[styles.wrap, compact && styles.wrapCompact]}>
        {eligibility.highlight ? (
          <Text style={styles.highlightNote}>
            季節の傾向で作成したプランです。出発が近づいたら、最新の天気に合わせて再調整できます。
          </Text>
        ) : null}
        {button}
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
  highlightNoteCompact: {
    marginTop: Spacing.one,
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
  buttonAction: {
    minHeight: 48,
    justifyContent: 'center',
  },
  buttonText: {
    color: NS.colors.coral,
    fontSize: 14,
    fontWeight: '800',
  },
});
