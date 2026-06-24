export type DiscoverRankingTab =
  | 'overall'
  | 'date'
  | 'gourmet'
  | 'low_budget'
  | 'rainy'
  | 'night'
  | 'solo';

export type DiscoverTimeFilter = 'today' | 'week' | 'month' | 'all';

export const DISCOVER_RANKING_TABS: ReadonlyArray<{
  id: DiscoverRankingTab;
  label: string;
}> = [
  { id: 'overall', label: '総合ランキング' },
  { id: 'date', label: 'デート' },
  { id: 'gourmet', label: 'グルメ' },
  { id: 'low_budget', label: '低予算' },
  { id: 'rainy', label: '雨の日' },
  { id: 'night', label: '夜プラン' },
  { id: 'solo', label: '一人時間' },
];

export const DISCOVER_TIME_FILTERS: ReadonlyArray<{
  id: DiscoverTimeFilter;
  label: string;
}> = [
  { id: 'today', label: '今日' },
  { id: 'week', label: '今週' },
  { id: 'month', label: '今月' },
  { id: 'all', label: '全期間' },
];

export type PlanActivityMetrics = {
  likes: number;
  saves: number;
  copies: number;
  comments: number;
  lastActivityAt: string | null;
};

import type { PublicPlan } from '@/types/public-plan';

export type RankedPublicPlan = {
  plan: PublicPlan;
  rank: number;
  score: number;
  metrics: PlanActivityMetrics;
};

export const POPULAR_CREATOR_TOP_N = 10;
export const TRENDING_PLAN_LIMIT = 5;

export function formatRankBadge(rank: number): string | null {
  if (rank === 1) return '1位';
  if (rank === 2) return '2位';
  if (rank === 3) return '3位';
  return null;
}
