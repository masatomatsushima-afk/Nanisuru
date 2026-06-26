import { buildFavoriteTitle } from '@/lib/favorites-storage';
import { generatePlanWithAi } from '@/lib/generate-plan';
import { flattenItineraryDays, getDurationDisplayLabel } from '@/lib/trip-duration';
import { recordPublicPlanCopy } from '@/lib/public-plan-activity';
import { getPublicPlanById } from '@/lib/public-plans';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { getTodayIsoDate } from '@/lib/weather';
import type { SavedTrip, SavedTripPayload } from '@/types/trip';

function assertTripsConfigured(): void {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'プラン保存には Supabase の設定が必要です。\n.env に EXPO_PUBLIC_SUPABASE_URL と EXPO_PUBLIC_SUPABASE_ANON_KEY を設定してください。',
    );
  }
}

function buildCopyTitle(sourceTitle: string): string {
  const trimmed = sourceTitle.trim();
  if (!trimmed) return 'カスタムプラン';
  return `${trimmed}（マイプラン）`;
}

export async function copyPublicPlanForEditing(publicPlanId: string): Promise<SavedTrip> {
  assertTripsConfigured();

  const plan = await getPublicPlanById(publicPlanId);
  if (!plan) {
    throw new Error('公開プランが見つかりません');
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
    ...plan.payload,
    copyMetadata: {
      inspiredByDisplayName: plan.creatorDisplayName,
      sourcePublicPlanId: plan.id,
      sourceCreatorUserId: plan.userId,
      sourcePublicPlanTitle: plan.title,
    },
    customPreferences: plan.payload.customPreferences ?? {},
    notes: plan.payload.notes ?? '',
  };

  const title = buildCopyTitle(plan.title);

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

  void recordPublicPlanCopy(publicPlanId, data.id as string);

  return {
    id: data.id as string,
    userId: data.user_id as string,
    title: data.title as string,
    payload: data.payload as SavedTripPayload,
    createdAt: data.created_at as string,
  };
}

export async function adjustCopiedPlanWithAi(
  payload: SavedTripPayload,
  instruction: string,
): Promise<SavedTripPayload> {
  const tripDate = payload.details.tripDate ?? getTodayIsoDate();
  const tripEndDate = payload.details.tripEndDate;
  const generated = await generatePlanWithAi({
    location: payload.location,
    budget: payload.budget,
    currency: payload.currency,
    people: payload.people,
    companion: payload.companion,
    personality: payload.personality,
    tripDuration: payload.tripDuration,
    tripDate,
    tripEndDate,
    customDuration: payload.customDuration,
    mood: payload.mood,
    customPreferences: payload.customPreferences,
    planAdjustment: {
      instruction: instruction.trim(),
      baseDays: payload.days,
      baseDetails: payload.details,
      notes: payload.notes,
    },
  });

  return {
    ...payload,
    days: generated.days,
    items: flattenItineraryDays(generated.days),
    details: {
      ...payload.details,
      ...generated.details,
      tripDate,
      tripEndDate: generated.details.tripEndDate ?? tripEndDate,
      tripDuration: payload.tripDuration,
      customDuration: payload.customDuration,
    },
    customDuration: payload.customDuration,
  };
}

export function buildPayloadFromTrip(trip: SavedTrip): SavedTripPayload {
  return {
    ...trip.payload,
    items: flattenItineraryDays(trip.payload.days),
  };
}

export function buildUpdatedTripTitle(payload: SavedTripPayload): string {
  return buildFavoriteTitle(
    payload.location,
    payload.personality,
    payload.companion,
    getDurationDisplayLabel(payload.tripDuration, payload.customDuration),
  );
}
