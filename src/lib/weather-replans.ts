import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import type { WeatherForecast } from '@/types/plan';
import type { SavedTripPayload } from '@/types/trip';
import type { WeatherReplanRecord } from '@/types/weather-replan';

type WeatherReplanRow = {
  id: string;
  user_id: string;
  trip_id: string | null;
  plan_id: string | null;
  before_plan: SavedTripPayload;
  after_plan: SavedTripPayload;
  weather_context: WeatherForecast;
  created_at: string;
};

function rowToRecord(row: WeatherReplanRow): WeatherReplanRecord {
  return {
    id: row.id,
    userId: row.user_id,
    tripId: row.trip_id,
    planId: row.plan_id,
    beforePlan: row.before_plan,
    afterPlan: row.after_plan,
    weatherContext: row.weather_context,
    createdAt: row.created_at,
  };
}

export function isWeatherReplansConfigured(): boolean {
  return isSupabaseConfigured();
}

export async function saveWeatherReplan(input: {
  tripId?: string | null;
  planId?: string | null;
  beforePlan: SavedTripPayload;
  afterPlan: SavedTripPayload;
  weatherContext: WeatherForecast;
}): Promise<WeatherReplanRecord | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('weather_replans')
    .insert({
      user_id: user.id,
      trip_id: input.tripId ?? null,
      plan_id: input.planId ?? null,
      before_plan: input.beforePlan,
      after_plan: input.afterPlan,
      weather_context: input.weatherContext,
    })
    .select('id, user_id, trip_id, plan_id, before_plan, after_plan, weather_context, created_at')
    .single();

  if (error || !data) return null;
  return rowToRecord(data as WeatherReplanRow);
}
