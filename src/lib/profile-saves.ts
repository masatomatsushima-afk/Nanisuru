import { getLocalHiddenSpotById } from '@/lib/local-hidden-spots';
import { getPublicPlanById } from '@/lib/public-plans';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { fetchTripMemoryWithMedia } from '@/lib/trip-memories';
import type { ProfileSavedItem } from '@/types/profile-portfolio';

function assertConfigured(): void {
  if (!isSupabaseConfigured()) {
    throw new Error('保存一覧の取得には Supabase の設定が必要です');
  }
}

async function getCurrentUserId(): Promise<string | null> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function fetchUserSavedPortfolioItems(): Promise<ProfileSavedItem[]> {
  assertConfigured();
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('ログインが必要です');

  const supabase = getSupabase();
  const [planSaves, memorySaves, spotSaves] = await Promise.all([
    supabase
      .from('public_plan_saves')
      .select('public_plan_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('trip_memory_saves')
      .select('memory_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('local_hidden_spot_saves')
      .select('spot_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
  ]);

  const items: ProfileSavedItem[] = [];

  for (const row of planSaves.data ?? []) {
    const plan = await getPublicPlanById(row.public_plan_id as string);
    if (plan) {
      items.push({
        type: 'plan',
        plan,
        savedAt: row.created_at as string,
      });
    }
  }

  for (const row of memorySaves.data ?? []) {
    const memory = await fetchTripMemoryWithMedia(row.memory_id as string);
    if (memory && memory.visibility === 'public') {
      items.push({
        type: 'memory',
        memory,
        savedAt: row.created_at as string,
      });
    }
  }

  for (const row of spotSaves.data ?? []) {
    const spot = await getLocalHiddenSpotById(row.spot_id as string);
    if (spot) {
      items.push({
        type: 'spot',
        spot,
        savedAt: row.created_at as string,
      });
    }
  }

  return items.sort(
    (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime(),
  );
}
