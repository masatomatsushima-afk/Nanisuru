/**
 * Weather risk thresholds for DailyWeatherModifier.
 * Keep numbers here — do not hardcode in ranking / schedule / outfit code.
 */

export const WEATHER_RISK_THRESHOLDS = {
  /** precipitationProbabilityPercent at or above → rainRisk */
  rainProbabilityPercent: 50,
  /** precipitationProbabilityPercent for "light rain risk" (softer indoor bias) */
  lightRainProbabilityPercent: 35,
  /** precipitationAmountMm at or above → rainRisk even if probability is moderate */
  rainAmountMm: 2,
  /** Hourly precip probability considered "wet hour" */
  wetHourProbabilityPercent: 45,
  /** Hourly precip amount considered wet */
  wetHourAmountMm: 0.4,
  /** Prefer outdoor hour when precip probability at or below */
  dryHourProbabilityPercent: 25,

  /** maxFeelsLike / maxTemp (°C) at or above → heatRisk */
  heatFeelsLikeC: 32,
  /** Soft heat (shift outdoor earlier/later) */
  warmFeelsLikeC: 28,
  /** Peak heat hours to avoid for outdoor (local hour) */
  heatAvoidHourStart: 11,
  heatAvoidHourEnd: 16,
  /** Preferred cooler outdoor windows */
  coolOutdoorMorningEndHour: 10,
  coolOutdoorEveningStartHour: 17,

  /** minFeelsLike / minTemp (°C) at or below → coldRisk */
  coldFeelsLikeC: 8,
  chillyFeelsLikeC: 12,

  /** windSpeedKph at or above → strongWindRisk */
  strongWindKph: 40,

  /** Indoor ratio targets 0–1 when rain/heat/cold */
  indoorRatioRain: 0.7,
  indoorRatioHeat: 0.55,
  indoorRatioCold: 0.55,
  indoorRatioFair: 0.35,
} as const;

export type WeatherRiskLevel = 'none' | 'low' | 'moderate' | 'high';
