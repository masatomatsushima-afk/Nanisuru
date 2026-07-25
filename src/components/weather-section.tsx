import { StyleSheet, Text, View } from 'react-native';

import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { getWeatherIcon } from '@/lib/weather';
import { getWeatherUnavailableUserMessage } from '@/lib/weather-planning';
import type { WeatherForecast } from '@/types/plan';

type WeatherSectionProps = {
  weather: WeatherForecast;
  compact?: boolean;
};

function resolvePlanningMode(weather: WeatherForecast) {
  // Real daily forecast wins even if a stale seasonalContext sneaks in.
  if (weather.available !== false && weather.days.length > 0) {
    return 'forecast' as const;
  }
  if (weather.planningMode === 'forecast' && weather.days.length > 0) {
    return 'forecast' as const;
  }
  if (weather.planningMode === 'seasonal' || weather.unavailableReason === 'outside_forecast_range') {
    return 'seasonal' as const;
  }
  if (weather.available === false || weather.planningMode === 'unavailable') {
    return 'unavailable' as const;
  }
  return 'forecast' as const;
}

function dayCaution(day: WeatherForecast['days'][number]): string | null {
  if (day.category === 'rainy' || day.precipitationProbability >= 50) return '雨に注意';
  if (day.category === 'snow') return '雪に注意';
  if (day.temperatureMax >= 33) return '暑さに注意';
  if (day.temperatureMin <= 5) return '冷え込みに注意';
  return null;
}

/**
 * Compact weather card for Plan Detail.
 * Forecast: daily rows. Unavailable: reason-specific message (no rain/umbrella assertions).
 */
export function WeatherSection({ weather, compact = false }: WeatherSectionProps) {
  const mode = resolvePlanningMode(weather);
  const seasonal = weather.seasonalContext;
  const showDailyForecast = mode === 'forecast' && weather.days.length > 0;

  if (mode === 'unavailable' && !seasonal && weather.days.length === 0 && !weather.planningMessage) {
    return null;
  }

  const title = mode === 'forecast' ? '旅行中の天気予報' : '季節の天候傾向';
  const unavailableMessage =
    weather.planningMessage?.trim() ||
    getWeatherUnavailableUserMessage(weather.unavailableReason);

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <Text style={styles.title}>{title}</Text>
      {weather.locationName ? (
        <Text style={styles.location}>{weather.locationName}</Text>
      ) : null}

      {showDailyForecast ? (
        <View style={styles.dayList}>
          {weather.days.map((day) => {
            const caution = dayCaution(day);
            return (
              <View key={day.date} style={styles.dayRow}>
                <Text style={styles.dayIcon}>{getWeatherIcon(day.category)}</Text>
                <View style={styles.dayContent}>
                  <Text style={styles.dayLabel}>{day.label}</Text>
                  <Text style={styles.dayCondition}>{day.condition}</Text>
                  <Text style={styles.dayTemps}>
                    最高{day.temperatureMax}℃ / 最低{day.temperatureMin}℃
                  </Text>
                  <Text style={styles.dayPrecip}>降水確率{day.precipitationProbability}%</Text>
                  {caution ? <Text style={styles.dayCaution}>{caution}</Text> : null}
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      {mode !== 'forecast' ? (
        <View style={styles.seasonalBlock}>
          {seasonal && mode === 'seasonal' ? (
            <Text style={styles.seasonalLine}>
              {seasonal.monthLabel} · {seasonal.seasonLabel}
            </Text>
          ) : null}
          <Text style={styles.seasonalGuidance}>{unavailableMessage}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing.two,
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    borderWidth: 1,
    borderColor: NS.colors.border,
  },
  containerCompact: {
    marginTop: Spacing.one,
    paddingVertical: Spacing.two,
  },
  title: {
    color: NS.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  location: {
    color: NS.colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  dayList: {
    marginTop: Spacing.two,
    gap: Spacing.two,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  dayIcon: {
    fontSize: 18,
    width: 24,
    textAlign: 'center',
    marginTop: 1,
  },
  dayContent: {
    flex: 1,
    gap: 1,
  },
  dayLabel: {
    color: NS.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  dayCondition: {
    color: NS.colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  dayTemps: {
    color: NS.colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  dayPrecip: {
    color: NS.colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  dayCaution: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  seasonalBlock: {
    marginTop: Spacing.two,
    gap: 4,
  },
  seasonalLine: {
    color: NS.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  seasonalGuidance: {
    color: NS.colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
});
