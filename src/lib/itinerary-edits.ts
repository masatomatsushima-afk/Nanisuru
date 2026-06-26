import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import type { ItineraryEditRecord } from '@/types/itinerary-edit';

type EditRow = {
  id: string;
  user_id: string;
  trip_id: string | null;
  plan_id: string | null;
  day_index: number;
  item_id: string;
  edit_request: string;
  before_data: Record<string, unknown>;
  after_data: Record<string, unknown>;
  created_at: string;
};

function rowToRecord(row: EditRow): ItineraryEditRecord {
  return {
    id: row.id,
    userId: row.user_id,
    tripId: row.trip_id,
    planId: row.plan_id,
    dayIndex: row.day_index,
    itemId: row.item_id,
    editRequest: row.edit_request,
    beforeData: row.before_data ?? {},
    afterData: row.after_data ?? {},
    createdAt: row.created_at,
  };
}

export function isItineraryEditsConfigured(): boolean {
  return isSupabaseConfigured();
}

export async function saveItineraryEdit(input: {
  tripId?: string | null;
  planId?: string | null;
  dayIndex: number;
  itemId: string;
  editRequest: string;
  beforeData: Record<string, unknown>;
  afterData: Record<string, unknown>;
}): Promise<ItineraryEditRecord | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('itinerary_edits')
    .insert({
      user_id: user.id,
      trip_id: input.tripId ?? null,
      plan_id: input.planId ?? null,
      day_index: input.dayIndex,
      item_id: input.itemId,
      edit_request: input.editRequest.trim(),
      before_data: input.beforeData,
      after_data: input.afterData,
    })
    .select(
      'id, user_id, trip_id, plan_id, day_index, item_id, edit_request, before_data, after_data, created_at',
    )
    .single();

  if (error || !data) return null;
  return rowToRecord(data as EditRow);
}

export async function fetchItineraryEditsForTrip(tripId: string): Promise<ItineraryEditRecord[]> {
  if (!isSupabaseConfigured() || !tripId.trim()) return [];

  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('itinerary_edits')
    .select(
      'id, user_id, trip_id, plan_id, day_index, item_id, edit_request, before_data, after_data, created_at',
    )
    .eq('trip_id', tripId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error || !data) return [];
  return (data as EditRow[]).map(rowToRecord);
}
