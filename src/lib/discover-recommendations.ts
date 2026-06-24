import { APP_MESSAGES, AppError, isNetworkError } from '@/lib/app-errors';
import { matchesRankingTab } from '@/lib/discover-ranking';
import { getOpenAiApiKey, isOpenAiConfigured } from '@/lib/env';
import type { CurrentCoordinatesResult } from '@/lib/current-location';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { summarizeTravelMemoriesForAnalysis, getTravelMemories } from '@/lib/travel-memory';
import { getAverageBudgetAmount, getUserPreferences } from '@/lib/user-memory';
import {
  fetchWeatherForecast,
  getTodayIsoDate,
  type WeatherForecast,
} from '@/lib/weather';
import type { DiscoverFilterState } from '@/types/discover-filters';
import type { RankedPublicPlan } from '@/types/discover-ranking';
import {
  RECOMMENDATION_CATEGORY_LABELS,
  type AiPlanSearchResult,
  type BuildRecommendationsInput,
  type DiscoverRecommendationsResult,
  type RecommendationCategoryGroup,
  type RecommendationCategoryId,
  type RecommendationContext,
  type RecommendedPlanItem,
} from '@/types/discover-recommendations';
import { parseBudgetAmount, isDiscoverablePublicPlan, type PublicPlan } from '@/types/public-plan';

const MAX_ITEMS_PER_CATEGORY = 3;
const MAX_AI_PLANS = 40;
const MAX_AI_REASONS = 12;

function getTimeOfDay(): RecommendationContext['timeOfDay'] {
  const hour = new Date().getHours();
  if (hour < 11) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'night';
}

function getTimeOfDayLabel(timeOfDay: RecommendationContext['timeOfDay']): string {
  switch (timeOfDay) {
    case 'morning':
      return '朝';
    case 'afternoon':
      return '昼';
    case 'evening':
      return '夕方';
    case 'night':
      return '夜';
  }
}

function normalizeText(value: string): string {
  return value.toLowerCase().trim();
}

function includesAny(text: string, keywords: string[]): boolean {
  const normalized = normalizeText(text);
  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

function buildPlanHaystack(plan: PublicPlan): string {
  return [
    plan.title,
    plan.description,
    plan.category,
    plan.payload.location,
    plan.payload.companion,
    plan.payload.personality,
    plan.payload.mood,
    plan.tags.join(' '),
  ]
    .join(' ')
    .toLowerCase();
}

function locationMatchesPlan(plan: PublicPlan, location: CurrentCoordinatesResult | null): boolean {
  if (!location) return false;
  const haystack = buildPlanHaystack(plan);
  const candidates = [location.city, location.label].filter(Boolean);
  return candidates.some((candidate) => haystack.includes(normalizeText(candidate)));
}

function areaMatchesPlan(plan: PublicPlan, areaQuery: string): boolean {
  const trimmed = areaQuery.trim();
  if (!trimmed) return false;
  return buildPlanHaystack(plan).includes(normalizeText(trimmed));
}

function isEligiblePlan(plan: PublicPlan, currentUserId: string | null): boolean {
  if (!isDiscoverablePublicPlan(plan)) return false;
  if (currentUserId && plan.userId === currentUserId) return false;
  return true;
}

async function fetchLikedPlanIds(userId: string): Promise<Set<string>> {
  if (!isSupabaseConfigured()) return new Set();

  const supabase = getSupabase();
  const { data } = await supabase
    .from('public_plan_likes')
    .select('public_plan_id')
    .eq('user_id', userId);

  return new Set((data ?? []).map((row) => row.public_plan_id as string));
}

async function fetchSavedPlanIds(userId: string): Promise<Set<string>> {
  if (!isSupabaseConfigured()) return new Set();

  const supabase = getSupabase();
  const { data } = await supabase
    .from('public_plan_saves')
    .select('public_plan_id')
    .eq('user_id', userId);

  return new Set((data ?? []).map((row) => row.public_plan_id as string));
}

async function fetchFollowingUserIds(userId: string): Promise<Set<string>> {
  if (!isSupabaseConfigured()) return new Set();

  const supabase = getSupabase();
  const { data } = await supabase
    .from('user_follows')
    .select('following_id')
    .eq('follower_id', userId);

  return new Set((data ?? []).map((row) => row.following_id as string));
}

async function fetchWeatherForLocation(
  location: CurrentCoordinatesResult | null,
  areaQuery: string,
): Promise<WeatherForecast | null> {
  const query = location?.city || location?.label || areaQuery.trim();
  if (!query) return null;

  try {
    return await fetchWeatherForecast({
      location: query,
      startDate: getTodayIsoDate(),
      tripDuration: '半日',
    });
  } catch {
    return null;
  }
}

export async function buildRecommendationContext(
  currentUserId: string | null,
  filters: DiscoverFilterState,
  location: CurrentCoordinatesResult | null,
): Promise<RecommendationContext> {
  const [preferences, travelMemories, averageBudget, likedPlanIds, savedPlanIds, followingUserIds, weather] =
    await Promise.all([
      getUserPreferences(),
      getTravelMemories(),
      getAverageBudgetAmount(),
      currentUserId ? fetchLikedPlanIds(currentUserId) : Promise.resolve(new Set<string>()),
      currentUserId ? fetchSavedPlanIds(currentUserId) : Promise.resolve(new Set<string>()),
      currentUserId ? fetchFollowingUserIds(currentUserId) : Promise.resolve(new Set<string>()),
      fetchWeatherForLocation(location, filters.areaQuery),
    ]);

  return {
    currentUserId,
    preferences,
    travelMemories,
    likedPlanIds,
    savedPlanIds,
    followingUserIds,
    filters,
    location,
    weather,
    timeOfDay: getTimeOfDay(),
    averageBudget: averageBudget
      ? { amount: averageBudget.amount, currency: averageBudget.currency }
      : null,
  };
}

function scorePopularity(plan: PublicPlan): number {
  return plan.likeCount * 1 + plan.saveCount * 2 + (plan.copyCount ?? 0) * 3;
}

function scorePreferenceMatch(plan: PublicPlan, context: RecommendationContext): number {
  let score = 0;
  const haystack = buildPlanHaystack(plan);

  if (context.preferences.favoriteTravelStyle) {
    if (
      plan.payload.personality === context.preferences.favoriteTravelStyle ||
      haystack.includes(normalizeText(context.preferences.favoriteTravelStyle))
    ) {
      score += 4;
    }
  }

  for (const activity of context.preferences.favoriteActivities) {
    if (haystack.includes(normalizeText(activity))) {
      score += 2;
    }
  }

  for (const memory of context.travelMemories) {
    const content = memory.content.toLowerCase();
    if (content && haystack.includes(content.slice(0, Math.min(content.length, 12)))) {
      score += 3;
    }
  }

  if (context.likedPlanIds.has(plan.id)) score -= 6;
  if (context.savedPlanIds.has(plan.id)) score -= 4;

  if (locationMatchesPlan(plan, context.location)) score += 5;
  if (areaMatchesPlan(plan, context.filters.areaQuery)) score += 4;

  if (context.followingUserIds.has(plan.userId)) score += 6;

  return score;
}

function scoreCategory(
  plan: PublicPlan,
  categoryId: RecommendationCategoryId,
  context: RecommendationContext,
  trendingRankMap: Map<string, number>,
): number {
  const popularity = scorePopularity(plan);
  const preference = scorePreferenceMatch(plan, context);

  switch (categoryId) {
    case 'today_for_you': {
      let score = preference + popularity * 0.4;
      if (context.timeOfDay === 'night' && matchesRankingTab(plan, 'night')) score += 3;
      if (context.timeOfDay !== 'night' && plan.payload.tripDuration === '半日') score += 2;
      if (context.weather?.hasRainExpected && matchesRankingTab(plan, 'rainy')) score += 4;
      if (context.weather?.isMostlySunny && !matchesRankingTab(plan, 'rainy')) score += 2;
      return score;
    }
    case 'tonight':
      if (!matchesRankingTab(plan, 'night') && plan.payload.tripDuration !== '半日') return -1;
      return preference + popularity * 0.3 + (matchesRankingTab(plan, 'night') ? 5 : 2);
    case 'date':
      if (!matchesRankingTab(plan, 'date')) return -1;
      return preference + popularity * 0.35 + 4;
    case 'rainy':
      if (!matchesRankingTab(plan, 'rainy') && !context.weather?.hasRainExpected) return -1;
      return preference + popularity * 0.3 + (matchesRankingTab(plan, 'rainy') ? 5 : 1);
    case 'budget_popular': {
      const budget = parseBudgetAmount(plan);
      const limit = context.averageBudget?.amount ?? 10000;
      if (budget > limit) return -1;
      return preference + popularity * 0.5 + (budget <= limit * 0.8 ? 2 : 0);
    }
    case 'following':
      if (!context.followingUserIds.has(plan.userId)) return -1;
      return preference + popularity * 0.45 + 5;
    case 'trending': {
      const rank = trendingRankMap.get(plan.id);
      if (!rank) return -1;
      return 100 - rank * 8 + preference * 0.2;
    }
    default:
      return -1;
  }
}

function buildHeuristicReason(
  plan: PublicPlan,
  categoryId: RecommendationCategoryId,
  context: RecommendationContext,
): string {
  const haystack = buildPlanHaystack(plan);

  switch (categoryId) {
    case 'today_for_you': {
      const parts: string[] = [];
      if (context.travelMemories.length > 0) {
        parts.push('旅行メモリーの好み');
      } else if (context.preferences.favoriteActivities.length > 0) {
        parts.push(`「${context.preferences.favoriteActivities[0]}」が好き`);
      } else if (context.preferences.favoriteTravelStyle) {
        parts.push(`${context.preferences.favoriteTravelStyle}な雰囲気`);
      }
      if (locationMatchesPlan(plan, context.location)) {
        parts.push('現在地近く');
      }
      if (context.weather?.hasRainExpected && matchesRankingTab(plan, 'rainy')) {
        parts.push('今日の雨予報');
      }
      if (parts.length > 0) {
        return `${parts.join('・')}に合うため、このプランがおすすめです。`;
      }
      return `${getTimeOfDayLabel(context.timeOfDay)}の過ごし方に合う人気プランです。`;
    }
    case 'tonight':
      return '今夜すぐ出かけられる半日・夜向けのプランです。';
    case 'date': {
      if (includesAny(haystack, ['カフェ', 'cafe'])) {
        return 'カフェやゆっくりしたデートを楽しめるプランです。';
      }
      return 'カップル向けのデートプランとして人気です。';
    }
    case 'rainy':
      return context.weather?.hasRainExpected
        ? '今日は雨の予報。屋内中心で楽しめるプランです。'
        : '雨の日でも安心して楽しめる屋内スポットが中心です。';
    case 'budget_popular': {
      const limit = context.averageBudget?.amount ?? 10000;
      return `予算${limit.toLocaleString()}円以内で、保存数・いいねが多い人気プランです。`;
    }
    case 'following':
      return `フォロー中の${plan.creatorDisplayName}さんのおすすめプランです。`;
    case 'trending':
      return '今週のいいね・保存・コピーが伸びている人気プランです。';
    default:
      return 'あなたの好みに合いそうなプランです。';
  }
}

function pickCategoryItems(
  plans: PublicPlan[],
  categoryId: RecommendationCategoryId,
  context: RecommendationContext,
  trendingRankMap: Map<string, number>,
  usedPlanIds: Set<string>,
): RecommendedPlanItem[] {
  const scored = plans
    .filter((plan) => isEligiblePlan(plan, context.currentUserId))
    .filter((plan) => !usedPlanIds.has(plan.id))
    .map((plan) => ({
      plan,
      score: scoreCategory(plan, categoryId, context, trendingRankMap),
    }))
    .filter((item) => item.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_ITEMS_PER_CATEGORY);

  return scored.map((item) => {
    usedPlanIds.add(item.plan.id);
    return {
      plan: item.plan,
      categoryId,
      reason: buildHeuristicReason(item.plan, categoryId, context),
    };
  });
}

function buildTrendingRankMap(trendingPlans: RankedPublicPlan[]): Map<string, number> {
  return new Map(trendingPlans.map((item) => [item.plan.id, item.rank]));
}

function hasPersonalizationData(context: RecommendationContext): boolean {
  return (
    context.travelMemories.length > 0 ||
    context.preferences.hasData ||
    context.likedPlanIds.size > 0 ||
    context.savedPlanIds.size > 0 ||
    context.followingUserIds.size > 0 ||
    Boolean(context.location) ||
    Boolean(context.filters.areaQuery.trim())
  );
}

function summarizePlanForAi(plan: PublicPlan): string {
  return [
    `id:${plan.id}`,
    `title:${plan.title}`,
    `category:${plan.category}`,
    `location:${plan.payload.location}`,
    `companion:${plan.payload.companion}`,
    `personality:${plan.payload.personality}`,
    `mood:${plan.payload.mood ?? ''}`,
    `budget:${plan.payload.budget}`,
    `tags:${plan.tags.join('/')}`,
    `likes:${plan.likeCount}`,
    `saves:${plan.saveCount}`,
  ].join(' | ');
}

function buildContextBrief(context: RecommendationContext): string {
  const lines = [
    `時刻帯: ${getTimeOfDayLabel(context.timeOfDay)}`,
    context.location
      ? `現在地: ${context.location.label || context.location.city}`
      : '現在地: 未取得',
    context.filters.areaQuery.trim()
      ? `選択エリア: ${context.filters.areaQuery.trim()}`
      : null,
    context.weather ? `天気: ${context.weather.summary}` : null,
    context.preferences.hasData
      ? `自動学習の好み: スタイル=${context.preferences.favoriteTravelStyle ?? 'なし'} / 予算=${context.preferences.budgetPreference ?? 'なし'} / よく選ぶ=${context.preferences.favoriteActivities.join('、') || 'なし'}`
      : null,
    context.travelMemories.length > 0
      ? `旅行メモリー: ${summarizeTravelMemoriesForAnalysis(context.travelMemories)}`
      : null,
    context.followingUserIds.size > 0
      ? `フォロー中: ${context.followingUserIds.size}人`
      : null,
    context.likedPlanIds.size > 0 ? `いいね済み: ${context.likedPlanIds.size}件` : null,
    context.savedPlanIds.size > 0 ? `保存済み: ${context.savedPlanIds.size}件` : null,
  ].filter(Boolean);

  return lines.join('\n');
}

function extractJsonText(data: unknown): string {
  const response = data as {
    output_text?: string;
    output?: Array<{
      type?: string;
      content?: Array<{ type?: string; text?: string }>;
    }>;
  };

  if (response.output_text?.trim()) return response.output_text.trim();

  for (const item of response.output ?? []) {
    if (item.type !== 'message') continue;
    for (const part of item.content ?? []) {
      if (part.type === 'output_text' && part.text?.trim()) {
        return part.text.trim();
      }
    }
  }

  throw new AppError(APP_MESSAGES.openAiFailed, 'OPENAI_FAILED');
}

async function callRecommendationAi<T>(
  systemPrompt: string,
  userPrompt: string,
  schema: Record<string, unknown>,
  schemaName: string,
): Promise<T> {
  if (!isOpenAiConfigured()) {
    throw new AppError(APP_MESSAGES.openAiNotConfigured, 'OPENAI_FAILED');
  }

  const apiKey = getOpenAiApiKey()!;
  let response: Response;

  try {
    response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        input: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: schemaName,
            strict: true,
            schema,
          },
        },
      }),
    });
  } catch (error) {
    if (isNetworkError(error)) {
      throw new AppError(APP_MESSAGES.networkError, 'NETWORK_ERROR');
    }
    throw new AppError(APP_MESSAGES.openAiFailed, 'OPENAI_FAILED');
  }

  if (!response.ok) {
    throw new AppError(APP_MESSAGES.openAiFailed, 'OPENAI_FAILED');
  }

  const data = await response.json();
  return JSON.parse(extractJsonText(data)) as T;
}

const REASONS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    reasons: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          planId: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['planId', 'reason'],
      },
    },
  },
  required: ['reasons'],
} as const;

const SEARCH_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    planIds: {
      type: 'array',
      items: { type: 'string' },
    },
    reasons: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          planId: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['planId', 'reason'],
      },
    },
    suggestCreatePlan: { type: 'boolean' },
    createPlanMessage: { type: ['string', 'null'] },
  },
  required: ['planIds', 'reasons', 'suggestCreatePlan', 'createPlanMessage'],
} as const;

async function enrichItemsWithAiReasons(
  items: RecommendedPlanItem[],
  context: RecommendationContext,
): Promise<RecommendedPlanItem[]> {
  if (!isOpenAiConfigured() || items.length === 0) return items;

  const uniqueItems = items.slice(0, MAX_AI_REASONS);
  const planCatalog = uniqueItems.map((item) => summarizePlanForAi(item.plan)).join('\n');

  try {
    const result = await callRecommendationAi<{ reasons: Array<{ planId: string; reason: string }> }>(
      `あなたはNanisuruのおすすめプランアシスタントです。
ユーザーの好みに合わせ、各プランがおすすめの理由を日本語1文（60字以内）で書いてください。
丁寧で親しみやすいトーン。絵文字は使わない。`,
      `【ユーザー情報】
${buildContextBrief(context)}

【おすすめプラン】
${planCatalog}

各 planId について、ユーザーにパーソナルに響く理由を返してください。`,
      REASONS_SCHEMA,
      'discover_recommendation_reasons',
    );

    const reasonMap = new Map(result.reasons.map((entry) => [entry.planId, entry.reason]));
    return items.map((item) => ({
      ...item,
      reason: reasonMap.get(item.plan.id) ?? item.reason,
    }));
  } catch {
    return items;
  }
}

export async function buildDiscoverRecommendations(
  input: BuildRecommendationsInput,
): Promise<DiscoverRecommendationsResult> {
  const context = await buildRecommendationContext(
    input.currentUserId,
    input.filters,
    input.location ?? null,
  );

  const eligiblePlans = input.plans.filter((plan) =>
    isEligiblePlan(plan, input.currentUserId),
  );
  const trendingRankMap = buildTrendingRankMap(input.trendingPlans);
  const usedPlanIds = new Set<string>();

  const categoryOrder: RecommendationCategoryId[] = [
    'today_for_you',
    'tonight',
    'date',
    'rainy',
    'budget_popular',
    'following',
    'trending',
  ];

  const categories: RecommendationCategoryGroup[] = [];

  for (const categoryId of categoryOrder) {
    const items = pickCategoryItems(
      eligiblePlans,
      categoryId,
      context,
      trendingRankMap,
      usedPlanIds,
    );
    if (items.length > 0) {
      categories.push({
        id: categoryId,
        title: RECOMMENDATION_CATEGORY_LABELS[categoryId],
        items,
      });
    }
  }

  const allItems = categories.flatMap((category) => category.items);
  const enrichedItems = await enrichItemsWithAiReasons(allItems, context);
  const reasonMap = new Map(enrichedItems.map((item) => [item.plan.id, item.reason]));

  const enrichedCategories = categories.map((category) => ({
    ...category,
    items: category.items.map((item) => ({
      ...item,
      reason: reasonMap.get(item.plan.id) ?? item.reason,
    })),
  }));

  const totalCount = enrichedCategories.reduce((sum, category) => sum + category.items.length, 0);
  const personalization = hasPersonalizationData(context);

  return {
    categories: enrichedCategories,
    totalCount,
    hasPersonalizationData: personalization,
    isSparse: totalCount < 3 || (!personalization && totalCount < 5),
  };
}

export async function searchPublicPlansWithAi(
  query: string,
  plans: PublicPlan[],
  context: RecommendationContext,
): Promise<AiPlanSearchResult> {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error('気分や条件を入力してください');
  }

  const eligiblePlans = plans
    .filter((plan) => isEligiblePlan(plan, context.currentUserId))
    .slice(0, MAX_AI_PLANS);

  if (!isOpenAiConfigured()) {
    const fallback = eligiblePlans
      .map((plan) => ({
        plan,
        score: scorePreferenceMatch(plan, context) + scorePopularity(plan) * 0.3,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    if (fallback.length === 0) {
      return {
        items: [],
        suggestCreatePlan: true,
        createPlanMessage: '条件に合う公開プランが見つかりませんでした。AIで新しいプランを作成してみましょう。',
      };
    }

    return {
      items: fallback.map((item) => ({
        plan: item.plan,
        categoryId: 'today_for_you' as const,
        reason: buildHeuristicReason(item.plan, 'today_for_you', context),
      })),
      suggestCreatePlan: false,
      createPlanMessage: null,
    };
  }

  const catalog = eligiblePlans.map((plan) => summarizePlanForAi(plan)).join('\n');

  type AiSearchResponse = {
    planIds: string[];
    reasons: Array<{ planId: string; reason: string }>;
    suggestCreatePlan: boolean;
    createPlanMessage: string | null;
  };

  let result: AiSearchResponse;

  try {
    result = await callRecommendationAi<AiSearchResponse>(
      `あなたはNanisuruの公開プラン検索アシスタントです。
ユーザーの気分・条件に最も合う公開プランを最大5件選び、日本語で理由を書いてください。
合う公開プランが3件未満、または十分に合うプランがない場合は suggestCreatePlan を true にし、
createPlanMessage で新しいAIプラン作成を優しく提案してください。
理由は1文60字以内。絵文字なし。`,
      `【ユーザー情報】
${buildContextBrief(context)}

【検索リクエスト】
${trimmed}

【公開プラン一覧】
${catalog}`,
      SEARCH_SCHEMA,
      'discover_ai_search',
    );
  } catch {
    return {
      items: [],
      suggestCreatePlan: true,
      createPlanMessage: '公開プランから十分な候補が見つかりませんでした。AIであなただけのプランを作成してみましょう。',
    };
  }

  const planMap = new Map(eligiblePlans.map((plan) => [plan.id, plan]));
  const reasonMap = new Map(result.reasons.map((entry) => [entry.planId, entry.reason]));

  const items: RecommendedPlanItem[] = result.planIds
    .flatMap((planId) => {
      const plan = planMap.get(planId);
      if (!plan) return [];
      return [
        {
          plan,
          categoryId: 'today_for_you' as const,
          reason:
            reasonMap.get(planId) ??
            buildHeuristicReason(plan, 'today_for_you', context),
        },
      ];
    })
    .slice(0, 5);

  if (items.length === 0 || result.suggestCreatePlan) {
    return {
      items,
      suggestCreatePlan: true,
      createPlanMessage:
        result.createPlanMessage ??
        '条件にぴったりの公開プランがまだ少ないようです。AIで新しいプランを作成してみましょう。',
    };
  }

  return {
    items,
    suggestCreatePlan: false,
    createPlanMessage: null,
  };
}
