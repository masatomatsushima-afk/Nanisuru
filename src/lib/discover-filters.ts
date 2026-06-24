import { formatAmount, getCurrency, type CurrencyCode } from '@/constants/currency';
import { inferCurrencyFromLocation } from '@/lib/location-currency';
import { flattenItineraryDays } from '@/lib/trip-duration';
import type {
  DiscoverBudgetFilterId,
  DiscoverFilterChipId,
  DiscoverFilterState,
  DiscoverSortOption,
} from '@/types/discover-filters';
import { parseBudgetAmount, type PublicPlan } from '@/types/public-plan';

type BudgetThresholds = {
  tier1: number;
  tier2: number;
  tier3: number;
};

const BUDGET_THRESHOLDS: Record<CurrencyCode, BudgetThresholds> = {
  JPY: { tier1: 3000, tier2: 5000, tier3: 10000 },
  AUD: { tier1: 30, tier2: 50, tier3: 100 },
  USD: { tier1: 20, tier2: 35, tier3: 70 },
  KRW: { tier1: 30000, tier2: 50000, tier3: 100000 },
  EUR: { tier1: 20, tier2: 35, tier3: 70 },
};

export function resolveDiscoverCurrency(areaQuery: string): CurrencyCode {
  const trimmed = areaQuery.trim();
  if (trimmed) {
    return inferCurrencyFromLocation(trimmed);
  }
  return 'JPY';
}

export function getBudgetFilterOptions(currency: CurrencyCode): ReadonlyArray<{
  id: DiscoverBudgetFilterId;
  label: string;
}> {
  const thresholds = BUDGET_THRESHOLDS[currency];
  return [
    { id: 'under_3000', label: `〜${formatAmount(thresholds.tier1, currency)}` },
    { id: 'under_5000', label: `〜${formatAmount(thresholds.tier2, currency)}` },
    { id: 'under_10000', label: `〜${formatAmount(thresholds.tier3, currency)}` },
    { id: 'over_10000', label: `${formatAmount(thresholds.tier3, currency)}以上` },
  ];
}

function normalizeText(value: string): string {
  return value.toLowerCase().trim();
}

function includesAny(text: string, keywords: string[]): boolean {
  const normalized = normalizeText(text);
  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

function getPlanBudgetAmount(plan: PublicPlan): number {
  const fromInput = parseBudgetAmount(plan);
  if (fromInput !== Number.MAX_SAFE_INTEGER) {
    return fromInput;
  }

  const totalBudget = plan.payload.details?.totalBudget ?? '';
  const parsed = Number.parseFloat(totalBudget.replace(/[^\d.]/g, ''));
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function getPlanCurrency(plan: PublicPlan): CurrencyCode {
  return plan.payload.currency ?? inferCurrencyFromLocation(plan.payload.location);
}

function getBudgetThresholds(currency: CurrencyCode): BudgetThresholds {
  return BUDGET_THRESHOLDS[currency];
}

function matchesBudgetTier(plan: PublicPlan, tier: DiscoverBudgetFilterId): boolean {
  const amount = getPlanBudgetAmount(plan);
  if (amount === Number.MAX_SAFE_INTEGER) return false;

  const thresholds = getBudgetThresholds(getPlanCurrency(plan));
  switch (tier) {
    case 'under_3000':
      return amount <= thresholds.tier1;
    case 'under_5000':
      return amount <= thresholds.tier2;
    case 'under_10000':
      return amount <= thresholds.tier3;
    case 'over_10000':
      return amount > thresholds.tier3;
    default:
      return true;
  }
}

function isLowBudgetPlan(plan: PublicPlan): boolean {
  const amount = getPlanBudgetAmount(plan);
  if (amount === Number.MAX_SAFE_INTEGER) return false;
  return amount <= getBudgetThresholds(getPlanCurrency(plan)).tier2;
}

function buildPlanSearchHaystack(plan: PublicPlan): string {
  const activities = flattenItineraryDays(plan.payload.days ?? [])
    .map((item) => [item.activity, item.placeCategory, item.reason].filter(Boolean).join(' '))
    .join(' ');

  return normalizeText(
    [
      plan.title,
      plan.description,
      plan.category,
      plan.payload.location,
      plan.payload.mood,
      plan.payload.companion,
      plan.payload.personality,
      plan.payload.tripDuration,
      plan.tags.join(' '),
      activities,
      plan.payload.details?.highlights?.join(' ') ?? '',
      plan.payload.details?.plannerMessage ?? '',
    ]
      .filter(Boolean)
      .join(' '),
  );
}

export function matchesDiscoverSearch(plan: PublicPlan, query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return true;

  const haystack = buildPlanSearchHaystack(plan);
  const tokens = normalizeText(trimmed).split(/\s+/).filter(Boolean);
  return tokens.every((token) => haystack.includes(token));
}

export function matchesDiscoverArea(plan: PublicPlan, areaQuery: string): boolean {
  const trimmed = areaQuery.trim();
  if (!trimmed) return true;

  const location = normalizeText(plan.payload.location ?? '');
  const tokens = normalizeText(trimmed).split(/\s+/).filter(Boolean);
  return tokens.some((token) => location.includes(token));
}

function matchesFilterChip(plan: PublicPlan, chipId: DiscoverFilterChipId): boolean {
  const { payload } = plan;
  const haystack = buildPlanSearchHaystack(plan);

  switch (chipId) {
    case 'date':
      return (
        plan.category === 'デート' ||
        payload.companion === 'カップル' ||
        payload.companion === '初デート'
      );
    case 'friends':
      return plan.category === '友達' || payload.companion === '友達';
    case 'solo':
      return plan.category === '一人' || payload.companion === '一人';
    case 'family':
      return plan.category === '家族' || payload.companion === '家族';
    case 'gourmet':
      return (
        plan.category === 'グルメ' ||
        payload.personality === 'グルメ' ||
        includesAny(haystack, ['グルメ', 'gourmet', '食事', 'レストラン', 'ランチ', 'ディナー'])
      );
    case 'cafe':
      return includesAny(haystack, ['カフェ', 'cafe', 'coffee', 'コーヒー', '喫茶', 'brunch']);
    case 'rainy':
      return (
        plan.tags.some((tag) => tag.includes('雨')) ||
        (payload.details?.rainyDayAlternatives?.length ?? 0) > 0 ||
        includesAny(haystack, ['雨', 'rainy', '屋内'])
      );
    case 'low_budget':
      return isLowBudgetPlan(plan);
    case 'half_day':
      return payload.tripDuration === '半日';
    case 'one_day':
      return payload.tripDuration === '1日';
    case 'night_date':
      return includesAny(haystack, [
        '夜',
        '夜景',
        'ナイト',
        'イルミ',
        'バー',
        'night',
        'evening',
        '18:',
        '19:',
        '20:',
        '21:',
      ]);
    case 'hidden_gem':
      return (
        payload.personality === '穴場好き' ||
        includesAny(haystack, ['穴場', '隠れ家', 'ローカル', 'hidden', 'secret'])
      );
    case 'insta':
      return (
        payload.personality === '映え重視' ||
        includesAny(haystack, ['映え', 'インスタ', 'insta', 'フォト', 'photo', 'photogenic'])
      );
    default:
      return true;
  }
}

export function filterDiscoverPlans(
  plans: PublicPlan[],
  filters: DiscoverFilterState,
): PublicPlan[] {
  return plans.filter((plan) => {
    if (plan.visibility !== 'public') return false;
    if (!matchesDiscoverSearch(plan, filters.searchQuery)) return false;
    if (!matchesDiscoverArea(plan, filters.areaQuery)) return false;
    if (filters.budgetFilter && !matchesBudgetTier(plan, filters.budgetFilter)) return false;

    if (filters.selectedChips.length > 0) {
      const matchesChip = filters.selectedChips.some((chipId) =>
        matchesFilterChip(plan, chipId),
      );
      if (!matchesChip) return false;
    }

    return true;
  });
}

export function sortDiscoverPlans(
  plans: PublicPlan[],
  sort: DiscoverSortOption,
): PublicPlan[] {
  const copy = [...plans];

  switch (sort) {
    case 'newest':
      return copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case 'saves':
      return copy.sort(
        (a, b) => b.saveCount - a.saveCount || b.createdAt.localeCompare(a.createdAt),
      );
    case 'likes':
      return copy.sort(
        (a, b) => b.likeCount - a.likeCount || b.createdAt.localeCompare(a.createdAt),
      );
    case 'popular':
    default:
      return copy.sort((a, b) => {
        const scoreDiff =
          b.likeCount * 2 + b.saveCount - (a.likeCount * 2 + a.saveCount);
        if (scoreDiff !== 0) return scoreDiff;
        return b.createdAt.localeCompare(a.createdAt);
      });
  }
}

export function applyDiscoverFilters(
  plans: PublicPlan[],
  filters: DiscoverFilterState,
): PublicPlan[] {
  return sortDiscoverPlans(filterDiscoverPlans(plans, filters), filters.sort);
}

export function countActiveDiscoverFilters(filters: DiscoverFilterState): number {
  let count = 0;
  if (filters.searchQuery.trim()) count += 1;
  if (filters.areaQuery.trim()) count += 1;
  if (filters.budgetFilter) count += 1;
  count += filters.selectedChips.length;
  if (filters.sort !== 'popular') count += 1;
  return count;
}

export function getDiscoverCurrencyHint(currency: CurrencyCode): string {
  const { label, symbol, code } = getCurrency(currency);
  return `表示通貨: ${label}（${code} · ${symbol}）`;
}
