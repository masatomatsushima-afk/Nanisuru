import type {
  AiAdvice,
  BudgetBreakdown,
  ConciergeAnalysis,
  ItineraryDay,
  ItineraryItem,
  PlanDetails,
  TripDurationOption,
} from '@/types/plan';
import { isDateRelatedCompanion } from '@/types/plan';
import type { ImaHimaMoodOption, ImaHimaTimeOption } from '@/types/imafima';
import type { BestDayMoodOption, BestDayTimeOption } from '@/types/best-day';


import { getOpenAiApiKey, isOpenAiConfigured } from './env';
import {
  buildSpontaneousContext,
  getImaHimaTripDuration,
  resolveMoodPreferences,
} from './imafima';
import {
  buildBestDayContext,
  getBestDayTripDuration,
  resolveBestDayPreferences,
} from './best-day';
import { buildConciergePrompt, type PlanInput } from './prompts';
import {
  getGeneratePlanApiUrlForLog,
  getWindowOriginForLog,
  shouldUsePlanGenerationApiProxy,
  validatePlanApiRequestConfig,
} from './plan-api-url';
import { safeJsonParse, stripJsonCodeFence } from './safe-json';
import { flattenItineraryDays, resolveDurationConfig } from './trip-duration';
import { fetchWeatherForecast, getTodayIsoDate, resolveWeatherLocation, resolveWeatherForTrip, createUnavailableWeatherForecast, type WeatherForecast } from './weather';
import { EMPTY_USER_PREFERENCES, getUserPreferences } from './user-memory';
import { getTravelMemories } from './travel-memory';
import { getTravelUserPreferences } from './travel-user-preferences';
import { EMPTY_TRAVEL_USER_PREFERENCES, hasTravelUserPreferences } from '@/types/travel-user-preferences';
import {
  loadRelevantLocalGemsForPlan,
  shouldPrioritizeLocalHiddenSpots,
} from './local-hidden-spots';
import {
  buildEmptyPlacesContext,
  enrichPlanWithRealPlaceLinks,
  fetchRealPlacesForLocation,
} from './location-places';
import {
  analyzeItineraryBalance,
  isGourmetTourIntent,
  ITINERARY_ACTIVITY_CATEGORIES,
} from './itinerary-balance';
import {
  dedupeItineraryPlaces,
  formatMinutesAsTime,
  getEarliestActivityStartMinutes,
  getLatestActivityEndMinutes,
  logItineraryQualityReport,
  shouldAttemptQualityFix,
  validateItineraryQuality,
} from './itinerary-quality';
import { formatBudgetAmount, formatBudgetDisplay } from './format-budget';
import { finalizeItineraryBeforeDisplay } from './finalize-itinerary';
import { isAbortError } from './plan-generation-progress';
import {
  buildDestinationPromptRules,
  sanitizeItineraryForDestination,
} from './destination-safety';
import {
  buildAccommodationPromptSection,
  normalizeAccommodationFields,
} from './accommodation-input';
import {
  buildDestinationDetailPromptSection,
  destinationDetailsToPayload,
  normalizeDestinationFromDetails,
  resolveDestinationDetailsFromPlanInput,
} from './destination-detail-input';
import { enforceSpecificityOnDays } from './spot-specificity';
import { validateAndFixItinerarySchedule } from './itinerary-schedule-validation';
import {
  buildTripTypePromptSection,
  resolveTripAudience,
  sanitizeItineraryTripCopy,
  sanitizePlanDetailsTripCopy,
} from './trip-type-copy';
import {
  APP_MESSAGES,
  AppError,
  OpenAiRequestError,
  PlanGenerationRequestError,
  resolvePlanGenerationFetchFailure,
} from './app-errors';
import {
  AiGenerationTimeoutError,
  createGenerationAbortSignal,
  getMaxGenerationAttempts,
  getOpenAiRetryDelayMs,
  isRetryableOpenAiError,
  sleep,
} from './openai-generation';
import { isDevFallbackEligibleError } from './openai-dev-fallback';
import {
  buildCompactPromptPlanInput,
  buildCompactSystemPrompt,
  extractPlanGenerationDevMeta,
} from './plan-generation-dev-meta';
import {
  buildDevFallbackTravelPlan,
  DESTINATION_SAFETY_FALLBACK_NOTICE,
  parseDevFallbackTravelPlanFromApiResponse,
} from './travel-plan-dev-fallback';
import { isLightweightMvp, lightweightMvpLog } from './lightweight-mvp';
import { learnFromCustomPreferences } from './custom-preferences';
import {
  buildPlanGenerationLogPayload,
  logPlanGenerationError,
  logPlanGenerationStep,
  normalizePlanGenerationInput,
  validatePlanGenerationInput,
} from './plan-generation-log';
import type { CurrencyCode } from '@/constants/currency';
import type { CustomTripDuration } from '@/types/trip-schedule';
import type { TourSuggestion, TravelTimingSettings } from '@/types/travel-timing';
import {
  BUDGET_KEY_DESCRIPTIONS,
  getBreakdownKeysForScope,
} from './budget-scope';
import { buildDefaultPreTripBookingLinks } from './pre-trip-links';
import {
  generateOutfitPackingAdvice,
  logOutfitAdviceGenerated,
} from './outfit-packing-advice';
import type { BudgetScopeSettings } from '@/types/budget-scope';

export type GeneratedPlan = {
  days: ItineraryDay[];
  items: ItineraryItem[];
  details: PlanDetails;
  /** Shown in dev when OpenAI timed out and a sample plan was used instead. */
  devFallbackNotice?: string;
};

export { isOpenAiConfigured };

type AiPlanResponse = {
  conciergeAnalysis?: ConciergeAnalysis;
  plannerMessage?: string;
  days?: ItineraryDay[];
  budgetBreakdown?: BudgetBreakdown;
  totalBudget?: string;
  duration?: string;
  highlights?: string[];
  rainyDayAlternatives?: string[];
  weatherReplanChanges?: string[];
  aiAdvice?: AiAdvice;
  tourSuggestions?: TourSuggestion[];
};

const ITINERARY_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    time: { type: 'string', description: 'Start time HH:MM' },
    activity: { type: 'string', description: 'Real place name in Japanese — must match provided real places list when available' },
    activityCategory: {
      type: 'string',
      enum: [...ITINERARY_ACTIVITY_CATEGORIES],
      description:
        'Itinerary stop category in Japanese: 食事 / カフェ / 散歩 / 体験 / 景色 / 買い物 / 文化 / 休憩 / 夜景 / 移動',
    },
    placeCategory: {
      type: 'string',
      description:
        'Short category label for the place in Japanese or English e.g. カフェ cafe brunch 美術館 — used for social search',
    },
    reason: {
      type: 'string',
      description:
        'Detailed selection reasoning in 2-3 Japanese sentences referencing preferences weather budget or travel style',
    },
    estimatedCost: {
      type: 'string',
      description: 'Realistic cost estimate with currency symbol considering party size',
    },
    transportation: {
      type: 'string',
      description:
        'Specific transport to next stop with route station walking time and fare hint; use — for last item of each day',
    },
    reservationUrl: {
      type: 'string',
      description:
        'Direct reservation URL (official booking, Tabelog reserve, etc.) or empty string if not applicable',
    },
    websiteUrl: {
      type: 'string',
      description: 'Official website URL or empty string if unknown',
    },
    travelTimeToNext: {
      type: 'string',
      description:
        'Estimated travel time to next stop in Japanese e.g. 約15分（徒歩）; use — for last item of each day',
    },
    weatherBackup: {
      type: 'string',
      description:
        'Rain or bad weather alternative for this stop in one Japanese sentence; or 天候に関わらず可 if always suitable',
    },
  },
  required: [
    'time',
    'activity',
    'activityCategory',
    'placeCategory',
    'reason',
    'estimatedCost',
    'transportation',
    'reservationUrl',
    'websiteUrl',
    'travelTimeToNext',
    'weatherBackup',
  ],
  additionalProperties: false,
} as const;

const CONCIERGE_ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    userPreferences: {
      type: 'string',
      description: 'Analysis of user preferences and history in Japanese 2-3 sentences',
    },
    weather: {
      type: 'string',
      description:
        'Weather and seasonal analysis memo in Japanese 2-3 sentences. For future trips use seasonal tendencies not exact forecast. Include clothing advice hint.',
    },
    budget: {
      type: 'string',
      description: 'Budget analysis and allocation strategy in Japanese 2-3 sentences',
    },
    tripDuration: {
      type: 'string',
      description: 'Trip duration and schedule pacing analysis in Japanese 2-3 sentences',
    },
    travelStyle: {
      type: 'string',
      description: 'Travel personality and companion style analysis in Japanese 2-3 sentences',
    },
    overallStrategy: {
      type: 'string',
      description: 'Overall concierge planning strategy in Japanese 2-4 sentences',
    },
  },
  required: [
    'userPreferences',
    'weather',
    'budget',
    'tripDuration',
    'travelStyle',
    'overallStrategy',
  ],
  additionalProperties: false,
} as const;

const AI_ADVICE_SCHEMA = {
  type: 'object',
  properties: {
    conversationTips: {
      type: 'array',
      items: { type: 'string' },
      minItems: 3,
      maxItems: 4,
    },
    recommendedTopics: {
      type: 'array',
      items: { type: 'string' },
      minItems: 3,
      maxItems: 4,
    },
    topicsToAvoid: {
      type: 'array',
      items: { type: 'string' },
      minItems: 2,
      maxItems: 3,
    },
  },
  required: ['conversationTips', 'recommendedTopics', 'topicsToAvoid'],
  additionalProperties: false,
} as const;

const BUDGET_BREAKDOWN_SCHEMA = {
  type: 'object',
  properties: {
    total: { type: 'string', description: 'Total budget with currency symbol in Japanese' },
    accommodation: { type: 'string', description: 'Accommodation cost estimate in Japanese' },
    food: { type: 'string', description: 'Food cost estimate in Japanese' },
    transportation: { type: 'string', description: 'Transportation cost estimate in Japanese' },
    activity: { type: 'string', description: 'Activity cost estimate in Japanese' },
  },
  required: ['total', 'accommodation', 'food', 'transportation', 'activity'],
  additionalProperties: false,
} as const;

function buildBudgetBreakdownSchema(budgetScope?: BudgetScopeSettings) {
  if (!budgetScope) {
    return BUDGET_BREAKDOWN_SCHEMA;
  }

  const keys = getBreakdownKeysForScope(budgetScope);
  const properties: Record<string, unknown> = {
    total: { type: 'string', description: 'Total budget with currency symbol in Japanese' },
  };

  for (const key of keys) {
    properties[key] = {
      type: 'string',
      description: `${BUDGET_KEY_DESCRIPTIONS[key]}（${symbolHint(key)}）`,
    };
  }

  const required = ['total', ...keys];

  if (budgetScope.customItems.length > 0) {
    properties.customItems = {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          amount: { type: 'string' },
        },
        required: ['label', 'amount'],
        additionalProperties: false,
      },
      minItems: 1,
      maxItems: Math.max(budgetScope.customItems.length, 1),
    };
    required.push('customItems');
  }

  return {
    type: 'object',
    properties,
    required,
    additionalProperties: false,
  };
}

function symbolHint(_key: string): string {
  return '現地通貨記号付き';
}

const TOUR_SUGGESTION_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    dayNumber: {
      type: ['number', 'null'],
      description: 'Suggested day number (1-based), or null if not tied to a specific day',
    },
    title: { type: 'string', description: 'Tour suggestion title in Japanese' },
    description: {
      type: 'string',
      description: 'Why this tour fits the trip in Japanese, mention booking if needed',
    },
    needsBooking: {
      type: 'boolean',
      description: 'True if advance booking is likely required',
    },
  },
  required: ['dayNumber', 'title', 'description', 'needsBooking'],
  additionalProperties: false,
} as const;

function buildPlanJsonSchema(
  tripDuration: TripDurationOption,
  includeAiAdvice: boolean,
  overrides?: { dayCount?: number; itemsMin?: number; itemsMax?: number },
  customDuration?: CustomTripDuration | null,
  budgetScope?: BudgetScopeSettings,
  options?: { includeTourSuggestions?: boolean; includeWeatherReplanChanges?: boolean },
) {
  const config = resolveDurationConfig(tripDuration, customDuration);
  const dayCount = overrides?.dayCount ?? config.dayCount;
  const itemsMin = overrides?.itemsMin ?? config.itemsMin;
  const itemsMax = overrides?.itemsMax ?? config.itemsMax;

  const properties: Record<string, unknown> = {
    plannerMessage: {
      type: 'string',
      description: 'Professional planner greeting message in Japanese',
    },
    days: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          dayNumber: { type: 'number', description: 'Day number starting at 1' },
          label: { type: 'string', description: 'Day label in Japanese e.g. 1日目' },
          theme: { type: 'string', description: 'Day theme in Japanese' },
          items: {
            type: 'array',
            items: ITINERARY_ITEM_SCHEMA,
            minItems: itemsMin,
            maxItems: itemsMax,
          },
        },
        required: ['dayNumber', 'label', 'theme', 'items'],
        additionalProperties: false,
      },
      minItems: dayCount,
      maxItems: dayCount,
    },
    budgetBreakdown: {
      ...buildBudgetBreakdownSchema(budgetScope),
      description: 'Category budget breakdown optimized for user budget in Japanese',
    },
    totalBudget: {
      type: 'string',
      description: 'Total trip budget with currency symbol in Japanese, same as budgetBreakdown.total',
    },
    duration: { type: 'string', description: 'Total duration in Japanese' },
    highlights: {
      type: 'array',
      items: { type: 'string' },
      minItems: 2,
      maxItems: 4,
    },
    rainyDayAlternatives: {
      type: 'array',
      items: { type: 'string' },
      minItems: 3,
      maxItems: 5,
      description: 'Specific rainy-day backup spots with when to use them in Japanese',
    },
    conciergeAnalysis: {
      ...CONCIERGE_ANALYSIS_SCHEMA,
      description: 'Pre-itinerary concierge analysis in Japanese',
    },
  };

  if (options?.includeWeatherReplanChanges) {
    properties.weatherReplanChanges = {
      type: 'array',
      items: { type: 'string' },
      minItems: 2,
      maxItems: 6,
      description:
        'Specific summary of weather-based plan changes in Japanese e.g. rain forecast indoor swap',
    };
  }

  const required = [
    'conciergeAnalysis',
    'plannerMessage',
    'days',
    'budgetBreakdown',
    'totalBudget',
    'duration',
    'highlights',
    'rainyDayAlternatives',
  ];

  if (includeAiAdvice) {
    properties.aiAdvice = {
      ...AI_ADVICE_SCHEMA,
      description: 'Date conversation advice in Japanese',
    };
    required.push('aiAdvice');
  }

  if (options?.includeTourSuggestions) {
    properties.tourSuggestions = {
      type: 'array',
      items: TOUR_SUGGESTION_ITEM_SCHEMA,
      minItems: 1,
      maxItems: 4,
      description: 'Optional tour and local experience suggestions for multi-day trips',
    };
    required.push('tourSuggestions');
  }

  if (options?.includeWeatherReplanChanges) {
    required.push('weatherReplanChanges');
  }

  return {
    type: 'object',
    properties,
    required,
    additionalProperties: false,
  };
}

/**
 * MVP lightweight mode — a much smaller schema/prompt used only when isLightweightMvp() is
 * true, so OpenAI has far fewer output tokens to generate (avoids ETIMEDOUT / 502 timeouts).
 */
const MVP_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    time: { type: 'string', description: 'HH:MM' },
    title: {
      type: 'string',
      description:
        '具体的なスポット名を含む活動名（日本語）。例: "広蔵市場でローカルグルメ"。「地元の市場散策」「人気カフェ」のような曖昧な表現は禁止。',
    },
    placeName: {
      type: 'string',
      description:
        '実在する具体的な店名・施設名・地名のみ（例: "広蔵市場"）。確信が持てる実在の場所が無い場合は、エリア名（例: "鍾路エリア"）を入れ、店名を創作しないこと。',
    },
    area: { type: 'string', description: '具体的なエリア・地区名（日本語）。例: "鍾路 / 広蔵市場"' },
    category: {
      type: 'string',
      enum: ['food', 'cafe', 'sightseeing', 'shopping', 'nightlife', 'activity'],
      description: 'このスポットの種類。',
    },
    popularityType: {
      type: 'string',
      enum: ['popular', 'hidden_gem', 'local', 'classic', 'fallback'],
      description:
        '人気の定番スポットか、穴場・ローカル向けかの目安。1日の中で popular と hidden_gem/local を混ぜること。',
    },
    description: { type: 'string', description: 'なぜこの場所を選んだかを1文で（日本語）' },
    estimatedCost: { type: 'string', description: '概算費用。現地通貨で例: 15,000KRW' },
    note: { type: 'string', description: '移動・注意点などの短い補足。無ければ空文字' },
    mapsQuery: {
      type: 'string',
      description:
        'Google Maps検索用クエリ。必ず目的地の都市名と国名（英語）を含めること。例: "Gwangjang Market Seoul Korea"。"local market"のような曖昧な語だけは禁止。',
    },
    socialQuery: {
      type: 'string',
      description:
        'Instagram/TikTok風の検索クエリ（英語）。例: "Gwangjang Market Seoul food"。空の場合はmapsQueryと同じ内容でよい。',
    },
    isSpecificPlace: {
      type: 'boolean',
      description: 'placeNameが実在する具体的な1つの場所を指す場合はtrue。抽象的な内容（エリア散策など）ならfalse。',
    },
    confidence: {
      type: 'string',
      enum: ['high', 'medium', 'low'],
      description: 'placeNameが実在すると確信できる度合い。確信が低い場合はlowにし、isSpecificPlace=falseにすること。',
    },
    source: {
      type: 'string',
      enum: ['seed', 'openai', 'google_places_later', 'fallback'],
      description: 'このスポット名の由来。通常は openai。',
    },
  },
  required: [
    'time',
    'title',
    'placeName',
    'area',
    'category',
    'popularityType',
    'description',
    'estimatedCost',
    'note',
    'mapsQuery',
    'socialQuery',
    'isSpecificPlace',
    'confidence',
    'source',
  ],
  additionalProperties: false,
} as const;

function buildMvpPlanJsonSchema(dayCount: number, itemsMin: number, itemsMax: number) {
  return {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: '目的地と期間を含む具体的な旅行タイトル（日本語）。例: 韓国2泊3日グルメ旅行',
      },
      destination: { type: 'string' },
      summary: { type: 'string', description: '旅行全体の概要を1〜2文で（日本語）' },
      budget: {
        type: 'object',
        properties: {
          amount: { type: 'number' },
          currency: { type: 'string' },
          display: { type: 'string', description: '3桁区切りで読みやすい表記。例: 200,000 KRW' },
        },
        required: ['amount', 'currency', 'display'],
        additionalProperties: false,
      },
      days: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            day: { type: 'number' },
            date: { type: 'string', description: 'YYYY-MM-DD 分からなければ空文字' },
            theme: { type: 'string' },
            timeWindow: { type: 'string', description: 'その日の活動時間帯。例: 15:00〜22:00' },
            items: {
              type: 'array',
              items: MVP_ITEM_SCHEMA,
              minItems: itemsMin,
              maxItems: itemsMax,
            },
          },
          required: ['day', 'date', 'theme', 'timeWindow', 'items'],
          additionalProperties: false,
        },
        minItems: dayCount,
        maxItems: dayCount,
      },
      isFallback: { type: 'boolean', description: '常に false を返すこと' },
    },
    required: ['title', 'destination', 'summary', 'budget', 'days', 'isFallback'],
    additionalProperties: false,
  } as const;
}

const MVP_SYSTEM_PROMPT =
  'あなたは世界中どの目的地にも対応する旅行プランナーです。指定条件に厳密に従い、実行可能な日別旅行プランのみをJSONで作成してください。' +
  '1日目は到着時刻以降から開始し、最終日は出発時刻の2〜3時間前までに終える。中日は朝から夜まで使ってよい。' +
  '各日3〜5件とし、食事・移動・休憩を自然に含め、同一エリア内で無理のない移動距離にすること。' +
  '【destination lock・最重要】You must only suggest places inside the requested destination. Never mix another city, country, or region — 指定された目的地（都市・国・地域）以外のスポットは一切禁止。これは日本国内の地方都市（例: 福岡、札幌、金沢など）や、海外の小都市・馴染みの薄い場所にも同じように適用すること。' +
  'If you are not sure a specific venue exists in the destination, use a general area or activity description instead of a place name. Do not invent fake restaurants or landmarks. 実在するか確信が持てない場合は、架空の店名・施設名を作らず、一般的なエリア表現を使うこと。' +
  'The plan must be useful even for small towns, local cities, and destinations you are less familiar with — don’t default to famous places from a different location just because you know them better.' +
  'ユーザーが指定した予算の通貨は必ずそのまま使うこと（Preserve the user\'s selected currency exactly）。目的地が海外でも、ユーザー通貨がJPYならJPYのまま、現地通貨に勝手に変換しないこと。現地通貨の目安が有用な場合はestimatedCostの中で補足程度に触れてもよいが、主要な予算通貨として扱わないこと。' +
  '【Maps検索クエリ・重要】For every item, provide a mapsQuery that includes the destination city and country (in English), e.g. "Gwangjang Market Seoul Korea" or "Fukuoka Hakata ramen Fukuoka Japan". Do not use vague map queries like "local market" or "cafe" without the destination. Never create a Google Maps query that could resolve near the user\'s current location instead of the requested destination — the mapsQuery must always be scoped to the requested destination. If the item is not a specific, real place (e.g. a general stroll or "explore the area"), set isSpecificPlace to false; otherwise true.' +
  '【具体的なスポット名・最重要】Prefer specific real places, neighborhoods, markets, restaurants, cafes, landmarks, or streets over vague descriptions. ' +
  'Avoid vague items like "local restaurant", "traditional food place", "market area", "cafe time", "hidden spot", 「地元の市場散策」「伝統的な韓国料理屋」「人気カフェ」「夜景スポット」「ショッピングエリア」「ローカルグルメ体験」のような曖昧な表現。' +
  '悪い例: 「地元の市場散策」「人気カフェ」。良い例: 「広蔵市場でローカルグルメ」「聖水洞のカフェ通り」「南山ソウルタワーで夜景」のように、具体的な店名・市場名・エリア名・ランドマーク名をtitleとplaceNameに入れること。' +
  'If you know a real place, provide it as placeName with a matching mapsQuery. If you are not confident a specific venue exists, do not invent a fake name — use a real, well-known neighborhood/area name instead (set confidence to "low" and isSpecificPlace to false in that case). ' +
  'Every mapsQuery (and socialQuery) must include the destination city/country. Mix popular/classic spots with local/hidden-gem style areas across the day (popularityType) so the plan doesn\'t read as only tourist staples. ' +
  'The plan should feel useful enough that a traveler can open Google Maps and go there directly — never rely only on the item title without a specific place or area name behind it.' +
  '【抽象item禁止・最重要】Do not create vague itinerary items. Avoid items like "local restaurant", "cafe time", "traditional food place", "shopping area", 「明洞で韓国料理」「カフェでデザート」「コリアンBBQランチ」「韓国伝統市場でショッピング」. Prefer specific real places with a placeName the user can navigate to (e.g. "明洞餃子でカルグクス", "広蔵市場でローカルグルメ"). If you are not confident a place exists, set isSpecificPlace=false, confidence="low", and use a real neighborhood/area name — do NOT invent fake restaurants or cafes. The user should be able to open Maps and go there when isSpecificPlace=true. Never mix another city or country.' +
  '【天気の扱い・重要】No real weather forecast is provided to you for this request. If weather data is unavailable, do not mention rain, snow, wind, or cold nights as facts (e.g. never write things like "雨の可能性があるため" or "夜は冷える可能性があります" without real weather data). Only mention rain gear (umbrella, waterproof shoes, etc.) when weather data explicitly indicates rain — otherwise omit it entirely. If weather is unavailable, base any seasonal remarks only on the season/month/destination (e.g. "7月後半の韓国は暑くなりやすい季節です"), never invent specific weather conditions.' +
  '【destinationLabel・最重要】When destinationLabel, city, or baseArea are provided in the user prompt, treat destinationLabel as the authoritative destination identity. Never default to country-only scope when a city is specified — lock all spots to that city. When baseArea is set, keep mornings and evenings easy to return to baseArea and cluster nearby neighborhoods on the same day. When accommodation is provided, use it as the daily start/end hub. When arrivalPoint is provided, order day-1 activities starting from arrivalPoint toward baseArea/accommodation. Minimize wasteful round trips. Every mapsQuery must include city/country/baseArea context — do not use country alone when city is known.' +
  '【宿泊先・重要】When accommodation is provided in the user prompt, treat it as the daily start/end hub (not the user\'s current GPS location). Begin mornings near the accommodation, end evenings where returning is easy, respect arrivalTime on day 1 and departureTime on the last day, and minimize wasteful round trips. Any mapsQuery for the accommodation must include destination city/country.' +
  '【スケジュール現実性・最重要】Never repeat the same placeName, mapsQuery, or area+category across the whole trip. Night view / 夜景 / タワー夜景 / ライトアップ items must start at 18:30 or later — never schedule "夜景" at 15:00. Day 1 (arrival): max 2–3 light items near baseArea/accommodation after arrivalTime. Middle days: max 4–5 items. Final day: max 0–2 items before departure — if departureTime is set, assume airport/station arrival 2–3 hours before departure; no sightseeing or meals after that cutoff (e.g. 12:00 international flight → only light breakfast + hotel checkout + airport transfer). Leave 30–60 min travel/rest buffer between items. Do not repeat the same experience type across multiple days.' +
  '【tripType・重要】Recommendation reasons (description), highlights, and planner copy MUST match the selected companion/tripType. Do NOT mention dating/couples on family trips. Do NOT mention family/kids on solo trips. Do NOT mention first dates unless companion is 初デート or plan is デートプラン. Feedback-style wording must also match tripType.' +
  '説明は短く簡潔にし、指定されたJSONスキーマの項目以外は出力しないこと。isFallbackは常にfalseにすること。';

function buildPlanDetailDestinationFields(input: PlanInput): Partial<PlanDetails> {
  const destinationDetails = resolveDestinationDetailsFromPlanInput(input);
  return {
    ...destinationDetailsToPayload(destinationDetails),
    ...normalizeAccommodationFields(
      input.accommodation ?? input.accommodationArea ?? input.accommodationName,
    ),
  };
}

function buildMvpUserPrompt(input: PlanInput): string {
  const durationConfig = resolveDurationConfig(input.tripDuration, input.customDuration);
  const timing = input.travelTiming;
  const earliestStart = getEarliestActivityStartMinutes(timing);
  const latestEnd = getLatestActivityEndMinutes(timing);
  const interests = [input.travelPurpose, input.travelIntent, input.mustVisitPlaces]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  const destinationDetails = resolveDestinationDetailsFromPlanInput(input);
  const normalized = normalizeDestinationFromDetails(destinationDetails);
  const destinationRules = buildDestinationPromptRules(normalized);
  const destinationDetailSection = buildDestinationDetailPromptSection(destinationDetails);
  const accommodationSection = buildAccommodationPromptSection(
    normalizeAccommodationFields(input.accommodation ?? input.accommodationArea),
    destinationDetails.effectiveLocation || input.location,
  );
  const tripAudience = resolveTripAudience({
    companion: input.companion,
    planCreationType: input.planCreationType ?? input.planType,
  });
  const tripTypeSection = buildTripTypePromptSection(tripAudience, input.companion);

  const lines = [
    destinationDetails.destinationLabel
      ? `目的地（destinationLabel）: ${destinationDetails.destinationLabel}`
      : `目的地: ${input.location || '未定'}`,
    destinationRules || null,
    destinationDetailSection,
    accommodationSection,
    tripTypeSection,
    `期間: ${input.durationLabel ?? input.tripDuration}（${durationConfig.dayCount}日間）`,
    input.departureDate ? `出発日: ${input.departureDate}` : null,
    input.returnDate ? `帰着日: ${input.returnDate}` : null,
    timing?.arrivalTime ? `到着時刻: ${timing.arrivalTime}` : null,
    earliestStart != null
      ? `→ 1日目は ${formatMinutesAsTime(earliestStart)} 以降に開始すること`
      : null,
    timing?.departureTime ? `出発時刻: ${timing.departureTime}` : null,
    latestEnd != null
      ? `→ 最終日は ${formatMinutesAsTime(latestEnd)} までに全アクティビティを終えること`
      : null,
    `予算: ${input.budget || '未定'} ${input.currency ?? ''}`,
    `人数: ${input.people || '1'}人`,
    `同行者: ${input.companion}`,
    input.personality ? `旅行スタイル: ${input.personality}` : null,
    interests.length > 0 ? `興味・要望: ${interests.join(' / ')}` : null,
  ].filter((line): line is string => Boolean(line));

  return `${lines.join('\n')}\n\n上記条件・ルールに従い日別の旅行プランのみを作成してください。`;
}

type MvpAiPlanResponse = {
  title?: string;
  destination?: string;
  summary?: string;
  budget?: { amount?: number; currency?: string; display?: string };
  days?: Array<{
    day: number;
    date?: string;
    theme: string;
    timeWindow?: string;
    items: Array<{
      time: string;
      title: string;
      placeName?: string;
      area: string;
      category?: string;
      popularityType?: string;
      description: string;
      estimatedCost?: string;
      note?: string;
      mapsQuery?: string;
      socialQuery?: string;
      isSpecificPlace?: boolean;
      confidence?: string;
      source?: string;
    }>;
  }>;
  isFallback?: boolean;
};

const VALID_ITEM_CATEGORIES = new Set(['food', 'cafe', 'sightseeing', 'shopping', 'nightlife', 'activity']);
const VALID_POPULARITY_TYPES = new Set(['popular', 'hidden_gem', 'local', 'classic', 'fallback']);
const VALID_CONFIDENCE_LEVELS = new Set(['high', 'medium', 'low']);
const VALID_SPOT_SOURCES = new Set(['seed', 'openai', 'google_places_later', 'fallback']);

function parseMvpAiResponse(
  raw: unknown,
  tripDuration: TripDurationOption,
  tripDate: string,
  weather: WeatherForecast | undefined,
  tripEndDate: string | undefined,
  customDuration: CustomTripDuration | undefined,
  fallbackBudget: { display: string },
): GeneratedPlan {
  const parsed = safeJsonParse<MvpAiPlanResponse | null>(
    typeof raw === 'string' ? stripJsonCodeFence(raw) : raw,
    null,
  );

  if (!parsed?.days || parsed.days.length === 0) {
    throw new Error('プランの形式が正しくありません');
  }

  const days: ItineraryDay[] = parsed.days.map((day, index) => ({
    dayNumber: day.day ?? index + 1,
    label: `${day.day ?? index + 1}日目`,
    theme: day.theme ?? '',
    timeWindow: day.timeWindow?.trim() || undefined,
    date: day.date?.trim() || undefined,
    items: (day.items ?? []).map((item) => ({
      time: item.time,
      activity: item.title,
      reason: item.description,
      placeAddress: item.area,
      placeName: item.placeName?.trim() || undefined,
      category: VALID_ITEM_CATEGORIES.has(item.category ?? '')
        ? (item.category as ItineraryItem['category'])
        : undefined,
      popularityType: VALID_POPULARITY_TYPES.has(item.popularityType ?? '')
        ? (item.popularityType as ItineraryItem['popularityType'])
        : undefined,
      estimatedCost: item.estimatedCost?.trim() || undefined,
      note: item.note?.trim() || undefined,
      mapsQuery: item.mapsQuery?.trim() || undefined,
      socialQuery: item.socialQuery?.trim() || item.mapsQuery?.trim() || undefined,
      isSpecificPlace: typeof item.isSpecificPlace === 'boolean' ? item.isSpecificPlace : undefined,
      confidence: VALID_CONFIDENCE_LEVELS.has(item.confidence ?? '')
        ? (item.confidence as ItineraryItem['confidence'])
        : undefined,
      source: VALID_SPOT_SOURCES.has(item.source ?? '')
        ? (item.source as ItineraryItem['source'])
        : 'openai',
    })),
  }));

  // Trust the user's own budget input for the headline display; the AI's budget object is only
  // used as planning context (so items/estimatedCost stay in a realistic range).
  const totalBudget = fallbackBudget.display;

  return {
    days,
    items: flattenItineraryDays(days),
    details: {
      plannerMessage: parsed.summary || parsed.title,
      planTitle: parsed.title,
      summary: parsed.summary,
      isFallback: false,
      totalBudget,
      duration: resolveDurationConfig(tripDuration, customDuration).label,
      tripDuration,
      tripDate,
      tripEndDate,
      customDuration,
      weather,
      highlights: [],
      rainyDayAlternatives: [],
    },
  };
}

const SYSTEM_PROMPT =
  'あなたはプロの旅行コンシェルジュです。' +
  '行程作成前に好み・天気・予算・期間・旅行スタイルを分析し、conciergeAnalysis に記載してから itinerary を設計してください。' +
  '各スポットには詳細な選定理由、現実的な概算費用、具体的な交通手段、天候変化時の代替（weatherBackup）を必ず含めてください。' +
  'プランは食事ばかりにせず、散歩・体験・景色・文化・休憩を織り交ぜた人間らしい1日の流れにすること。' +
  '実在のスポット名、丁寧な日本語、指定JSONスキーマに厳密に従って回答してください。';

const REGENERATE_SYSTEM_PROMPT =
  SYSTEM_PROMPT +
  ' 別プラン提案時は、前回提案済みのスポット名を絶対に再利用せず、条件を保ちながら全く異なるプランを作成してください。';

const DATE_SYSTEM_PROMPT =
  SYSTEM_PROMPT +
  ' カップル・初デート向けの場合は、プラン内容に合わせた会話アドバイス（aiAdvice）も日本語で作成してください。';

const MULTI_DAY_SYSTEM_PROMPT =
  SYSTEM_PROMPT +
  ' 複数日の旅行では、days配列の各日ごとに独立した itinerary を日本語で作成してください。';

const WEATHER_SYSTEM_PROMPT =
  SYSTEM_PROMPT +
  ' 天気予報が提供されている場合は、雨の日は屋内スポットを、晴れの日は屋外スポットを優先してください。';

const MEMORY_SYSTEM_PROMPT =
  SYSTEM_PROMPT +
  ' ユーザーの好み（旅行タイプ・予算・期間・アクティビティ）が記憶されている場合は、矛盾しない範囲でプランに反映してください。';

const IMA_HIMA_SYSTEM_PROMPT =
  SYSTEM_PROMPT +
  ' 即興プラン（今暇モード）では今すぐ行ける近場スポットを優先し、移動時間を最小限にしてください。';

const BEST_DAY_SYSTEM_PROMPT =
  SYSTEM_PROMPT +
  ' 最高の1日モードでは、ユーザーは計画を一切任せています。' +
  'プレミアムAIコンシェルジュとして、感情に寄り添い、theme・overallStrategy（選定理由）・plannerMessage（一言）・highlights・timeline を完璧に設計してください。' +
  '旅行メモリーがある場合は最優先で反映し、ユーザーが「自分のことを理解してくれた」と感じさせてください。' +
  'plannerMessage は1〜2文の感情的な一言、overallStrategy は2〜4文の選定理由 — 役割を混同しないこと。';

const ADJUST_SYSTEM_PROMPT =
  SYSTEM_PROMPT +
  ' 既存プラン調整モード: ベースプランの構造と良い要素を参考にしつつ、ユーザーの調整指示と編集後の条件に合わせて全体を更新してください。' +
  '行程・費用・選定理由を一貫して更新し、指定JSONスキーマに従ってください。';

export async function generateImaHimaPlan(params: {
  location: string;
  budget: string;
  currency: CurrencyCode;
  availableTime: ImaHimaTimeOption;
  mood: ImaHimaMoodOption;
  customPreferences?: import('@/types/plan-preferences').PlanCustomPreferences;
  abortSignal?: AbortSignal;
}): Promise<GeneratedPlan> {
  const moodPrefs = resolveMoodPreferences(params.mood);
  const spontaneous = buildSpontaneousContext(params.availableTime, params.mood);
  const tripDuration = getImaHimaTripDuration(params.availableTime);
  const people =
    moodPrefs.companion === 'カップル'
      ? '2'
      : moodPrefs.companion === '一人'
        ? '1'
        : '2';

  return generatePlanWithAi({
    location: params.location,
    budget: params.budget,
    currency: params.currency,
    people,
    companion: moodPrefs.companion,
    personality: moodPrefs.personality,
    tripDuration,
    tripDate: getTodayIsoDate(),
    mood: params.mood,
    customPreferences: params.customPreferences,
    spontaneous,
    abortSignal: params.abortSignal,
  });
}

export async function generateBestDayPlan(params: {
  location: string;
  budget: string;
  currency: CurrencyCode;
  people: string;
  availableTime: BestDayTimeOption;
  mood: BestDayMoodOption;
  customPreferences?: import('@/types/plan-preferences').PlanCustomPreferences;
}): Promise<GeneratedPlan> {
  const moodPrefs = resolveBestDayPreferences(params.mood, params.people);
  const bestDay = buildBestDayContext(
    params.mood,
    params.availableTime,
    moodPrefs.effectivePeople,
    moodPrefs.moodDescription,
  );
  const tripDuration = getBestDayTripDuration(params.availableTime);

  return generatePlanWithAi({
    location: params.location,
    budget: params.budget,
    currency: params.currency,
    people: moodPrefs.effectivePeople,
    companion: moodPrefs.companion,
    personality: moodPrefs.personality,
    tripDuration,
    tripDate: getTodayIsoDate(),
    mood: params.mood,
    customPreferences: params.customPreferences,
    bestDay,
  });
}

function parseAiResponse(
  raw: unknown,
  includeAiAdvice: boolean,
  tripDuration: TripDurationOption,
  tripDate: string,
  weather?: WeatherForecast,
  tripEndDate?: string,
  customDuration?: CustomTripDuration,
  travelTiming?: TravelTimingSettings,
): GeneratedPlan {
  if (__DEV__) {
    console.log('[AI] raw result type', typeof raw);
    console.log(
      '[AI] raw result preview',
      typeof raw === 'string' ? raw.slice(0, 600) : JSON.stringify(raw).slice(0, 600),
    );
  }

  const parsed = safeJsonParse<AiPlanResponse | null>(
    typeof raw === 'string' ? stripJsonCodeFence(raw) : raw,
    null,
  );

  if (!parsed?.days || parsed.days.length === 0) {
    throw new Error('プランの形式が正しくありません');
  }

  const days: ItineraryDay[] = parsed.days.map((day) => ({
    dayNumber: day.dayNumber,
    label: day.label,
    theme: day.theme,
    items: day.items.map((item) => ({
      time: item.time,
      activity: item.activity,
      activityCategory: item.activityCategory,
      placeCategory: item.placeCategory,
      reason: item.reason,
      estimatedCost: item.estimatedCost,
      transportation: item.transportation,
      reservationUrl: item.reservationUrl || undefined,
      websiteUrl: item.websiteUrl || undefined,
      travelTimeToNext: item.travelTimeToNext || undefined,
      weatherBackup: item.weatherBackup || undefined,
    })),
  }));

  return {
    days,
    items: flattenItineraryDays(days),
    details: {
      conciergeAnalysis: parsed.conciergeAnalysis,
      plannerMessage: parsed.plannerMessage,
      totalBudget:
        parsed.budgetBreakdown?.total ?? parsed.totalBudget ?? '予算目安を算出できませんでした',
      budgetBreakdown: parsed.budgetBreakdown,
      duration: parsed.duration ?? resolveDurationConfig(tripDuration, customDuration).label,
      tripDuration,
      tripDate,
      tripEndDate,
      customDuration,
      weather,
      highlights: parsed.highlights ?? [],
      rainyDayAlternatives: parsed.rainyDayAlternatives ?? [],
      weatherReplanChanges: parsed.weatherReplanChanges,
      aiAdvice: includeAiAdvice ? parsed.aiAdvice : undefined,
      tourSuggestions: parsed.tourSuggestions?.map((suggestion) => ({
        dayNumber: suggestion.dayNumber ?? undefined,
        title: suggestion.title,
        description: suggestion.description,
        needsBooking: suggestion.needsBooking,
      })),
      travelTiming,
    },
  };
}

function extractResponseText(data: unknown): string {
  const response = data as {
    output_text?: string;
    output?: Array<{
      type?: string;
      content?: Array<{ type?: string; text?: string; parsed?: unknown }>;
    }>;
  };

  if (response.output_text?.trim()) {
    return response.output_text;
  }

  for (const item of response.output ?? []) {
    if (item.type !== 'message') continue;
    for (const part of item.content ?? []) {
      if (part.parsed != null && typeof part.parsed === 'object') {
        if (__DEV__) {
          console.log('[AI] using pre-parsed structured output object');
        }
        return JSON.stringify(part.parsed);
      }
      if (part.type === 'output_text' && part.text?.trim()) {
        return part.text;
      }
    }
  }

  throw new Error('AIからの応答が空でした');
}

function extractAiPlanPayload(data: unknown): unknown {
  const response = data as {
    output?: Array<{
      type?: string;
      content?: Array<{ type?: string; text?: string; parsed?: unknown }>;
    }>;
  };

  for (const item of response.output ?? []) {
    for (const part of item.content ?? []) {
      if (part.parsed != null && typeof part.parsed === 'object') {
        return part.parsed;
      }
    }
  }

  return extractResponseText(data);
}

function logFetchPlanFromAiRawError(error: unknown): void {
  const record =
    error && typeof error === 'object'
      ? (error as Record<string, unknown>)
      : ({} as Record<string, unknown>);

  // AI/network failures here are expected (timeout, 5xx, malformed response) and are handled by
  // retry + dev fallback plan upstream — never console.error, or Expo/RN Web shows a red screen
  // even though the app recovers gracefully right after this.
  if (__DEV__) {
    console.warn('[fetchPlanFromAi] request failed (will retry or fall back)', {
      name: error instanceof Error ? error.name : record.name,
      message: error instanceof Error ? error.message : String(error),
      status: record.status,
      code: record.code,
      type: record.type,
    });
  }
}

function throwOpenAiHttpError(
  status: number,
  statusText: string,
  errorBody: string,
  requestUrl?: string,
): never {
  // Expected failure mode (e.g. transient 5xx) — retried or replaced by a dev fallback plan
  // upstream, so this must never be console.error (would trigger a red screen).
  if (__DEV__) {
    console.warn('[fetchPlanFromAi] OpenAI response error (will retry or fall back)', {
      status,
      statusText,
      body: errorBody,
      requestUrl,
    });
  }
  throw new OpenAiRequestError(status, statusText, errorBody, requestUrl);
}

async function fetchPlanFromAi(params: {
  apiKey: string;
  systemPrompt: string;
  planInput: PlanInput;
  fallbackPlanInput?: PlanInput;
  tripDuration: TripDurationOption;
  includeAiAdvice: boolean;
  schemaOverrides?: { dayCount?: number; itemsMin?: number; itemsMax?: number };
  customDuration?: CustomTripDuration;
  tripDate: string;
  tripEndDate?: string;
  weather?: WeatherForecast;
}): Promise<GeneratedPlan> {
  const durationConfig = resolveDurationConfig(params.tripDuration, params.customDuration);
  const isTravelPlan =
    params.planInput.planCreationType === '旅行プラン' ||
    params.planInput.planCreationType === '週末プラン';
  const includeTourSuggestions =
    isTravelPlan && durationConfig.dayCount >= 3 && !params.planInput.spontaneous && !params.planInput.bestDay;

  const lightweight = isLightweightMvp();
  const userPrompt = lightweight
    ? buildMvpUserPrompt(params.planInput)
    : buildConciergePrompt(params.planInput);

  if (lightweight) {
    lightweightMvpLog('generate-plan:prompt', 'using MVP prompt + minimal JSON schema for OpenAI');
    console.log('[AI] generation started', {
      destination: params.planInput.location,
      promptLength: userPrompt.length,
    });
  } else {
    console.log('[AI] generation started', {
      destination: params.planInput.location,
      durationLabel:
        params.planInput.durationLabel ??
        resolveDurationConfig(params.tripDuration, params.customDuration).label,
      companion: params.planInput.companion,
      travelPurpose: params.planInput.travelPurpose ?? params.planInput.travelIntent,
      promptLength: userPrompt.length,
    });

    logPlanGenerationStep('openai_request', {
      systemPromptPreview: params.systemPrompt.slice(0, 600),
      promptPreview: userPrompt.slice(0, 1200),
      promptLength: userPrompt.length,
    });
  }

  let lastError: unknown;
  const maxAttempts = getMaxGenerationAttempts();

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { signal, cleanup, didTimeout } = createGenerationAbortSignal(params.planInput.abortSignal);

    try {
      const plan = await executePlanFromAiRequest({
        ...params,
        userPrompt,
        includeTourSuggestions,
        attemptSignal: signal,
        fallbackPlanInput: params.fallbackPlanInput ?? params.planInput,
      });
      cleanup();
      console.log('[AI] generation success');
      return plan;
    } catch (err) {
      cleanup();
      lastError = err;

      if (params.planInput.abortSignal?.aborted || (isAbortError(err) && !didTimeout())) {
        throw err;
      }

      if (didTimeout()) {
        lastError = new AiGenerationTimeoutError();
      } else if (err instanceof DOMException && err.name === 'AbortError') {
        lastError = new AiGenerationTimeoutError();
      }

      const status = lastError instanceof OpenAiRequestError ? lastError.status : undefined;
      const message = lastError instanceof Error ? lastError.message : String(lastError);
      // Expected failure mode (timeout/502/network/parse error) — retried or replaced by a dev
      // fallback plan upstream, so this must stay console.warn (console.error triggers a red
      // screen in Expo/RN Web even though the app recovers right after this).
      if (__DEV__) {
        console.warn('[AI] generation failed (will retry or fall back)', { status, message, attempt });
      }

      if (attempt >= maxAttempts || !isRetryableOpenAiError(lastError)) {
        if (didTimeout() || lastError instanceof AiGenerationTimeoutError) {
          throw new AiGenerationTimeoutError();
        }
        throw lastError instanceof Error ? lastError : new Error(String(lastError));
      }

      console.warn('[AI] retrying generation', { attempt, errorMessage: message });
      await sleep(getOpenAiRetryDelayMs(attempt));
    }
  }

  if (lastError instanceof AiGenerationTimeoutError) {
    throw lastError;
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function executePlanFromAiRequest(params: {
  apiKey: string;
  systemPrompt: string;
  planInput: PlanInput;
  fallbackPlanInput: PlanInput;
  tripDuration: TripDurationOption;
  includeAiAdvice: boolean;
  schemaOverrides?: { dayCount?: number; itemsMin?: number; itemsMax?: number };
  customDuration?: CustomTripDuration;
  tripDate: string;
  tripEndDate?: string;
  weather?: WeatherForecast;
  userPrompt: string;
  includeTourSuggestions: boolean;
  attemptSignal: AbortSignal;
}): Promise<GeneratedPlan> {
  const lightweight = isLightweightMvp();
  const model = 'gpt-4o-mini';
  const schemaName = lightweight
    ? 'nanisuru_mvp_trip_plan'
    : params.includeAiAdvice
      ? 'nanisuru_trip_plan_with_advice'
      : 'nanisuru_trip_plan';
  const durationConfig = resolveDurationConfig(params.tripDuration, params.customDuration);
  const requestPayload = {
    model,
    input: [
      { role: 'system', content: params.systemPrompt },
      { role: 'user', content: params.userPrompt },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: schemaName,
        strict: true,
        schema: lightweight
          ? buildMvpPlanJsonSchema(
              params.schemaOverrides?.dayCount ?? durationConfig.dayCount,
              params.schemaOverrides?.itemsMin ?? durationConfig.itemsMin,
              params.schemaOverrides?.itemsMax ?? durationConfig.itemsMax,
            )
          : buildPlanJsonSchema(
              params.tripDuration,
              params.includeAiAdvice,
              params.schemaOverrides,
              params.customDuration,
              params.planInput.budgetScope,
              {
                includeTourSuggestions: params.includeTourSuggestions,
                includeWeatherReplanChanges: Boolean(params.planInput.weatherReplan),
              },
            ),
      },
    },
  };

  if (__DEV__ && !lightweight) {
    const useProxyForLog = shouldUsePlanGenerationApiProxy();
    console.log('[fetchPlanFromAi] request payload', {
      model: requestPayload.model,
      schemaName,
      useProxy: useProxyForLog,
      systemPromptLength: params.systemPrompt.length,
      userPromptLength: params.userPrompt.length,
    });
  }

  const useProxy = shouldUsePlanGenerationApiProxy();
  const apiValidation = useProxy ? validatePlanApiRequestConfig() : null;
  const requestUrl = useProxy ? apiValidation!.fetchUrl : 'https://api.openai.com/v1/responses';
  const requestUrlForLog = useProxy ? apiValidation!.logUrl : requestUrl;

  console.log('[TravelPlanSubmit] request URL', requestUrlForLog);

  if (useProxy && apiValidation && !apiValidation.ok) {
    // Expected failure mode (bad LAN IP / origin mismatch) — retried or replaced by a dev
    // fallback plan upstream. Must stay console.warn, not console.error (red screen).
    if (__DEV__) {
      console.warn('[TravelPlanSubmit] invalid API request config (will retry or fall back)', apiValidation);
    }
    throw new PlanGenerationRequestError(
      apiValidation.userMessage ?? APP_MESSAGES.planApiBadOrigin,
      'NETWORK_ERROR',
      requestUrlForLog,
    );
  }

  let response: Response;
  try {
    if (useProxy) {
      response = await fetch(requestUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: params.attemptSignal,
        body: JSON.stringify({
          requestPayload,
          ...(__DEV__ ? { devMeta: extractPlanGenerationDevMeta(params.fallbackPlanInput) } : {}),
        }),
      });
    } else {
      response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${params.apiKey}`,
        },
        signal: params.attemptSignal,
        body: JSON.stringify(requestPayload),
      });
    }
  } catch (err) {
    // Network failure (Wi-Fi drop, wrong LAN IP, offline) — expected in dev, handled by the dev
    // fallback plan upstream. Must stay console.warn, not console.error (red screen).
    if (__DEV__) {
      console.warn('[TravelPlanSubmit] fetch failed (will retry or fall back)', {
        name: err instanceof Error ? err.name : undefined,
        message: err instanceof Error ? err.message : String(err),
        requestUrl: requestUrlForLog,
        origin: getWindowOriginForLog(),
      });
    }
    logFetchPlanFromAiRawError(err);
    logPlanGenerationError('openai_fetch', err, { requestUrl: requestUrlForLog });
    if (params.planInput.abortSignal?.aborted || (isAbortError(err) && !params.attemptSignal.aborted)) {
      throw err;
    }
    if (params.attemptSignal.aborted) {
      throw new PlanGenerationRequestError(
        APP_MESSAGES.aiGenerationTimeout,
        'OPENAI_FAILED',
        requestUrlForLog,
        err,
      );
    }
    throw resolvePlanGenerationFetchFailure(err, requestUrlForLog, useProxy);
  }

  if (!lightweight) {
    console.log('[TravelPlanSubmit] response status', response.status);
  }

  if (!response.ok) {
    const text = await response.text();
    // Expected failure mode (proxy/OpenAI returned non-2xx) — retried or replaced by a dev
    // fallback plan upstream. Must stay console.warn, not console.error (red screen).
    if (__DEV__) {
      console.warn('[TravelPlanSubmit] response not ok (will retry or fall back)', {
        status: response.status,
        statusText: response.statusText,
        text: lightweight ? text.slice(0, 300) : text,
        requestUrl: requestUrlForLog,
      });
    }
    throwOpenAiHttpError(response.status, response.statusText, text, requestUrlForLog);
  }

  const data = await response.json();
  const devFallbackPlan = parseDevFallbackTravelPlanFromApiResponse(data, params.fallbackPlanInput);
  if (devFallbackPlan) {
    console.warn('[AI] using dev fallback plan from API response');
    return devFallbackPlan;
  }

  try {
    const aiPayload = extractAiPlanPayload(data);
    if (lightweight) {
      const budgetAmount = formatBudgetAmount(params.planInput.budget);
      const budgetDisplay = formatBudgetDisplay(budgetAmount, params.planInput.currency);
      const mvpPlan = parseMvpAiResponse(
        aiPayload,
        params.tripDuration,
        params.tripDate,
        params.weather,
        params.tripEndDate,
        params.customDuration,
        { display: budgetDisplay },
      );

      const sanitized = sanitizeItineraryForDestination(
        mvpPlan.days,
        params.fallbackPlanInput.location,
      );

      if (sanitized.needsFullFallback) {
        console.warn('[AI] destination mismatch detected in AI response, using safe fallback plan', {
          destination: params.fallbackPlanInput.location,
        });
        return {
          ...buildDevFallbackTravelPlan(params.fallbackPlanInput),
          devFallbackNotice: DESTINATION_SAFETY_FALLBACK_NOTICE,
        };
      }

      if (sanitized.wasModified) {
        console.warn('[AI] replaced out-of-destination items in AI response with safe alternatives', {
          destination: params.fallbackPlanInput.location,
        });
      }

      const finalDays = enforceSpecificityOnDays(
        sanitized.days,
        params.fallbackPlanInput.location,
      );

      const destinationDetails = resolveDestinationDetailsFromPlanInput(params.fallbackPlanInput);
      const scheduled = validateAndFixItinerarySchedule({
        days: finalDays,
        rawLocation: params.fallbackPlanInput.location,
        travelTiming: params.planInput.travelTiming,
        destinationDetails,
      });

      if (__DEV__ && scheduled.fixesApplied.length > 0) {
        console.warn('[Itinerary] schedule validation applied fixes', {
          fixes: scheduled.fixesApplied.slice(0, 8),
          issues: scheduled.issuesFound.slice(0, 8),
        });
      }

      const tripAudience = resolveTripAudience({
        companion: params.planInput.companion,
        planCreationType:
          params.planInput.planCreationType ?? params.planInput.planType,
      });
      const tripCopy = sanitizeItineraryTripCopy(scheduled.days, tripAudience);
      const detailsCopy = sanitizePlanDetailsTripCopy(mvpPlan.details, tripAudience);

      if (__DEV__ && (tripCopy.fixesApplied.length > 0 || detailsCopy.fixesApplied.length > 0)) {
        console.warn('[Itinerary] tripType copy validation applied fixes', {
          itemFixes: tripCopy.fixesApplied.slice(0, 6),
          detailFixes: detailsCopy.fixesApplied.slice(0, 6),
        });
      }

      return {
        ...mvpPlan,
        days: tripCopy.days,
        items: flattenItineraryDays(tripCopy.days),
        details: detailsCopy.details,
      };
    }
    return parseAiResponse(
      aiPayload,
      params.includeAiAdvice,
      params.tripDuration,
      params.tripDate,
      params.weather,
      params.tripEndDate,
      params.customDuration,
      params.planInput.travelTiming,
    );
  } catch (err) {
    logFetchPlanFromAiRawError(err);
    logPlanGenerationError('openai_parse', err, { responsePreview: JSON.stringify(data).slice(0, 800) });
    throw err instanceof Error ? err : new Error(String(err));
  }
}

function attachRealPlaces(plan: GeneratedPlan, realPlaces: NonNullable<PlanInput['realPlaces']>): GeneratedPlan {
  const days =
    realPlaces.places.length > 0
      ? enrichPlanWithRealPlaceLinks(plan.days, realPlaces.places)
      : plan.days;

  return {
    ...plan,
    days,
    items: flattenItineraryDays(days),
    details: {
      ...plan.details,
      placesNotice: realPlaces.notice ?? plan.details.placesNotice,
      placesSource: realPlaces.source ?? plan.details.placesSource,
    },
  };
}

function applyDuplicateDedupAndEnrich(
  plan: GeneratedPlan,
  realPlaces?: import('@/types/nearby-places').NearbyPlacesContext,
): GeneratedPlan {
  const deduped = dedupeItineraryPlaces(plan.days, realPlaces?.places ?? []);
  let days = deduped.days;
  if (realPlaces && realPlaces.places.length > 0) {
    days = enrichPlanWithRealPlaceLinks(days, realPlaces.places);
  }
  if (deduped.replacedCount > 0) {
    logPlanGenerationStep('duplicate_replacement', {
      replacedCount: deduped.replacedCount,
    });
  }
  return {
    ...plan,
    days,
    items: flattenItineraryDays(days),
  };
}

function mergeRegeneratedDays(
  basePlan: GeneratedPlan,
  regenerated: GeneratedPlan,
  targetDayNumbers: number[],
): GeneratedPlan {
  const targetSet = new Set(targetDayNumbers);
  const regenByDay = new Map(regenerated.days.map((day) => [day.dayNumber, day]));

  const days = basePlan.days.map((day) => {
    if (!targetSet.has(day.dayNumber)) return day;
    return regenByDay.get(day.dayNumber) ?? day;
  });

  return {
    ...basePlan,
    days,
    items: flattenItineraryDays(days),
    details: {
      ...basePlan.details,
      ...regenerated.details,
      outfitAdvice: basePlan.details.outfitAdvice ?? regenerated.details.outfitAdvice,
      weather: basePlan.details.weather ?? regenerated.details.weather,
      budgetBreakdown: regenerated.details.budgetBreakdown ?? basePlan.details.budgetBreakdown,
    },
  };
}

async function runQualityPartialRegeneration(params: {
  instruction: string;
  basePlan: { days: ItineraryDay[]; details: PlanDetails };
  enrichedInput: PlanInput;
  apiKey: string;
  systemPrompt: string;
  tripDuration: TripDurationOption;
  includeAiAdvice: boolean;
  schemaOverrides?: Parameters<typeof fetchPlanFromAi>[0]['schemaOverrides'];
  customDuration?: CustomTripDuration;
  tripDate: string;
  tripEndDate?: string;
  weather?: WeatherForecast;
  realPlaces?: import('@/types/nearby-places').NearbyPlacesContext;
  targetDayNumbers?: number[];
  abortSignal?: AbortSignal;
}): Promise<{ days: ItineraryDay[]; details: PlanDetails }> {
  if (params.abortSignal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  const partialInput: PlanInput = {
    ...params.enrichedInput,
    itineraryQualityFix: {
      baseDays: params.basePlan.days,
      baseDetails: params.basePlan.details,
      issues: [params.instruction],
      targetDayNumbers: params.targetDayNumbers,
    },
  };

  let regen = await fetchPlanFromAi({
    apiKey: params.apiKey,
    systemPrompt: `${params.systemPrompt}\n${params.instruction}`,
    planInput: partialInput,
    tripDuration: params.tripDuration,
    includeAiAdvice: params.includeAiAdvice,
    schemaOverrides: params.schemaOverrides,
    customDuration: params.customDuration,
    tripDate: params.tripDate,
    tripEndDate: params.tripEndDate,
    weather: params.weather,
  });

  if (params.realPlaces) {
    regen = attachRealPlaces(regen, params.realPlaces);
    regen = applyDuplicateDedupAndEnrich(regen, params.realPlaces);
  }

  if (params.targetDayNumbers?.length) {
    regen = mergeRegeneratedDays(
      { ...params.basePlan, items: flattenItineraryDays(params.basePlan.days) },
      regen,
      params.targetDayNumbers,
    );
    if (params.realPlaces) {
      regen = applyDuplicateDedupAndEnrich(regen, params.realPlaces);
    }
  }

  return { days: regen.days, details: regen.details };
}

export async function generatePlanWithAi(input: PlanInput): Promise<GeneratedPlan> {
  const normalized = normalizePlanGenerationInput(input);
  validatePlanGenerationInput(normalized);

  logPlanGenerationStep('input', buildPlanGenerationLogPayload(normalized));

  const useProxy = shouldUsePlanGenerationApiProxy();
  if (!useProxy && !getOpenAiApiKey()) {
    console.error('[fetchPlanFromAi] missing API key', {
      hasEnvVar: Boolean(process.env.EXPO_PUBLIC_OPENAI_API_KEY),
    });
    throw new AppError(APP_MESSAGES.openAiNotConfigured, 'OPENAI_FAILED');
  }
  const apiKey: string = useProxy ? 'proxy' : getOpenAiApiKey()!;

  if (__DEV__) {
    console.log('[AI] hasOpenAIKey', useProxy || Boolean(getOpenAiApiKey()));
    console.log('[AI] model', 'gpt-4o-mini');
    console.log('[AI] usePlanApiProxy', useProxy);
    if (useProxy) {
      console.log('[AI] planApiUrl', getGeneratePlanApiUrlForLog());
    }
  }

  const locationTrimmed = normalized.location;
  if (!locationTrimmed) {
    throw new AppError(APP_MESSAGES.locationRequired, 'NO_PLACES_FOUND');
  }

  const lightweight = isLightweightMvp();
  if (lightweight) {
    lightweightMvpLog(
      'generate-plan',
      'skipping weather / real-places / Discover / memories / local gems fetches for plan generation',
    );
  }

  let weather: WeatherForecast;
  if (lightweight) {
    weather = createUnavailableWeatherForecast(locationTrimmed, resolveWeatherLocation(locationTrimmed));
  } else {
    try {
      const weatherLocation = resolveWeatherLocation(locationTrimmed);
      weather = await resolveWeatherForTrip({
        location: locationTrimmed,
        startDate: input.tripDate,
        tripDuration: input.tripDuration,
        endDate: input.tripEndDate,
        customDuration: input.customDuration,
      });

      if (!weather.available && weather.planningMode !== 'seasonal') {
        console.warn('[Weather] using fallback weather context', {
          destination: locationTrimmed,
          weatherLocation,
          location: weather.location,
          planningMode: weather.planningMode,
        });
      } else if (weather.planningMode === 'seasonal') {
        if (__DEV__) {
          console.log('[Weather] using seasonal weather context', {
            destination: locationTrimmed,
            planningMode: weather.planningMode,
          });
        }
      }
    } catch (error) {
      console.warn('[Weather] fetch failed, continuing without weather', error);
      const weatherLocation = resolveWeatherLocation(locationTrimmed);
      weather = createUnavailableWeatherForecast(locationTrimmed, weatherLocation);
    }
  }

  let realPlaces;
  if (lightweight) {
    realPlaces = buildEmptyPlacesContext(locationTrimmed, '');
  } else {
    try {
      realPlaces = await fetchRealPlacesForLocation(locationTrimmed);
      logPlanGenerationStep('places', {
        count: realPlaces.places.length,
        source: realPlaces.source,
        notice: realPlaces.notice,
        sample: realPlaces.places.slice(0, 3).map((place) => place.name),
      });
    } catch (err) {
      console.warn('[Places] fetch failed, continuing with fallback places context', err);
      if (err instanceof AppError && err.code === 'NO_PLACES_FOUND') {
        throw err;
      }
      realPlaces = buildEmptyPlacesContext(locationTrimmed, APP_MESSAGES.placesFetchWarning);
    }
  }

  const [userPreferences, travelMemories, travelUserPreferences] = lightweight
    ? [EMPTY_USER_PREFERENCES, [], EMPTY_TRAVEL_USER_PREFERENCES]
    : await Promise.all([getUserPreferences(), getTravelMemories(), getTravelUserPreferences()]);

  if (hasTravelUserPreferences(travelUserPreferences)) {
    if (__DEV__ && travelUserPreferences) {
      console.log('[PlanGeneration] preferences used');
    }
  }

  const customText = [
    input.customPreferences?.desiredPlaces,
    input.customPreferences?.customTravelIntent,
    input.customPreferences?.customMood,
    input.mustVisitPlaces,
  ]
    .filter(Boolean)
    .join(' ');

  const prioritizeLocalSpots =
    !lightweight &&
    (shouldPrioritizeLocalHiddenSpots({
      personality: input.personality,
      mood: input.mood,
      travelIntent: input.travelIntent,
      customText,
    }) ||
      (hasTravelUserPreferences(travelUserPreferences) &&
        travelUserPreferences.favoriteCategories.includes('ローカル穴場')));

  let localHiddenSpots: Awaited<ReturnType<typeof loadRelevantLocalGemsForPlan>> = [];
  if (prioritizeLocalSpots) {
    try {
      localHiddenSpots = await loadRelevantLocalGemsForPlan({
        location: locationTrimmed,
        limit: 3,
      });
    } catch (error) {
      console.warn('[LocalGems] optional local gems unavailable, continuing', error);
      console.log('[TravelPlanSubmit] local gems count', 0);
      localHiddenSpots = [];
    }
  }

  if (__DEV__) {
    console.log('[TravelPlanSubmit] continuing generation');
  }

  // The user's own currency selection is always authoritative — never silently swapped for a
  // destination-guessed currency (e.g. picking JPY for a Korea trip must stay JPY, not become KRW).
  const resolvedCurrency = input.currency;

  const includeAiAdvice = isDateRelatedCompanion(input.companion);
  const isRegenerate = Boolean(input.avoidActivities && input.avoidActivities.length > 0);
  const isAdjustment = Boolean(input.planAdjustment);
  const useCompactPrompt =
    lightweight ||
    (!input.planAdjustment &&
      !input.weatherReplan &&
      !input.itineraryBalanceFix &&
      !input.itineraryQualityFix &&
      !input.spontaneous &&
      !input.bestDay &&
      !isRegenerate);

  const compactLocalGems = localHiddenSpots.slice(0, 3);
  const promptPlanInput = useCompactPrompt
    ? buildCompactPromptPlanInput({
        ...input,
        currency: resolvedCurrency,
        weather,
        userPreferences: userPreferences.hasData ? userPreferences : undefined,
        localHiddenSpots: compactLocalGems.length > 0 ? compactLocalGems : undefined,
        prioritizeLocalGems: prioritizeLocalSpots && localHiddenSpots.length === 0,
        planType: normalized.planType,
        travelPurpose: normalized.travelPurpose,
        departureDate: normalized.departureDate,
        returnDate: normalized.returnDate,
        durationLabel: normalized.durationLabel,
        mustVisitPlaces: normalized.mustVisitPlaces,
        avoidPreferences: normalized.avoidPreferences,
        budgetScope: input.budgetScope,
      })
    : null;

  const enrichedInput: PlanInput = {
    ...input,
    currency: resolvedCurrency,
    weather,
    realPlaces,
    userPreferences: userPreferences.hasData ? userPreferences : undefined,
    travelUserPreferences: hasTravelUserPreferences(travelUserPreferences)
      ? travelUserPreferences
      : undefined,
    travelMemories: useCompactPrompt ? undefined : travelMemories.length > 0 ? travelMemories : undefined,
    localHiddenSpots: compactLocalGems.length > 0 ? compactLocalGems : undefined,
    prioritizeLocalGems: prioritizeLocalSpots && localHiddenSpots.length === 0,
    compactPrompt: useCompactPrompt,
    planType: normalized.planType,
    travelPurpose: normalized.travelPurpose,
    departureDate: normalized.departureDate,
    returnDate: normalized.returnDate,
    durationLabel: normalized.durationLabel,
    mustVisitPlaces: normalized.mustVisitPlaces,
    avoidPreferences: normalized.avoidPreferences,
    budgetScope: input.budgetScope,
  };
  const durationConfig = resolveDurationConfig(input.tripDuration, input.customDuration);
  const isMultiDay = durationConfig.dayCount > 1 && !input.spontaneous && !input.bestDay;
  const isImaHima = Boolean(input.spontaneous);
  const isBestDay = Boolean(input.bestDay);

  const schemaOverrides = input.bestDay
    ? {
        dayCount: 1,
        itemsMin: input.bestDay.itemsMin,
        itemsMax: input.bestDay.itemsMax,
      }
    : input.spontaneous
      ? {
          dayCount: 1,
          itemsMin: input.spontaneous.itemsMin,
          itemsMax: input.spontaneous.itemsMax,
        }
      : undefined;

  let systemPrompt = lightweight
    ? MVP_SYSTEM_PROMPT
    : useCompactPrompt
      ? buildCompactSystemPrompt(input.tripDuration, durationConfig.dayCount)
      : SYSTEM_PROMPT;
  if (!useCompactPrompt) {
    if (isAdjustment) {
      systemPrompt = ADJUST_SYSTEM_PROMPT;
    } else if (isBestDay) {
      systemPrompt = BEST_DAY_SYSTEM_PROMPT;
    } else if (isImaHima) {
      systemPrompt = IMA_HIMA_SYSTEM_PROMPT;
    } else if (userPreferences.hasData && weather) {
      systemPrompt = `${MEMORY_SYSTEM_PROMPT} 天気予報にも合わせて屋内・屋外を調整してください。`;
    } else if (userPreferences.hasData) {
      systemPrompt = MEMORY_SYSTEM_PROMPT;
    } else if (travelMemories.length > 0 && weather) {
      systemPrompt = `${MEMORY_SYSTEM_PROMPT} ユーザーの旅行メモリーを最優先で反映し、天気予報にも合わせて調整してください。`;
    } else if (travelMemories.length > 0) {
      systemPrompt = `${MEMORY_SYSTEM_PROMPT} ユーザーの旅行メモリーを最優先で反映してください。`;
    } else if (weather) {
      systemPrompt = WEATHER_SYSTEM_PROMPT;
    }
    if (isRegenerate) {
      systemPrompt = includeAiAdvice
        ? `${REGENERATE_SYSTEM_PROMPT} カップル・初デート向けは aiAdvice も作成。天気予報がある場合は天候に合わせたスポット選定を維持。`
        : `${REGENERATE_SYSTEM_PROMPT}${weather ? ' 天気予報がある場合は天候に合わせたスポット選定を維持。' : ''}`;
    } else if (!isAdjustment && !isImaHima && !isBestDay && includeAiAdvice) {
      systemPrompt = weather
        ? `${DATE_SYSTEM_PROMPT} 天気予報に合わせて屋内・屋外スポットを調整してください。`
        : DATE_SYSTEM_PROMPT;
    } else if (!isAdjustment && !isImaHima && !isBestDay && isMultiDay) {
      systemPrompt = weather
        ? `${MULTI_DAY_SYSTEM_PROMPT} 日ごとの天気予報に合わせてスポットを調整してください。`
        : MULTI_DAY_SYSTEM_PROMPT;
    }

    if (isAdjustment && weather) {
      systemPrompt = `${systemPrompt} 天気予報に合わせて屋内・屋外スポットを調整してください。`;
    }
    if (isAdjustment && travelMemories.length > 0) {
      systemPrompt = `${systemPrompt} ユーザーの旅行メモリーを反映してください。`;
    }

    if ((isImaHima || isBestDay) && weather) {
      systemPrompt = `${systemPrompt} 天気予報に合わせて屋内・屋外スポットを調整してください。`;
    }

    systemPrompt = `${systemPrompt} コンシェルジュモード: conciergeAnalysis を完成させてから days を設計。全 item に reservationUrl, websiteUrl, travelTimeToNext, weatherBackup を設定してください。`;

    if (realPlaces && realPlaces.places.length > 0) {
      systemPrompt = `${systemPrompt} 実在スポットリストが提供されています。リスト以外の店名・施設名を一切使用しないこと。activity にはリストの名称をそのまま使用し、架空のスポットは禁止。飲食店だけに偏らず、リスト内の公園・文化・観光スポットも積極的に使うこと。同じスポットを旅全体で2回以上使わないこと。`;
    }
  }

  logPlanGenerationStep('prepared', buildPlanGenerationLogPayload(normalized, {
    realPlaces,
    systemPrompt,
  }));

  let plan: GeneratedPlan;
  const aiPlanInput = promptPlanInput ?? enrichedInput;
  try {
    plan = await fetchPlanFromAi({
      apiKey,
      systemPrompt,
      planInput: aiPlanInput,
      fallbackPlanInput: enrichedInput,
      tripDuration: input.tripDuration,
      includeAiAdvice,
      schemaOverrides,
      customDuration: input.customDuration,
      tripDate: input.tripDate,
      tripEndDate: input.tripEndDate,
      weather,
    });
  } catch (err) {
    if (__DEV__ && isDevFallbackEligibleError(err)) {
      console.warn('[AI] using dev fallback plan after retries exhausted', err);
      plan = buildDevFallbackTravelPlan(enrichedInput);
    } else {
      throw err;
    }
  }

  if (realPlaces) {
    plan = attachRealPlaces(plan, realPlaces);
    plan = applyDuplicateDedupAndEnrich(plan, realPlaces);
  }

  const gourmetTour = isGourmetTourIntent({
    personality: input.personality,
    mood: input.mood,
    travelIntent: normalized.travelPurpose,
    customPreferences: input.customPreferences,
  });

  const shouldBalanceCheck =
    !lightweight &&
    !input.planAdjustment &&
    !input.weatherReplan &&
    !input.itineraryBalanceFix &&
    !input.itineraryQualityFix &&
    !gourmetTour &&
    !input.spontaneous &&
    !input.bestDay;

  if (!plan.devFallbackNotice && shouldBalanceCheck && analyzeItineraryBalance(plan.days).isTooFoodHeavy) {
    if (input.abortSignal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const rebalanceInput: PlanInput = {
      ...enrichedInput,
      itineraryBalanceFix: {
        baseDays: plan.days,
        baseDetails: plan.details,
      },
    };

    try {
      let rebalancedPlan = await fetchPlanFromAi({
        apiKey,
        systemPrompt: `${systemPrompt} 前回のプランは食事偏重だったため、散歩・体験・文化・景色・休憩を増やした人間らしいプランに作り直すこと。`,
        planInput: rebalanceInput,
        tripDuration: input.tripDuration,
        includeAiAdvice,
        schemaOverrides,
        customDuration: input.customDuration,
        tripDate: input.tripDate,
        tripEndDate: input.tripEndDate,
        weather,
      });

      if (realPlaces) {
        rebalancedPlan = attachRealPlaces(rebalancedPlan, realPlaces);
        rebalancedPlan = applyDuplicateDedupAndEnrich(rebalancedPlan, realPlaces);
      }
      plan = rebalancedPlan;
    } catch (err) {
      // This is a nice-to-have quality improvement on top of an already-usable plan — an
      // expected AI failure here must fall back to keeping the original plan, not crash the
      // whole generation flow.
      if (__DEV__ && isDevFallbackEligibleError(err)) {
        console.warn('[AI] balance-fix regeneration failed, keeping original plan', err);
      } else {
        throw err;
      }
    }
  }

  if (!input.spontaneous && !input.bestDay) {
    plan = applyDuplicateDedupAndEnrich(plan, realPlaces);

    let qualityReport = validateItineraryQuality(plan.days, {
      travelTiming: input.travelTiming,
      dayCount: durationConfig.dayCount,
      gourmetTour,
    });
    logItineraryQualityReport(qualityReport);

    const canQualityFix =
      !lightweight &&
      !plan.devFallbackNotice &&
      !input.planAdjustment &&
      !input.weatherReplan &&
      !input.itineraryQualityFix &&
      !input.itineraryBalanceFix &&
      shouldAttemptQualityFix(qualityReport, { gourmetTour });

    if (canQualityFix) {
      if (input.abortSignal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      const qualityFixInput: PlanInput = {
        ...enrichedInput,
        itineraryQualityFix: {
          baseDays: plan.days,
          baseDetails: plan.details,
          issues: qualityReport.issues,
        },
      };

      try {
        let fixedPlan = await fetchPlanFromAi({
          apiKey,
          systemPrompt: `${systemPrompt} 前回のプラン品質に問題があったため、重複排除・エリア多様性・到着出発時間・体験バランスを改善したプランに作り直すこと。`,
          planInput: qualityFixInput,
          tripDuration: input.tripDuration,
          includeAiAdvice,
          schemaOverrides,
          customDuration: input.customDuration,
          tripDate: input.tripDate,
          tripEndDate: input.tripEndDate,
          weather,
        });

        if (realPlaces) {
          fixedPlan = attachRealPlaces(fixedPlan, realPlaces);
          fixedPlan = applyDuplicateDedupAndEnrich(fixedPlan, realPlaces);
        }
        plan = fixedPlan;

        qualityReport = validateItineraryQuality(plan.days, {
          travelTiming: input.travelTiming,
          dayCount: durationConfig.dayCount,
          gourmetTour,
        });
        logItineraryQualityReport(qualityReport);
      } catch (err) {
        // Same reasoning as the balance-fix retry above — keep the original plan instead of
        // crashing when this nice-to-have quality regeneration hits an expected AI failure.
        if (__DEV__ && isDevFallbackEligibleError(err)) {
          console.warn('[AI] quality-fix regeneration failed, keeping original plan', err);
        } else {
          throw err;
        }
      }
    }
  }

  void learnFromCustomPreferences(input.customPreferences);

  const isTravelPlan =
    input.planCreationType === '旅行プラン' || input.planCreationType === '週末プラン';

  const outfitAdvice = generateOutfitPackingAdvice({
    days: plan.days,
    weather: plan.details.weather ?? weather,
    location: locationTrimmed,
    planType: input.planCreationType,
    companion: input.companion,
    outfitStyleMode: input.outfitStyleMode,
    dayCount: durationConfig.dayCount,
    tripDate: input.tripDate,
  });
  logOutfitAdviceGenerated(outfitAdvice);

  plan = {
    ...plan,
    details: {
      ...plan.details,
      budgetScope: input.budgetScope,
      preTripPlanning: isTravelPlan
        ? {
            ...plan.details.preTripPlanning,
            bookingLinks: buildDefaultPreTripBookingLinks({
              destination: locationTrimmed,
              departureDate: input.tripDate,
              returnDate: input.tripEndDate,
            }),
          }
        : plan.details.preTripPlanning,
      travelTiming: input.travelTiming,
      outfitAdvice,
    },
  };

  const transportContext = {
    location: locationTrimmed,
    weather: plan.details.weather ?? weather,
    travelTiming: input.travelTiming,
    companion: input.companion,
    budget: input.budget,
  };

  const canRunFinalValidation = !input.spontaneous && !input.bestDay;
  // Lightweight/MVP mode intentionally avoids extra AI round-trips for reliability — the AI
  // partial-fix path below is a nice-to-have quality polish on top of an already-usable plan.
  const allowAiPartialFix =
    canRunFinalValidation && !lightweight && !input.itineraryQualityFix && !input.itineraryBalanceFix;

  let finalizedPlan: { days: ItineraryDay[]; details: PlanDetails } = plan;
  try {
    const finalizeResult = await finalizeItineraryBeforeDisplay({
      plan,
      realPlaces,
      travelTiming: input.travelTiming,
      dayCount: durationConfig.dayCount,
      gourmetTour,
      budgetScope: input.budgetScope,
      location: locationTrimmed,
      companion: input.companion,
      outfitStyleMode: input.outfitStyleMode,
      planCreationType: input.planCreationType,
      tripDate: input.tripDate,
      weather: plan.details.weather ?? weather,
      transportContext,
      allowAiPartialFix,
      onPartialRegenerate: allowAiPartialFix
        ? async (instruction, basePlan) =>
            runQualityPartialRegeneration({
              instruction,
              basePlan,
              enrichedInput,
              apiKey,
              systemPrompt,
              tripDuration: input.tripDuration,
              includeAiAdvice,
              schemaOverrides,
              customDuration: input.customDuration,
              tripDate: input.tripDate,
              tripEndDate: input.tripEndDate,
              weather,
              realPlaces,
              abortSignal: input.abortSignal,
            })
        : undefined,
      onRegenerateDays: allowAiPartialFix
        ? async (dayNumbers, instruction, basePlan) =>
            runQualityPartialRegeneration({
              instruction,
              basePlan,
              enrichedInput,
              apiKey,
              systemPrompt,
              tripDuration: input.tripDuration,
              includeAiAdvice,
              schemaOverrides,
              customDuration: input.customDuration,
              tripDate: input.tripDate,
              tripEndDate: input.tripEndDate,
              weather,
              realPlaces,
              targetDayNumbers: dayNumbers,
              abortSignal: input.abortSignal,
            })
        : undefined,
    });
    finalizedPlan = finalizeResult.plan;
  } catch (err) {
    // The AI partial-fix inside finalization is a quality polish step — an expected AI failure
    // here must fall back to the plan as generated, not crash the whole generation flow.
    if (__DEV__ && isDevFallbackEligibleError(err)) {
      console.warn('[AI] final quality-fix regeneration failed, using plan without it', err);
    } else {
      throw err;
    }
  }

  return {
    ...finalizedPlan,
    items: flattenItineraryDays(finalizedPlan.days),
    details: {
      ...finalizedPlan.details,
      ...buildPlanDetailDestinationFields(input),
    },
  };
}

/** Alias for generatePlanWithAi — accepts normalized plan creation fields. */
export const generatePlan = generatePlanWithAi;
