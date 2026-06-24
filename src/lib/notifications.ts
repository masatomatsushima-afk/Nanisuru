import { getUserDisplayName } from '@/lib/auth';
import { getPublicPlanById } from '@/lib/public-plans';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { getBlockedUserIds } from '@/lib/user-blocks';
import { ensureUserProfile, getUserProfileById } from '@/lib/user-profiles';
import type { PublicPlanRequestType } from '@/types/public-plan-feedback';
import { getRequestTypeLabel } from '@/types/public-plan-feedback';
import type { AppNotification, NotificationType } from '@/types/notification';
import type { PublicPlan } from '@/types/public-plan';

type NotificationRow = {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  related_plan_id: string | null;
  related_user_id: string | null;
  is_read: boolean;
  created_at: string;
};

function assertNotificationsConfigured(): void {
  if (!isSupabaseConfigured()) {
    throw new Error(
      '通知機能には Supabase の設定が必要です。\nnotifications テーブルを作成してください。',
    );
  }
}

function rowToNotification(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    message: row.message,
    relatedPlanId: row.related_plan_id,
    relatedUserId: row.related_user_id,
    isRead: row.is_read,
    createdAt: row.created_at,
  };
}

async function getActorDisplayName(actorUserId: string): Promise<string> {
  const profile = await getUserProfileById(actorUserId);
  if (profile?.displayName) return profile.displayName;

  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && user.id === actorUserId) {
    return getUserDisplayName(user);
  }

  return 'ユーザー';
}

async function createNotification(input: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedPlanId?: string | null;
  relatedUserId?: string | null;
}): Promise<void> {
  assertNotificationsConfigured();

  const supabase = getSupabase();
  await supabase.rpc('create_notification', {
    p_user_id: input.userId,
    p_type: input.type,
    p_title: input.title,
    p_message: input.message,
    p_related_plan_id: input.relatedPlanId ?? null,
    p_related_user_id: input.relatedUserId ?? null,
  });
}

export function formatNotificationTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);

  if (diffMinutes < 1) return 'たった今';
  if (diffMinutes < 60) return `${diffMinutes}分前`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}時間前`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}日前`;

  return date.toLocaleString('ja-JP', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export async function fetchNotifications(limit = 50): Promise<AppNotification[]> {
  assertNotificationsConfigured();

  const supabase = getSupabase();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('ログインが必要です');
  }

  const { data, error } = await supabase
    .from('notifications')
    .select(
      'id, user_id, type, title, message, related_plan_id, related_user_id, is_read, created_at',
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message ?? '通知の取得に失敗しました');
  }

  const blockedUserIds = await getBlockedUserIds();
  const notifications = ((data ?? []) as NotificationRow[]).map(rowToNotification);

  return notifications.filter((notification) => {
    if (notification.relatedUserId && blockedUserIds.has(notification.relatedUserId)) {
      return false;
    }
    return true;
  });
}

export async function getUnreadNotificationCount(): Promise<number> {
  assertNotificationsConfigured();

  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return 0;

  const { data, error } = await supabase
    .from('notifications')
    .select('id, related_user_id')
    .eq('user_id', user.id)
    .eq('is_read', false);

  if (error || !data) return 0;

  const blockedUserIds = await getBlockedUserIds();
  return data.filter(
    (row) => !row.related_user_id || !blockedUserIds.has(row.related_user_id as string),
  ).length;
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  assertNotificationsConfigured();

  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', user.id);
}

export async function markAllNotificationsRead(): Promise<void> {
  assertNotificationsConfigured();

  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('ログインが必要です');
  }

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .eq('is_read', false);

  if (error) {
    throw new Error(error.message ?? '既読処理に失敗しました');
  }
}

async function notifyPlanOwner(params: {
  plan: PublicPlan;
  actorUserId: string;
  type: NotificationType;
  title: string;
  buildMessage: (actorName: string, planTitle: string) => string;
}): Promise<void> {
  if (params.plan.userId === params.actorUserId) return;

  const actorName = await getActorDisplayName(params.actorUserId);
  await createNotification({
    userId: params.plan.userId,
    type: params.type,
    title: params.title,
    message: params.buildMessage(actorName, params.plan.title),
    relatedPlanId: params.plan.id,
    relatedUserId: params.actorUserId,
  });
}

export async function notifyPlanLiked(planId: string, actorUserId: string): Promise<void> {
  const plan = await getPublicPlanById(planId);
  if (!plan) return;

  await notifyPlanOwner({
    plan,
    actorUserId,
    type: 'plan_liked',
    title: 'プランにいいねされました',
    buildMessage: (actor, title) => `${actor}さんがあなたのプラン「${title}」にいいねしました`,
  });
}

export async function notifyPlanSaved(planId: string, actorUserId: string): Promise<void> {
  const plan = await getPublicPlanById(planId);
  if (!plan) return;

  await notifyPlanOwner({
    plan,
    actorUserId,
    type: 'plan_saved',
    title: 'プランが保存されました',
    buildMessage: (actor, title) => `${actor}さんがあなたのプラン「${title}」を保存しました`,
  });
}

export async function notifyPlanCopied(planId: string, actorUserId: string): Promise<void> {
  const plan = await getPublicPlanById(planId);
  if (!plan) return;

  await notifyPlanOwner({
    plan,
    actorUserId,
    type: 'plan_copied',
    title: 'プランがコピーされました',
    buildMessage: (actor, title) =>
      `${actor}さんがあなたのプラン「${title}」をコピーして編集を始めました`,
  });
}

export async function notifyPlanCommented(
  planId: string,
  actorUserId: string,
  commentPreview: string,
): Promise<void> {
  const plan = await getPublicPlanById(planId);
  if (!plan) return;

  const preview = commentPreview.trim().slice(0, 40);
  await notifyPlanOwner({
    plan,
    actorUserId,
    type: 'plan_commented',
    title: 'コメントが届きました',
    buildMessage: (actor, title) =>
      `${actor}さんが「${title}」にコメントしました：${preview}${commentPreview.length > 40 ? '…' : ''}`,
  });
}

export async function notifyUserFollowed(
  targetUserId: string,
  actorUserId: string,
): Promise<void> {
  if (targetUserId === actorUserId) return;

  const actorName = await getActorDisplayName(actorUserId);
  await createNotification({
    userId: targetUserId,
    type: 'user_followed',
    title: 'フォローされました',
    message: `${actorName}さんがあなたをフォローしました`,
    relatedUserId: actorUserId,
  });
}

export async function notifyPlanRequest(
  planId: string,
  actorUserId: string,
  requestType: PublicPlanRequestType,
): Promise<void> {
  const plan = await getPublicPlanById(planId);
  if (!plan) return;

  const label = getRequestTypeLabel(requestType);
  await notifyPlanOwner({
    plan,
    actorUserId,
    type: 'plan_request',
    title: '改善リクエストが届きました',
    buildMessage: (actor, title) =>
      `${actor}さんが「${title}」に「${label}」をリクエストしました`,
  });
}

export async function notifyPlanRanked(plan: PublicPlan, rank: number): Promise<void> {
  if (rank < 1 || rank > 5) return;

  await createNotification({
    userId: plan.userId,
    type: 'plan_ranked',
    title: 'プランがランキング入りしました',
    message: `あなたのプラン「${plan.title}」が今人気ランキング${rank}位に入りました`,
    relatedPlanId: plan.id,
    relatedUserId: null,
  });
}

export async function notifyRankingEntries(
  ranked: Array<{ plan: PublicPlan; rank: number }>,
): Promise<void> {
  await Promise.all(
    ranked.slice(0, 5).map((item) => notifyPlanRanked(item.plan, item.rank).catch(() => undefined)),
  );
}

export async function ensureActorProfile(): Promise<void> {
  try {
    await ensureUserProfile();
  } catch {
    // ignore profile bootstrap errors for notifications
  }
}
