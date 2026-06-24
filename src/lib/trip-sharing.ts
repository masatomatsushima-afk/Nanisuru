import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import { buildFavoriteTitle } from '@/lib/favorites-storage';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import type { CreateSharedTripInput, SharedTrip, SharedTripPayload } from '@/types/share';
import type { PlanDetails } from '@/types/plan';

type SharedTripRow = {
  id: string;
  title: string;
  payload: SharedTripPayload;
  created_at: string;
};

function assertSharingConfigured(): void {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'リンク共有には Supabase の設定が必要です。\n.env に EXPO_PUBLIC_SUPABASE_URL と EXPO_PUBLIC_SUPABASE_ANON_KEY を設定し、shared_trips テーブルを作成してください。',
    );
  }
}

/** Strip fields that should not appear on public share pages. */
export function sanitizePlanDetailsForShare(details: PlanDetails): PlanDetails {
  return {
    totalBudget: details.totalBudget,
    budgetBreakdown: details.budgetBreakdown,
    duration: details.duration,
    tripDuration: details.tripDuration,
    weather: details.weather,
    plannerMessage: details.plannerMessage,
    conciergeAnalysis: details.conciergeAnalysis,
    highlights: details.highlights ?? [],
    rainyDayAlternatives: details.rainyDayAlternatives ?? [],
    aiAdvice: details.aiAdvice,
    placesNotice: details.placesNotice,
    placesSource: details.placesSource,
  };
}

export function sanitizeSharedTripInput(input: CreateSharedTripInput): CreateSharedTripInput {
  return {
    location: input.location.trim(),
    budget: input.budget?.trim() || undefined,
    currency: input.currency,
    people: input.people?.trim() || undefined,
    mood: input.mood?.trim() || undefined,
    companion: input.companion,
    personality: input.personality,
    tripDuration: input.tripDuration,
    days: input.days,
    items: input.items,
    details: sanitizePlanDetailsForShare(input.details),
  };
}

export function buildShareUrl(shareId: string): string {
  const appUrl = process.env.EXPO_PUBLIC_APP_URL?.trim();
  if (appUrl && !appUrl.includes('your-app-url') && !appUrl.includes('your-domain')) {
    return `${appUrl.replace(/\/$/, '')}/share/${shareId}`;
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/share/${shareId}`;
  }

  return Linking.createURL(`share/${shareId}`);
}

function rowToSharedTrip(row: SharedTripRow): SharedTrip {
  return {
    id: row.id,
    title: row.title,
    payload: row.payload,
    createdAt: row.created_at,
  };
}

export async function createSharedTrip(input: CreateSharedTripInput): Promise<{
  id: string;
  url: string;
  title: string;
}> {
  assertSharingConfigured();

  const payload = sanitizeSharedTripInput(input);
  const title = buildFavoriteTitle(
    payload.location,
    payload.personality,
    payload.companion,
    payload.tripDuration,
  );

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('shared_trips')
    .insert({
      title,
      payload,
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message ?? '共有リンクの作成に失敗しました');
  }

  return {
    id: data.id,
    url: buildShareUrl(data.id),
    title,
  };
}

export async function getSharedTrip(shareId: string): Promise<SharedTrip | null> {
  if (!isSupabaseConfigured() || !shareId.trim()) {
    return null;
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('shared_trips')
    .select('id, title, payload, created_at')
    .eq('id', shareId)
    .single();

  if (error || !data) {
    return null;
  }

  return rowToSharedTrip(data as SharedTripRow);
}

export function buildShareMessage(title: string, url: string): string {
  return `Nanisuruの旅行プラン「${title}」をシェアします\n${url}`;
}
