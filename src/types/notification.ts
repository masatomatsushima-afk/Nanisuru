export const NOTIFICATION_TYPES = [
  'plan_liked',
  'plan_saved',
  'plan_copied',
  'plan_commented',
  'user_followed',
  'plan_ranked',
  'plan_request',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type AppNotification = {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedPlanId: string | null;
  relatedUserId: string | null;
  isRead: boolean;
  createdAt: string;
};

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  plan_liked: 'いいね',
  plan_saved: '保存',
  plan_copied: 'コピー',
  plan_commented: 'コメント',
  user_followed: 'フォロー',
  plan_ranked: 'ランキング',
  plan_request: '改善リクエスト',
};

export const NOTIFICATION_TYPE_ICONS: Record<NotificationType, string> = {
  plan_liked: '♥',
  plan_saved: '📌',
  plan_copied: '📋',
  plan_commented: '💬',
  user_followed: '👤',
  plan_ranked: '🏆',
  plan_request: '✨',
};
