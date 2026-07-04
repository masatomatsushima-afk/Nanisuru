import { StyleSheet, Text, View } from 'react-native';

import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { getWeatherIcon } from '@/lib/weather';
import type { WeatherForecast } from '@/types/plan';

const accent = NS.colors.accent;
const concierge = NS.concierge.weather;

type WeatherSectionProps = {
  weather: WeatherForecast;
  compact?: boolean;
};

function resolvePlanningMode(weather: WeatherForecast) {
  if (weather.planningMode) return weather.planningMode;
  if (weather.seasonalContext) return 'seasonal' as const;
  if (weather.available === false) return 'unavailable' as const;
  return 'forecast' as const;
}

export function WeatherSection({ weather, compact = false }: WeatherSectionProps) {
  const mode = resolvePlanningMode(weather);
  const statusMessage = weather.planningMessage;
  const seasonal = weather.seasonalContext;
  const showDailyForecast = mode === 'forecast' && weather.days.length > 0;

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>WEATHER</Text>
        <Text style={styles.title}>{mode === 'seasonal' ? '季節の天候傾向' : '天気予報'}</Text>
        <Text style={styles.location}>{weather.locationName}</Text>
        {statusMessage ? <Text style={styles.statusMessage}>{statusMessage}</Text> : null}
        {!compact ? <Text style={styles.summary}>{weather.summary}</Text> : null}
        {seasonal ? (
          <View style={styles.seasonalBlock}>
            <Text style={styles.seasonalLine}>
              {seasonal.monthLabel} · {seasonal.seasonLabel}
            </Text>
            <Text style={styles.seasonalGuidance}>{seasonal.guidance}</Text>
            <Text style={styles.seasonalOutfit}>おすすめの服装: {seasonal.outfitAdvice}</Text>
            {seasonal.riskNotes.length > 0 ? (
              <Text style={styles.seasonalRisks}>
                注意: {seasonal.riskNotes.join(' / ')}
              </Text>
            ) : null}
          </View>
        ) : null}
        {mode === 'unavailable' && !statusMessage ? (
          <Text style={styles.unavailableNote}>
            天気情報が取得できなかったため、天候に左右されにくいプランも含めています
          </Text>
        ) : null}
        {weather.rescheduleNote && mode !== 'forecast' ? (
          <Text style={styles.rescheduleNote}>{weather.rescheduleNote}</Text>
        ) : null}
      </View>

      {showDailyForecast ? (
        <View style={styles.dayList}>
          {weather.days.map((day) => (
            <View key={day.date} style={styles.dayRow}>
              <Text style={styles.dayIcon}>{getWeatherIcon(day.category)}</Text>
              <View style={styles.dayContent}>
                <Text style={styles.dayLabel}>{day.label}</Text>
                <Text style={styles.dayCondition}>
                  {day.condition} · {day.summary}
                </Text>
                {day.preferIndoor ? (
                  <Text style={styles.dayHintIndoor}>屋内スポット優先</Text>
                ) : day.preferOutdoor ? (
                  <Text style={styles.dayHintOutdoor}>屋外スポット優先</Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {compact ? <Text style={styles.compactSummary}>{weather.summary}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing.three,
    backgroundColor: concierge.bg,
    borderRadius: NS.radius.xl,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: concierge.border,
    ...NS.shadow.card,
  },
  containerCompact: {
    marginTop: Spacing.two,
    padding: Spacing.three,
  },
  header: {
    marginBottom: Spacing.three,
  },
  eyebrow: {
    color: accent,
    ...NS.typography.eyebrow,
    marginBottom: Spacing.one,
  },
  title: {
    color: NS.colors.text,
    ...NS.typography.headline,
  },
  location: {
    color: NS.colors.textSecondary,
    ...NS.typography.bodySm,
    marginTop: Spacing.one,
  },
  statusMessage: {
    color: NS.colors.text,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
    marginTop: Spacing.two,
  },
  summary: {
    color: NS.colors.textSecondary,
    ...NS.typography.bodySm,
    marginTop: Spacing.two,
    lineHeight: 22,
  },
  seasonalBlock: {
    marginTop: Spacing.two,
    gap: Spacing.one,
  },
  seasonalLine: {
    color: NS.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  seasonalGuidance: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  seasonalOutfit: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  seasonalRisks: {
    color: NS.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  unavailableNote: {
    color: NS.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: Spacing.two,
  },
  rescheduleNote: {
    color: NS.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: Spacing.two,
    fontStyle: 'italic',
  },
  compactSummary: {
    color: NS.colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: Spacing.two,
  },
  dayList: {
    gap: Spacing.two,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    paddingVertical: Spacing.one,
  },
  dayIcon: {
    fontSize: 22,
    width: 28,
    textAlign: 'center',
    marginTop: 2,
  },
  dayContent: {
    flex: 1,
    gap: 2,
  },
  dayLabel: {
    color: NS.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  dayCondition: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  dayHintIndoor: {
    color: '#93C5FD',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  dayHintOutdoor: {
    color: NS.colors.success,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
});
