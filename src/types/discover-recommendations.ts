import type { DiscoverFilterState } from '@/types/discover-filters';
import type { RankedPublicPlan } from '@/types/discover-ranking';
import type { PublicPlan } from '@/types/public-plan';
import type { UserPreferences } from '@/types/user-memory';
import type { TravelMemory } from '@/types/travel-memory';
import type { WeatherForecast } from '@/lib/weather';
import type { CurrentCoordinatesResult } from '@/lib/current-location';

export const RECOMMENDATION_CATEGORY_IDS = [
  'today_for_you',
  'tonight',
  'date',
  'rainy',
  'budget_popular',
  'following',
  'trending',
] as const;

export type RecommendationCategoryId = (typeof RECOMMENDATION_CATEGORY_IDS)[number];

export const RECOMMENDATION_CATEGORY_LABELS: Record<RecommendationCategoryId, string> = {
  today_for_you: '今日のあなたにおすすめ',
  tonight: '今夜行けるプラン',
  date: 'デートにおすすめ',
  rainy: '雨の日でも楽しめる',
  budget_popular: '予算内で人気',
  following: 'フォロー中の人のおすすめ',
  trending: '最近人気のプラン',
};

export type RecommendedPlanItem = {
  plan: PublicPlan;
  reason: string;
  categoryId: RecommendationCategoryId;
};

export type RecommendationCategoryGroup = {
  id: RecommendationCategoryId;
  title: string;
  items: RecommendedPlanItem[];
};

export type RecommendationContext = {
  currentUserId: string | null;
  preferences: UserPreferences;
  travelMemories: TravelMemory[];
  likedPlanIds: Set<string>;
  savedPlanIds: Set<string>;
  followingUserIds: Set<string>;
  filters: DiscoverFilterState;
  location: CurrentCoordinatesResult | null;
  weather: WeatherForecast | null;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  averageBudget: { amount: number; currency: string } | null;
};

export type DiscoverRecommendationsResult = {
  categories: RecommendationCategoryGroup[];
  isSparse: boolean;
  hasPersonalizationData: boolean;
  totalCount: number;
};

export type AiPlanSearchResult = {
  items: RecommendedPlanItem[];
  suggestCreatePlan: boolean;
  createPlanMessage: string | null;
};

export type BuildRecommendationsInput = {
  plans: PublicPlan[];
  trendingPlans: RankedPublicPlan[];
  currentUserId: string | null;
  filters: DiscoverFilterState;
  location?: CurrentCoordinatesResult | null;
};
