export const PROFILE_STYLE_TAGS = [
  'デートプラン',
  'グルメ',
  'カフェ',
  '低予算',
  '穴場',
  '旅行',
  '雨の日',
] as const;

export type ProfileStyleTag = (typeof PROFILE_STYLE_TAGS)[number];

export type UserProfile = {
  userId: string;
  displayName: string;
  bio: string;
  styleTags: string[];
  isLocalContributor: boolean;
  localExpertAreas: string[];
  followerCount: number;
  followingCount: number;
  avatarUrl?: string;
  publicPlanCount?: number;
  publicMemoryCount?: number;
  localSpotCount?: number;
  createdAt: string;
  updatedAt: string;
  isFollowing?: boolean;
  isSelf?: boolean;
};

export type SaveUserProfileInput = {
  displayName: string;
  bio: string;
  styleTags: string[];
  isLocalContributor?: boolean;
  localExpertAreas?: string[];
};

export function getProfileInitial(displayName: string): string {
  const trimmed = displayName.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : '?';
}
