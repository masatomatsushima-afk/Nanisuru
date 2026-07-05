import AsyncStorage from '@react-native-async-storage/async-storage';

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  EMPTY_TRAVEL_USER_PREFERENCES,
  type TravelUserPreferences,
} from '@/types/travel-user-preferences';

const STORAGE_KEY = 'nanisuru_travel_user_preferences';

type UserPreferencesRow = {
  favorite_categories: string[] | null;
  travel_pace: string | null;
  walking_tolerance: string | null;
  budget_style: string | null;
  avoid_things: string[] | null;
  companion_types: string[] | null;
  free_text_preference: string | null;
  updated_at: string;
};

function rowToPreferences(row: UserPreferencesRow): TravelUserPreferences {
  return {
    favoriteCategories: row.favorite_categories ?? [],
    travelPace: row.travel_pace,
    walkingTolerance: row.walking_tolerance,
    budgetStyle: row.budget_style,
    avoidThings: row.avoid_things ?? [],
    companionTypes: row.companion_types ?? [],
    freeTextPreference: row.free_text_preference ?? '',
    updatedAt: row.updated_at,
  };
}

function preferencesToRow(prefs: TravelUserPreferences) {
  return {
    favorite_categories: prefs.favoriteCategories,
    travel_pace: prefs.travelPace,
    walking_tolerance: prefs.walkingTolerance,
    budget_style: prefs.budgetStyle,
    avoid_things: prefs.avoidThings,
    companion_types: prefs.companionTypes,
    free_text_preference: prefs.freeTextPreference.trim(),
    updated_at: prefs.updatedAt,
  };
}

async function loadFromAsyncStorage(): Promise<TravelUserPreferences | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TravelUserPreferences;
  } catch {
    return null;
  }
}

async function saveToAsyncStorage(prefs: TravelUserPreferences): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

async function loadFromSupabase(userId: string): Promise<TravelUserPreferences | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('user_preferences')
    .select(
      'favorite_categories, travel_pace, walking_tolerance, budget_style, avoid_things, companion_types, free_text_preference, updated_at',
    )
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.warn('[Preferences] Supabase load failed, using local fallback', error.message);
    return null;
  }

  if (!data) return null;
  return rowToPreferences(data as UserPreferencesRow);
}

async function saveToSupabase(userId: string, prefs: TravelUserPreferences): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const supabase = getSupabase();
  const row = {
    user_id: userId,
    ...preferencesToRow(prefs),
  };

  const { error } = await supabase.from('user_preferences').upsert(row, { onConflict: 'user_id' });
  if (error) {
    console.warn('[Preferences] Supabase save failed, local only', error.message);
  }
}

export async function getTravelUserPreferences(): Promise<TravelUserPreferences> {
  let prefs: TravelUserPreferences | null = null;

  if (isSupabaseConfigured()) {
    const supabase = getSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      prefs = await loadFromSupabase(user.id);
    }
  }

  if (!prefs) {
    prefs = await loadFromAsyncStorage();
  }

  const resolved = prefs ?? EMPTY_TRAVEL_USER_PREFERENCES;
  console.log('[Preferences] loaded', resolved);
  return resolved;
}

export async function saveTravelUserPreferences(
  input: Omit<TravelUserPreferences, 'updatedAt'>,
): Promise<TravelUserPreferences> {
  const prefs: TravelUserPreferences = {
    ...input,
    updatedAt: new Date().toISOString(),
  };

  await saveToAsyncStorage(prefs);

  if (isSupabaseConfigured()) {
    const supabase = getSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await saveToSupabase(user.id, prefs);
    }
  }

  console.log('[Preferences] saved', prefs);
  return prefs;
}
