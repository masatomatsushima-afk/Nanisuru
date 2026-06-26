import type { ModerationStatus } from '@/types/moderation';

export const LOCAL_HIDDEN_SPOT_CATEGORIES = [
  'カフェ',
  'レストラン',
  '景色',
  '散歩',
  '夜景',
  '買い物',
  '体験',
  '雨の日',
  'デート',
  '一人時間',
  'その他',
] as const;

export type LocalHiddenSpotCategory = (typeof LOCAL_HIDDEN_SPOT_CATEGORIES)[number];

export const LOCAL_HIDDEN_SPOT_TAGS = [
  '地元民おすすめ',
  '観光客少なめ',
  '安い',
  '映える',
  '雨の日OK',
  'デート向き',
  '一人でも行きやすい',
  '夜も安心',
  '要予約',
] as const;

export type LocalHiddenSpotTag = (typeof LOCAL_HIDDEN_SPOT_TAGS)[number];

export type LocalHiddenSpot = {
  id: string;
  userId: string;
  name: string;
  area: string;
  category: LocalHiddenSpotCategory;
  description: string;
  bestTime: string;
  estimatedBudget: string;
  crowdTip: string;
  caution: string;
  googleMapsUrl: string;
  imageUrl: string;
  tags: string[];
  moderationStatus: ModerationStatus;
  creatorDisplayName: string;
  creatorArea?: string;
  isLocalContributor?: boolean;
  likeCount: number;
  saveCount: number;
  wantCount: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
  likedByMe?: boolean;
  savedByMe?: boolean;
  wantedByMe?: boolean;
};

export type SubmitLocalHiddenSpotInput = {
  name: string;
  area: string;
  category: LocalHiddenSpotCategory;
  description: string;
  bestTime?: string;
  estimatedBudget?: string;
  crowdTip?: string;
  caution?: string;
  googleMapsUrl?: string;
  imageUrl?: string;
  tags: string[];
};

export type LocalHiddenSpotComment = {
  id: string;
  spotId: string;
  userId: string;
  commentText: string;
  createdAt: string;
  displayName: string;
};

export function isDiscoverableLocalHiddenSpot(spot: LocalHiddenSpot): boolean {
  return spot.moderationStatus === 'active';
}

export function getLocalHiddenSpotCategoryIcon(category: LocalHiddenSpotCategory): string {
  const icons: Record<LocalHiddenSpotCategory, string> = {
    カフェ: '☕',
    レストラン: '🍽',
    景色: '🌄',
    散歩: '🚶',
    夜景: '🌃',
    買い物: '🛍',
    体験: '✨',
    '雨の日': '☔',
    デート: '💑',
    一人時間: '🧘',
    その他: '📍',
  };
  return icons[category] ?? '📍';
}
