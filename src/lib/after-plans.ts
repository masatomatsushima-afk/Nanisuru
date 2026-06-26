import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import type { AfterPlanInput, AfterPlanOption, AfterPlanRecord } from '@/types/after-plan';

type AfterPlanRow = {
  id: string;
  user_id: string;
  base_trip_id: string | null;
  current_location: string;
  mood: string;
  people_count: string;
  companion_type: string;
  budget: string;
  selected_option: AfterPlanOption;
  input_payload: AfterPlanInput;
  is_public: boolean;
  public_title: string;
  created_at: string;
};

function rowToRecord(row: AfterPlanRow): AfterPlanRecord {
  return {
    id: row.id,
    userId: row.user_id,
    baseTripId: row.base_trip_id,
    currentLocation: row.current_location,
    mood: row.mood,
    peopleCount: row.people_count,
    companionType: row.companion_type,
    budget: row.budget,
    selectedOption: row.selected_option,
    inputPayload: row.input_payload,
    isPublic: row.is_public,
    publicTitle: row.public_title,
    createdAt: row.created_at,
  };
}

export function isAfterPlansConfigured(): boolean {
  return isSupabaseConfigured();
}

export async function saveAfterPlan(input: {
  baseTripId?: string | null;
  currentLocation: string;
  mood: string;
  peopleCount: string;
  companionType: string;
  budget: string;
  selectedOption: AfterPlanOption;
  inputPayload: AfterPlanInput;
  isPublic?: boolean;
  publicTitle?: string;
}): Promise<AfterPlanRecord | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('after_plans')
    .insert({
      user_id: user.id,
      base_trip_id: input.baseTripId ?? null,
      current_location: input.currentLocation.trim(),
      mood: input.mood,
      people_count: input.peopleCount,
      companion_type: input.companionType,
      budget: input.budget,
      selected_option: input.selectedOption,
      input_payload: input.inputPayload,
      is_public: input.isPublic ?? false,
      public_title: input.publicTitle?.trim() ?? '',
    })
    .select(
      'id, user_id, base_trip_id, current_location, mood, people_count, companion_type, budget, selected_option, input_payload, is_public, public_title, created_at',
    )
    .single();

  if (error || !data) return null;
  return rowToRecord(data as AfterPlanRow);
}

export async function publishAfterPlan(
  afterPlanId: string,
  publicTitle: string,
): Promise<AfterPlanRecord | null> {
  if (!isSupabaseConfigured() || !afterPlanId.trim()) return null;

  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('after_plans')
    .update({
      is_public: true,
      public_title: publicTitle.trim(),
    })
    .eq('id', afterPlanId)
    .eq('user_id', user.id)
    .select(
      'id, user_id, base_trip_id, current_location, mood, people_count, companion_type, budget, selected_option, input_payload, is_public, public_title, created_at',
    )
    .single();

  if (error || !data) return null;
  return rowToRecord(data as AfterPlanRow);
}

export async function fetchPublicAfterPlans(limit = 20): Promise<AfterPlanRecord[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('after_plans')
    .select(
      'id, user_id, base_trip_id, current_location, mood, people_count, companion_type, budget, selected_option, input_payload, is_public, public_title, created_at',
    )
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return (data as AfterPlanRow[]).map(rowToRecord);
}

export async function fetchUserAfterPlans(): Promise<AfterPlanRecord[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('after_plans')
    .select(
      'id, user_id, base_trip_id, current_location, mood, people_count, companion_type, budget, selected_option, input_payload, is_public, public_title, created_at',
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error || !data) return [];
  return (data as AfterPlanRow[]).map(rowToRecord);
}
