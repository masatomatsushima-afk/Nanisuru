import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import type { PublicPlan } from '@/types/public-plan';
import type { DiscoverTimeFilter, PlanActivityMetrics } from '@/types/discover-ranking';

type ActivityRow = {
  public_plan_id: string;
  created_at: string;
};

function assertActivityConfigured(): void {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase の設定が必要です');
  }
}

export function getTimeFilterSince(timeFilter: DiscoverTimeFilter): string | null {
  if (timeFilter === 'all') return null;

  const now = new Date();
  switch (timeFilter) {
    case 'today': {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return start.toISOString();
    }
    case 'week': {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      return start.toISOString();
    }
    case 'month': {
      const start = new Date(now);
      start.setDate(start.getDate() - 30);
      return start.toISOString();
    }
    default:
      return null;
  }
}

function metricsFromPlanTotals(plan: PublicPlan): PlanActivityMetrics {
  return {
    likes: plan.likeCount,
    saves: plan.saveCount,
    copies: plan.copyCount ?? 0,
    comments: plan.commentCount ?? 0,
    lastActivityAt: plan.updatedAt,
  };
}

function aggregateRows(rows: ActivityRow[]): Map<string, { count: number; lastAt: string | null }> {
  const map = new Map<string, { count: number; lastAt: string | null }>();
  for (const row of rows) {
    const existing = map.get(row.public_plan_id);
    if (!existing) {
      map.set(row.public_plan_id, { count: 1, lastAt: row.created_at });
      continue;
    }
    existing.count += 1;
    if (!existing.lastAt || row.created_at > existing.lastAt) {
      existing.lastAt = row.created_at;
    }
  }
  return map;
}

function mergeLastActivity(current: string | null, next: string | null): string | null {
  if (!current) return next;
  if (!next) return current;
  return next > current ? next : current;
}

async function fetchTableActivity(
  table: 'public_plan_likes' | 'public_plan_saves' | 'public_plan_copies' | 'public_plan_comments',
  planIds: string[],
  since: string | null,
): Promise<ActivityRow[]> {
  if (planIds.length === 0) return [];

  const supabase = getSupabase();
  let query = supabase
    .from(table)
    .select('public_plan_id, created_at')
    .in('public_plan_id', planIds);

  if (since) {
    query = query.gte('created_at', since);
  }

  const { data, error } = await query;
  if (error) {
    return [];
  }

  return (data ?? []) as ActivityRow[];
}

export async function fetchPlanActivityMetricsMap(
  plans: PublicPlan[],
  timeFilter: DiscoverTimeFilter,
): Promise<Map<string, PlanActivityMetrics>> {
  assertActivityConfigured();

  const map = new Map<string, PlanActivityMetrics>();
  if (plans.length === 0) return map;

  const since = getTimeFilterSince(timeFilter);
  if (!since) {
    for (const plan of plans) {
      map.set(plan.id, metricsFromPlanTotals(plan));
    }
    return map;
  }

  const planIds = plans.map((plan) => plan.id);
  const [likes, saves, copies, comments] = await Promise.all([
    fetchTableActivity('public_plan_likes', planIds, since),
    fetchTableActivity('public_plan_saves', planIds, since),
    fetchTableActivity('public_plan_copies', planIds, since),
    fetchTableActivity('public_plan_comments', planIds, since),
  ]);

  const likeMap = aggregateRows(likes);
  const saveMap = aggregateRows(saves);
  const copyMap = aggregateRows(copies);
  const commentMap = aggregateRows(comments);

  for (const planId of planIds) {
    const metrics: PlanActivityMetrics = {
      likes: likeMap.get(planId)?.count ?? 0,
      saves: saveMap.get(planId)?.count ?? 0,
      copies: copyMap.get(planId)?.count ?? 0,
      comments: commentMap.get(planId)?.count ?? 0,
      lastActivityAt: null,
    };

    metrics.lastActivityAt = mergeLastActivity(
      metrics.lastActivityAt,
      likeMap.get(planId)?.lastAt ?? null,
    );
    metrics.lastActivityAt = mergeLastActivity(
      metrics.lastActivityAt,
      saveMap.get(planId)?.lastAt ?? null,
    );
    metrics.lastActivityAt = mergeLastActivity(
      metrics.lastActivityAt,
      copyMap.get(planId)?.lastAt ?? null,
    );
    metrics.lastActivityAt = mergeLastActivity(
      metrics.lastActivityAt,
      commentMap.get(planId)?.lastAt ?? null,
    );

    map.set(planId, metrics);
  }

  return map;
}

export async function recordPublicPlanCopy(
  publicPlanId: string,
  copiedTripId: string,
): Promise<void> {
  assertActivityConfigured();

  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  await supabase.from('public_plan_copies').insert({
    user_id: user.id,
    public_plan_id: publicPlanId,
    copied_trip_id: copiedTripId,
  });

  const { notifyPlanCopied } = await import('@/lib/notifications');
  void notifyPlanCopied(publicPlanId, user.id);
}
