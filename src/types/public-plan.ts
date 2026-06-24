import type { SavedTripPayload } from '@/types/trip';

export const PUBLIC_PLAN_CATEGORIES = [
  'デート',
  '友達',
  '一人',
  '家族',
  '旅行',
  'グルメ',
] as const;

export type PublicPlanCategory = (typeof PUBLIC_PLAN_CATEGORIES)[number];

export const PUBLIC_PLAN_VISIBILITY_OPTIONS = [
  { value: 'public', label: '全体公開', description: '発見タブに表示されます' },
  { value: 'unlisted', label: 'リンクのみ', description: 'URLを知っている人だけ閲覧できます' },
  { value: 'private', label: '非公開', description: '自分だけが閲覧できます' },
] as const;

export type PublicPlanVisibility = (typeof PUBLIC_PLAN_VISIBILITY_OPTIONS)[number]['value'];

export type DiscoverSortOption =
  | 'popular'
  | 'newest'
  | 'date'
  | 'gourmet'
  | 'travel'
  | 'low_budget'
  | 'rainy_day';

export const DISCOVER_SORT_OPTIONS: ReadonlyArray<{
  value: DiscoverSortOption;
  label: string;
}> = [
  { value: 'popular', label: '人気' },
  { value: 'newest', label: '新着' },
  { value: 'date', label: 'デート' },
  { value: 'gourmet', label: 'グルメ' },
  { value: 'travel', label: '旅行' },
  { value: 'low_budget', label: '低予算' },
  { value: 'rainy_day', label: '雨の日' },
];

export type PublicPlan = {
  id: string;
  userId: string;
  sourceTripId: string | null;
  title: string;
  description: string;
  category: PublicPlanCategory;
  tags: string[];
  visibility: PublicPlanVisibility;
  creatorDisplayName: string;
  payload: SavedTripPayload;
  likeCount: number;
  saveCount: number;
  createdAt: string;
  updatedAt: string;
  likedByMe?: boolean;
  savedByMe?: boolean;
  creatorFollowerCount?: number;
  isFollowingCreator?: boolean;
};

export type PublishPublicPlanInput = {
  sourceTripId: string;
  title: string;
  description: string;
  category: PublicPlanCategory;
  tags: string[];
  visibility: PublicPlanVisibility;
  payload: SavedTripPayload;
};

export type PublicPlanListItem = PublicPlan;

export function formatPublicPlanBudget(plan: PublicPlan): string {
  const { payload } = plan;
  if (payload.details?.totalBudget?.trim()) {
    return payload.details.totalBudget;
  }
  if (payload.budget?.trim()) {
    return `${payload.budget} ${payload.currency}`;
  }
  return '予算未設定';
}

export function formatPublicPlanDuration(plan: PublicPlan): string {
  return plan.payload.tripDuration || plan.payload.details?.duration || '1日';
}

export function getPublicPlanDestination(plan: PublicPlan): string {
  return plan.payload.location?.trim() || '未指定';
}

export function parseBudgetAmount(plan: PublicPlan): number {
  const raw = plan.payload.budget?.replace(/[^\d.]/g, '') ?? '';
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

export function companionToDefaultCategory(
  companion: SavedTripPayload['companion'],
): PublicPlanCategory {
  switch (companion) {
    case 'カップル':
    case '初デート':
      return 'デート';
    case '友達':
      return '友達';
    case '家族':
      return '家族';
    case '一人':
      return '一人';
    default:
      return '旅行';
  }
}

export function personalityToDefaultCategory(
  personality: SavedTripPayload['personality'],
): PublicPlanCategory {
  if (personality === 'グルメ') return 'グルメ';
  return '旅行';
}
