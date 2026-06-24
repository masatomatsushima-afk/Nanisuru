import { flattenItineraryDays } from '@/lib/trip-duration';
import { fetchPlanActivityMetricsMap, getTimeFilterSince } from '@/lib/public-plan-activity';
import {
  POPULAR_CREATOR_TOP_N,
  TRENDING_PLAN_LIMIT,
  type DiscoverRankingTab,
  type DiscoverTimeFilter,
  type PlanActivityMetrics,
  type RankedPublicPlan,
} from '@/types/discover-ranking';
import { parseBudgetAmount, type PublicPlan } from '@/types/public-plan';

function buildPlanHaystack(plan: PublicPlan): string {
  const activities = flattenItineraryDays(plan.payload.days ?? [])
    .map((item) => item.activity)
    .join(' ');

  return [
    plan.title,
    plan.description,
    plan.category,
    plan.payload.location,
    plan.payload.companion,
    plan.payload.personality,
    plan.payload.mood,
    plan.tags.join(' '),
    activities,
  ]
    .join(' ')
    .toLowerCase();
}

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
}

export function matchesRankingTab(plan: PublicPlan, tab: DiscoverRankingTab): boolean {
  if (tab === 'overall') return true;

  const haystack = buildPlanHaystack(plan);
  const { payload } = plan;

  switch (tab) {
    case 'date':
      return (
        plan.category === 'デート' ||
        payload.companion === 'カップル' ||
        payload.companion === '初デート'
      );
    case 'gourmet':
      return (
        plan.category === 'グルメ' ||
        payload.personality === 'グルメ' ||
        includesAny(haystack, ['グルメ', 'gourmet', '食事', 'レストラン', 'ランチ', 'ディナー'])
      );
    case 'low_budget':
      return parseBudgetAmount(plan) <= 5000 || includesAny(haystack, ['低予算', 'コスパ', '安い']);
    case 'rainy':
      return (
        plan.tags.some((tag) => tag.includes('雨')) ||
        (payload.details?.rainyDayAlternatives?.length ?? 0) > 0 ||
        includesAny(haystack, ['雨', 'rainy', '屋内'])
      );
    case 'night':
      return includesAny(haystack, ['夜', '夜景', 'ナイト', 'イルミ', 'バー', 'night', '18:', '19:', '20:']);
    case 'solo':
      return plan.category === '一人' || payload.companion === '一人';
    default:
      return true;
  }
}

export function computeRecentActivityBonus(
  lastActivityAt: string | null,
  timeFilter: DiscoverTimeFilter,
): number {
  if (!lastActivityAt) return 0;

  const hoursSince = (Date.now() - new Date(lastActivityAt).getTime()) / 3_600_000;

  if (timeFilter === 'today') {
    if (hoursSince <= 24) return 8;
    return 0;
  }

  if (hoursSince <= 24) return 5;
  if (hoursSince <= 72) return 3;
  if (hoursSince <= 168) return 1;
  return 0;
}

export function computeRankingScore(
  metrics: PlanActivityMetrics,
  timeFilter: DiscoverTimeFilter,
): number {
  const base =
    metrics.likes * 1 +
    metrics.saves * 2 +
    metrics.copies * 3 +
    metrics.comments * 1;

  return base + computeRecentActivityBonus(metrics.lastActivityAt, timeFilter);
}

export async function buildRankedPlans(
  plans: PublicPlan[],
  tab: DiscoverRankingTab,
  timeFilter: DiscoverTimeFilter,
): Promise<RankedPublicPlan[]> {
  const publicPlans = plans.filter((plan) => plan.visibility === 'public');
  const filtered = publicPlans.filter((plan) => matchesRankingTab(plan, tab));
  const metricsMap = await fetchPlanActivityMetricsMap(filtered, timeFilter);

  const scored = filtered
    .map((plan) => {
      const metrics = metricsMap.get(plan.id) ?? {
        likes: 0,
        saves: 0,
        copies: 0,
        comments: 0,
        lastActivityAt: null,
      };
      return {
        plan,
        score: computeRankingScore(metrics, timeFilter),
        metrics,
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.plan.createdAt.localeCompare(a.plan.createdAt);
    });

  return scored.map((item, index) => ({
    ...item,
    rank: index + 1,
  }));
}

export async function buildTrendingPlans(
  plans: PublicPlan[],
): Promise<RankedPublicPlan[]> {
  const ranked = await buildRankedPlans(plans, 'overall', 'week');
  return ranked.slice(0, TRENDING_PLAN_LIMIT);
}

export function buildPopularCreatorIds(rankedPlans: RankedPublicPlan[]): Set<string> {
  const top = rankedPlans.slice(0, POPULAR_CREATOR_TOP_N);
  return new Set(top.map((item) => item.plan.userId));
}

export { TRENDING_PLAN_LIMIT, POPULAR_CREATOR_TOP_N };
