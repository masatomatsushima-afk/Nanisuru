import { buildFavoriteTitle } from '@/lib/favorites-storage';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import type { CreateSavedTripInput, SavedTrip, SavedTripPayload } from '@/types/trip';

type TripRow = {
  id: string;
  user_id: string;
  title: string;
  payload: SavedTripPayload;
  created_at: string;
};

function assertTripsConfigured(): void {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'プラン保存には Supabase の設定が必要です。\n.env に EXPO_PUBLIC_SUPABASE_URL と EXPO_PUBLIC_SUPABASE_ANON_KEY を設定し、trips テーブルを作成してください。',
    );
  }
}

function rowToSavedTrip(row: TripRow): SavedTrip {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    payload: row.payload,
    createdAt: row.created_at,
  };
}

export async function saveTrip(input: CreateSavedTripInput): Promise<SavedTrip> {
  assertTripsConfigured();

  const supabase = getSupabase();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('ログインが必要です');
  }

  const title = buildFavoriteTitle(
    input.location,
    input.personality,
    input.companion,
    input.tripDuration,
  );

  const { data, error } = await supabase
    .from('trips')
    .insert({
      user_id: user.id,
      title,
      payload: input,
    })
    .select('id, user_id, title, payload, created_at')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'プランの保存に失敗しました');
  }

  return rowToSavedTrip(data as TripRow);
}

export async function getTripById(tripId: string): Promise<SavedTrip | null> {
  assertTripsConfigured();

  if (!tripId.trim()) return null;

  const supabase = getSupabase();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('ログインが必要です');
  }

  const { data, error } = await supabase
    .from('trips')
    .select('id, user_id, title, payload, created_at')
    .eq('id', tripId)
    .eq('user_id', user.id)
    .single();

  if (error || !data) {
    return null;
  }

  return rowToSavedTrip(data as TripRow);
}

export function formatTripSchedule(trip: SavedTrip): string {
  const { payload, createdAt } = trip;
  const parts: string[] = [];

  if (payload.details.tripDate) {
    parts.push(formatTripDateLabel(payload.details.tripDate));
  }

  parts.push(payload.tripDuration);

  if (payload.details.duration) {
    parts.push(payload.details.duration);
  }

  parts.push(`保存日: ${formatSavedTripDate(createdAt)}`);

  return parts.filter(Boolean).join(' ／ ');
}

function formatTripDateLabel(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
}

export async function getUserTrips(): Promise<SavedTrip[]> {
  assertTripsConfigured();

  const supabase = getSupabase();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('ログインが必要です');
  }

  const { data, error } = await supabase
    .from('trips')
    .select('id, user_id, title, payload, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data as TripRow[]).map(rowToSavedTrip);
}

export async function updateTrip(
  tripId: string,
  input: SavedTripPayload,
  title?: string,
): Promise<SavedTrip> {
  assertTripsConfigured();

  const supabase = getSupabase();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('ログインが必要です');
  }

  const resolvedTitle =
    title ??
    buildFavoriteTitle(
      input.location,
      input.personality,
      input.companion,
      input.tripDuration,
    );

  const { data, error } = await supabase
    .from('trips')
    .update({
      title: resolvedTitle,
      payload: input,
    })
    .eq('id', tripId)
    .eq('user_id', user.id)
    .select('id, user_id, title, payload, created_at')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'プランの更新に失敗しました');
  }

  return rowToSavedTrip(data as TripRow);
}

export async function deleteTrip(tripId: string): Promise<void> {
  assertTripsConfigured();

  const supabase = getSupabase();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('ログインが必要です');
  }

  const { error } = await supabase.from('trips').delete().eq('id', tripId).eq('user_id', user.id);

  if (error) {
    throw new Error(error.message);
  }
}

export function formatSavedTripDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function savedTripToPlanParams(trip: SavedTrip) {
  const { payload } = trip;
  return {
    location: payload.location,
    budget: payload.budget,
    currency: payload.currency,
    people: payload.people,
    mood: payload.mood,
    companion: payload.companion,
    personality: payload.personality,
    tripDuration: payload.tripDuration,
    days: JSON.stringify(payload.days),
    items: JSON.stringify(payload.items),
    details: JSON.stringify(payload.details),
  };
}
