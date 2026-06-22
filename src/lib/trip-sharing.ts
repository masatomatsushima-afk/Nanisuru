import * as Linking from 'expo-linking';

import { buildFavoriteTitle } from '@/lib/favorites-storage';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import type { CreateSharedTripInput, SharedTrip, SharedTripPayload } from '@/types/share';

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

export function buildShareUrl(shareId: string): string {
  const appUrl = process.env.EXPO_PUBLIC_APP_URL?.trim();
  if (appUrl && !appUrl.includes('your-app-url')) {
    return `${appUrl.replace(/\/$/, '')}/share/${shareId}`;
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

  const title = buildFavoriteTitle(
    input.location,
    input.personality,
    input.companion,
    input.tripDuration,
  );

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('shared_trips')
    .insert({
      title,
      payload: input,
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
