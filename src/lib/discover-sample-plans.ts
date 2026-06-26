import { getDiscoverSamplePlanById } from '@/data/discover-sample-plans';
import { buildFavoriteTitle } from '@/lib/favorites-storage';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import type { SavedTrip, SavedTripPayload } from '@/types/trip';

function assertTripsConfigured(): void {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'プラン保存には Supabase の設定が必要です。\n.env に EXPO_PUBLIC_SUPABASE_URL と EXPO_PUBLIC_SUPABASE_ANON_KEY を設定してください。',
    );
  }
}

function buildSampleCopyTitle(sourceTitle: string): string {
  const trimmed = sourceTitle.trim();
  if (!trimmed) return 'カスタムプラン';
  return `${trimmed}（マイプラン）`;
}

/** Copy a local sample plan into the user's private trips — never writes to public_plans. */
export async function copyDiscoverSamplePlanForEditing(sampleId: string): Promise<SavedTrip> {
  assertTripsConfigured();

  const sample = getDiscoverSamplePlanById(sampleId);
  if (!sample) {
    throw new Error('サンプルプランが見つかりません');
  }

  const supabase = getSupabase();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('ログインが必要です');
  }

  const payload: SavedTripPayload = {
    ...sample.payload,
    copyMetadata: {
      inspiredByDisplayName: sample.creatorDisplayName,
      sourcePublicPlanId: `sample:${sample.id}`,
      sourceCreatorUserId: 'sample',
      sourcePublicPlanTitle: sample.title,
    },
    customPreferences: sample.payload.customPreferences ?? {},
    notes: sample.payload.notes ?? '',
  };

  const title =
    buildSampleCopyTitle(sample.title) ||
    buildFavoriteTitle(
      payload.location,
      payload.personality,
      payload.companion,
      payload.tripDuration,
    );

  const { data, error } = await supabase
    .from('trips')
    .insert({
      user_id: user.id,
      title,
      payload,
    })
    .select('id, user_id, title, payload, created_at')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'プランのコピーに失敗しました');
  }

  return {
    id: data.id as string,
    userId: data.user_id as string,
    title: data.title as string,
    payload: data.payload as SavedTripPayload,
    createdAt: data.created_at as string,
  };
}
