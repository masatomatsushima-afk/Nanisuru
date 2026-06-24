import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  createEmptyRequestCounts,
  PUBLIC_PLAN_REQUEST_TYPES,
  type PublicPlanRequestSummary,
  type PublicPlanRequestType,
} from '@/types/public-plan-feedback';

type RequestRow = {
  request_type: PublicPlanRequestType;
  user_id: string;
};

function assertRequestsConfigured(): void {
  if (!isSupabaseConfigured()) {
    throw new Error(
      '改善リクエスト機能には Supabase の設定が必要です。\npublic_plan_requests テーブルを作成してください。',
    );
  }
}

async function getCurrentUserId(): Promise<string | null> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function fetchPublicPlanRequestSummary(
  publicPlanId: string,
): Promise<PublicPlanRequestSummary> {
  assertRequestsConfigured();

  if (!publicPlanId.trim()) {
    return {
      counts: createEmptyRequestCounts(),
      myRequestTypes: [],
      totalCount: 0,
    };
  }

  const supabase = getSupabase();
  const currentUserId = await getCurrentUserId();

  const { data, error } = await supabase
    .from('public_plan_requests')
    .select('request_type, user_id')
    .eq('public_plan_id', publicPlanId);

  if (error) {
    throw new Error(error.message ?? '改善リクエストの取得に失敗しました');
  }

  const counts = createEmptyRequestCounts();
  const myRequestTypes: PublicPlanRequestType[] = [];

  for (const row of (data ?? []) as RequestRow[]) {
    counts[row.request_type] += 1;
    if (currentUserId && row.user_id === currentUserId) {
      myRequestTypes.push(row.request_type);
    }
  }

  const totalCount = PUBLIC_PLAN_REQUEST_TYPES.reduce(
    (sum, item) => sum + counts[item.id],
    0,
  );

  return { counts, myRequestTypes, totalCount };
}

export async function submitPublicPlanRequest(
  publicPlanId: string,
  requestType: PublicPlanRequestType,
): Promise<PublicPlanRequestSummary> {
  assertRequestsConfigured();

  const supabase = getSupabase();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('ログインが必要です');
  }

  const { error } = await supabase.from('public_plan_requests').insert({
    public_plan_id: publicPlanId,
    user_id: user.id,
    request_type: requestType,
  });

  if (error) {
    if (error.code === '23505') {
      throw new Error('このリクエストはすでに送信済みです');
    }
    throw new Error(error.message ?? '改善リクエストの送信に失敗しました');
  }

  const { notifyPlanRequest } = await import('@/lib/notifications');
  void notifyPlanRequest(publicPlanId, user.id, requestType);

  return fetchPublicPlanRequestSummary(publicPlanId);
}
