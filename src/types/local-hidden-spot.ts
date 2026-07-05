import type { ModerationStatus } from '@/types/moderation';

export const LOCAL_HIDDEN_SPOT_CATEGORIES = [
  'グルメ',
  'カフェ',
  '自然',
  '夜景',
  '買い物',
  'デート',
  '一人時間',
  '雨の日',
  '夜遊び',
  'その他',
] as const;

/** @deprecated Legacy DB values — kept for display compatibility */
export const LEGACY_LOCAL_HIDDEN_SPOT_CATEGORIES = [
  'レストラン',
  '景色',
  '散歩',
  '体験',
] as const;

export type LocalHiddenSpotCategory = (typeof LOCAL_HIDDEN_SPOT_CATEGORIES)[number];

export type LocalHiddenSpotVisibility = 'private' | 'unlisted' | 'public';

export const LOCAL_GEM_VISIBILITY_LABELS: Record<LocalHiddenSpotVisibility, string> = {
  private: '自分だけ',
  unlisted: '共有リンクのみ',
  public: '公開する',
};

export const LOCAL_HIDDEN_SPOT_TAGS = [
  '地元民おすすめ',
  '観光客少なめ',
  '安い',
  '映える',
  '雨の日OK',
  'デート向き',
  '一人OK',
  '夜も安心',
  '予約推奨',
] as const;

export type LocalHiddenSpotTag = (typeof LOCAL_HIDDEN_SPOT_TAGS)[number];

export type LocalHiddenSpot = {
  id: string;
  userId: string;
  name: string;
  area: string;
  category: LocalHiddenSpotCategory | string;
  description: string;
  bestTime: string;
  estimatedBudget: string;
  crowdTip: string;
  caution: string;
  recommendedFor: string;
  googleMapsUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  imageUrl: string;
  tags: string[];
  visibility: LocalHiddenSpotVisibility;
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
  recommendedFor?: string;
  googleMapsUrl?: string;
  instagramUrl?: string;
  tiktokUrl?: string;
  imageUrl?: string;
  tags: string[];
  visibility?: LocalHiddenSpotVisibility;
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
  return spot.moderationStatus === 'active' && spot.visibility === 'public';
}

export function getLocalHiddenSpotCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    グルメ: '🍽',
    レストラン: '🍽',
    カフェ: '☕',
    自然: '🌿',
    景色: '🌄',
    散歩: '🚶',
    夜景: '🌃',
    買い物: '🛍',
    デート: '💑',
    一人時間: '🧘',
    '雨の日': '☔',
    夜遊び: '🌙',
    体験: '✨',
    その他: '📍',
  };
  return icons[category] ?? '📍';
}

export type LocalGemsFeedSection = {
  id: string;
  title: string;
  spots: LocalHiddenSpot[];
};
