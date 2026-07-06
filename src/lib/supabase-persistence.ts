/**
 * Unified Supabase persistence facade.
 *
 * Wraps existing lib modules with safe fallbacks — never crashes when Supabase
 * is missing or tables are not created. App continues using local/mock data.
 *
 * Table map: see supabase/AUDIT.md and supabase/migrations/README.md
 */
import { saveItineraryEdit as saveItineraryEditRaw } from '@/lib/itinerary-edits';
import { fetchLocalHiddenSpots, submitLocalHiddenSpot } from '@/lib/local-hidden-spots';
import {
  getUserTrips,
  saveOrUpdateTrip,
  saveTrip,
} from '@/lib/saved-trips';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  createOrAttachTripFolder,
  getTripFolderById,
  linkTripFolderToSavedTrip,
  saveTripAssistantMessage as saveTripAssistantMessageRaw,
  updateTripFolderPlanPayload,
} from '@/lib/trip-folders';
import { fetchUserTripMemories, ensureTripMemoryForSavedTrip } from '@/lib/trip-memories';
import {
  getTravelUserPreferences,
  saveTravelUserPreferences,
} from '@/lib/travel-user-preferences';
import { saveWeatherReplan as saveWeatherReplanRaw } from '@/lib/weather-replans';
import type { ItineraryEditRecord } from '@/types/itinerary-edit';
import type { LocalHiddenSpot, SubmitLocalHiddenSpotInput } from '@/types/local-hidden-spot';
import type { CreateSavedTripInput, SavedTrip, SavedTripPayload } from '@/types/trip';
import type { TripAssistantMessage, TripFolder } from '@/types/trip-folder';
import type { TripMemory } from '@/types/trip-memory';
import {
  EMPTY_TRAVEL_USER_PREFERENCES,
  type TravelUserPreferences,
} from '@/types/travel-user-preferences';
import type { WeatherForecast } from '@/types/plan';
import type { WeatherReplanRecord } from '@/types/weather-replan';

const LOG_PREFIX = '[SupabasePersistence]';
const SETUP_PREFIX = '[SupabaseSetup]';

export type SupabaseTableProbeResult = 'ok' | 'missing' | 'skipped';

export type SupabaseSetupReport = {
  configured: boolean;
  saved_travel_plans: SupabaseTableProbeResult;
  trip_folders: SupabaseTableProbeResult;
  trip_memories: SupabaseTableProbeResult;
  local_gems: SupabaseTableProbeResult;
  user_preferences: SupabaseTableProbeResult;
};

function warnMissing(action: string): void {
  console.warn(`${LOG_PREFIX} Supabase が未設定のため ${action} をスキップしました`);
}

function warnError(action: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`${LOG_PREFIX} ${action} に失敗しました`, message);
}

function isTableMissingError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('does not exist') ||
    lower.includes('relation') && lower.includes('not found') ||
    lower.includes('42p01') ||
    lower.includes('could not find the table')
  );
}

async function probeTable(table: string): Promise<SupabaseTableProbeResult> {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from(table).select('id').limit(1);
    if (!error) return 'ok';
    if (isTableMissingError(error.message)) return 'missing';
    // Auth/RLS errors mean the table exists but may be empty or restricted
    return 'ok';
  } catch {
    return 'missing';
  }
}

function logSetupLine(table: string, result: SupabaseTableProbeResult, note?: string): void {
  const suffix = note ? ` (${note})` : '';
  console.log(`${SETUP_PREFIX} ${table} ${result}${suffix}`);
}

/** Dev diagnostic: probe core tables and log status to console. */
export async function checkSupabaseSetup(): Promise<SupabaseSetupReport> {
  const report: SupabaseSetupReport = {
    configured: isSupabaseConfigured(),
    saved_travel_plans: 'skipped',
    trip_folders: 'skipped',
    trip_memories: 'skipped',
    local_gems: 'skipped',
    user_preferences: 'skipped',
  };

  if (!report.configured) {
    console.warn(`${SETUP_PREFIX} Supabase が未設定です。.env を確認してください。`);
    for (const key of [
      'saved_travel_plans',
      'trip_folders',
      'trip_memories',
      'local_gems',
      'user_preferences',
    ] as const) {
      logSetupLine(key, 'skipped');
    }
    return report;
  }

  const [trips, savedPlans, folders, memories, gems, hiddenSpots, prefs] = await Promise.all([
    probeTable('trips'),
    probeTable('saved_travel_plans'),
    probeTable('trip_folders'),
    probeTable('trip_memories'),
    probeTable('local_gems'),
    probeTable('local_hidden_spots'),
    probeTable('user_preferences'),
  ]);

  report.saved_travel_plans =
    trips === 'ok' || savedPlans === 'ok' ? 'ok' : 'missing';
  logSetupLine(
    'saved_travel_plans',
    report.saved_travel_plans,
    trips === 'ok' ? 'trips テーブル経由' : undefined,
  );

  report.trip_folders = folders;
  logSetupLine('trip_folders', folders);

  report.trip_memories = memories;
  logSetupLine('trip_memories', memories);

  report.local_gems = gems === 'ok' || hiddenSpots === 'ok' ? 'ok' : 'missing';
  logSetupLine(
    'local_gems',
    report.local_gems,
    hiddenSpots === 'ok' ? 'local_hidden_spots 経由' : undefined,
  );

  report.user_preferences = prefs;
  logSetupLine('user_preferences', prefs);

  return report;
}

/** Save travel plan to `trips` (app primary table). */
export async function saveTravelPlan(
  input: CreateSavedTripInput,
  tripId?: string | null,
): Promise<SavedTrip | null> {
  if (!isSupabaseConfigured()) {
    warnMissing('プラン保存');
    return null;
  }
  try {
    if (tripId?.trim()) {
      return await saveOrUpdateTrip(tripId, input);
    }
    return await saveTrip(input);
  } catch (error) {
    warnError('プラン保存', error);
    return null;
  }
}

/** Load user's saved travel plans from `trips`. */
export async function loadSavedTravelPlans(): Promise<SavedTrip[]> {
  if (!isSupabaseConfigured()) {
    warnMissing('保存プラン読み込み');
    return [];
  }
  try {
    return await getUserTrips();
  } catch (error) {
    warnError('保存プラン読み込み', error);
    return [];
  }
}

/** Find or create a trip folder for the given plan payload. */
export async function createOrGetTripFolder(options: {
  payload: SavedTripPayload;
  savedTripId?: string | null;
  title?: string;
}): Promise<TripFolder | null> {
  if (!isSupabaseConfigured()) {
    warnMissing('旅行フォルダ取得');
    return null;
  }
  try {
    const result = await createOrAttachTripFolder(options);
    return result.folder;
  } catch (error) {
    warnError('旅行フォルダ取得', error);
    return null;
  }
}

/** Attach a saved plan to a folder and sync plan payload. */
export async function addPlanToTripFolder(
  folderId: string,
  planId: string,
  planPayload?: SavedTripPayload,
): Promise<TripFolder | null> {
  if (!isSupabaseConfigured()) {
    warnMissing('フォルダへのプラン追加');
    return null;
  }
  try {
    let folder = await linkTripFolderToSavedTrip(folderId, planId);
    if (planPayload) {
      folder = (await updateTripFolderPlanPayload(folderId, planPayload)) ?? folder;
    }
    if (!folder) {
      folder = await getTripFolderById(folderId);
    }
    return folder;
  } catch (error) {
    warnError('フォルダへのプラン追加', error);
    return null;
  }
}

/** Save an assistant chat message in a trip folder. */
export async function saveTripAssistantMessage(
  folderId: string,
  role: TripAssistantMessage['role'],
  content: string,
): Promise<TripAssistantMessage | null> {
  if (!isSupabaseConfigured()) {
    warnMissing('秘書メッセージ保存');
    return null;
  }
  try {
    return await saveTripAssistantMessageRaw(folderId, role, content);
  } catch (error) {
    warnError('秘書メッセージ保存', error);
    return null;
  }
}

/** Record a partial itinerary edit. */
export async function saveItineraryEdit(input: {
  tripId?: string | null;
  planId?: string | null;
  folderId?: string | null;
  source?: string | null;
  dayIndex: number;
  itemId: string;
  itemIndex?: number;
  editRequest: string;
  reason?: string;
  beforeData: Record<string, unknown>;
  afterData: Record<string, unknown>;
}): Promise<ItineraryEditRecord | null> {
  if (!isSupabaseConfigured()) {
    warnMissing('行程編集履歴保存');
    return null;
  }
  try {
    return await saveItineraryEditRaw(input);
  } catch (error) {
    warnError('行程編集履歴保存', error);
    return null;
  }
}

/** Record a weather-based replan event. */
export async function saveWeatherReplan(input: {
  tripId?: string | null;
  planId?: string | null;
  beforePlan: SavedTripPayload;
  afterPlan: SavedTripPayload;
  weatherContext: WeatherForecast;
}): Promise<WeatherReplanRecord | null> {
  if (!isSupabaseConfigured()) {
    warnMissing('天気再調整履歴保存');
    return null;
  }
  try {
    return await saveWeatherReplanRaw(input);
  } catch (error) {
    warnError('天気再調整履歴保存', error);
    return null;
  }
}

/** Ensure trip memory album exists for a saved trip. */
export async function saveTripMemory(trip: SavedTrip): Promise<TripMemory | null> {
  if (!isSupabaseConfigured()) {
    warnMissing('思い出アルバム保存');
    return null;
  }
  try {
    return await ensureTripMemoryForSavedTrip(trip);
  } catch (error) {
    warnError('思い出アルバム保存', error);
    return null;
  }
}

/** Load user's trip memory albums. */
export async function loadTripMemories(): Promise<TripMemory[]> {
  if (!isSupabaseConfigured()) {
    warnMissing('思い出読み込み');
    return [];
  }
  try {
    return await fetchUserTripMemories();
  } catch (error) {
    warnError('思い出読み込み', error);
    return [];
  }
}

/** Submit a local hidden gem (uses `local_hidden_spots` table). */
export async function saveLocalGem(
  input: SubmitLocalHiddenSpotInput,
): Promise<LocalHiddenSpot | null> {
  if (!isSupabaseConfigured()) {
    warnMissing('穴場スポット保存');
    return null;
  }
  try {
    return await submitLocalHiddenSpot(input);
  } catch (error) {
    warnError('穴場スポット保存', error);
    return null;
  }
}

/** Load public local gems for discover/feed. */
export async function loadPublicLocalGems(options?: {
  area?: string;
  limit?: number;
}): Promise<LocalHiddenSpot[]> {
  if (!isSupabaseConfigured()) {
    warnMissing('公開穴場読み込み');
    return [];
  }
  try {
    return await fetchLocalHiddenSpots({
      area: options?.area,
      limit: options?.limit ?? 48,
    });
  } catch (error) {
    warnError('公開穴場読み込み', error);
    return [];
  }
}

/** Save user travel preferences (Supabase + AsyncStorage). */
export async function saveUserPreferences(
  input: Omit<TravelUserPreferences, 'updatedAt'>,
): Promise<TravelUserPreferences> {
  try {
    return await saveTravelUserPreferences(input);
  } catch (error) {
    warnError('好み設定保存', error);
    return {
      ...input,
      updatedAt: new Date().toISOString(),
    };
  }
}

/** Load user travel preferences (Supabase with AsyncStorage fallback). */
export async function loadUserPreferences(): Promise<TravelUserPreferences> {
  try {
    return await getTravelUserPreferences();
  } catch (error) {
    warnError('好み設定読み込み', error);
    return EMPTY_TRAVEL_USER_PREFERENCES;
  }
}
