import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  createTripFolderInputFromPayload,
  createTripFolderInputFromSavedTrip,
} from '@/lib/trip-folder-context';
import { getDurationDisplayLabel } from '@/lib/trip-duration';
import type { SavedTrip, SavedTripPayload } from '@/types/trip';
import type {
  CreateTripFolderInput,
  TripAssistantMessage,
  TripFolder,
  TripFolderContextNotes,
} from '@/types/trip-folder';

const SELECT_FOLDER =
  'id, user_id, title, destination, departure_date, return_date, duration_label, companion_type, budget, currency, saved_trip_id, plan_payload, context_notes, created_at, updated_at';

type FolderRow = {
  id: string;
  user_id: string;
  title: string;
  destination: string;
  departure_date: string;
  return_date: string;
  duration_label: string;
  companion_type: string;
  budget: string;
  currency: string;
  saved_trip_id: string | null;
  plan_payload: SavedTripPayload | null;
  context_notes: TripFolderContextNotes | null;
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  trip_folder_id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
};

function assertConfigured(): void {
  if (!isSupabaseConfigured()) {
    throw new Error(
      '旅行秘書フォルダには Supabase の設定が必要です。\ntrip_folders.sql を実行してください。',
    );
  }
}

function rowToFolder(row: FolderRow): TripFolder {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    destination: row.destination,
    departureDate: row.departure_date,
    returnDate: row.return_date,
    durationLabel: row.duration_label,
    companionType: row.companion_type,
    budget: row.budget,
    currency: row.currency as TripFolder['currency'],
    savedTripId: row.saved_trip_id,
    planPayload: row.plan_payload,
    contextNotes: row.context_notes ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToMessage(row: MessageRow): TripAssistantMessage {
  return {
    id: row.id,
    tripFolderId: row.trip_folder_id,
    userId: row.user_id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
  };
}

async function getCurrentUserId(): Promise<string | null> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function fetchUserTripFolders(): Promise<TripFolder[]> {
  assertConfigured();
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('ログインが必要です');

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('trip_folders')
    .select(SELECT_FOLDER)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) throw new Error(error.message ?? '旅行フォルダの取得に失敗しました');
  return ((data ?? []) as FolderRow[]).map(rowToFolder);
}

export async function getTripFolderById(folderId: string): Promise<TripFolder | null> {
  assertConfigured();
  if (!folderId.trim()) return null;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('trip_folders')
    .select(SELECT_FOLDER)
    .eq('id', folderId)
    .maybeSingle();

  if (error || !data) return null;
  return rowToFolder(data as FolderRow);
}

export async function getTripFolderBySavedTripId(tripId: string): Promise<TripFolder | null> {
  assertConfigured();
  if (!tripId.trim()) return null;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('trip_folders')
    .select(SELECT_FOLDER)
    .eq('saved_trip_id', tripId)
    .maybeSingle();

  if (error || !data) return null;
  return rowToFolder(data as FolderRow);
}

export async function createTripFolder(input: CreateTripFolderInput): Promise<TripFolder> {
  assertConfigured();
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('ログインが必要です');

  const title = input.title.trim();
  const destination = input.destination.trim();
  if (!title) throw new Error('旅行名を入力してください');
  if (!destination) throw new Error('行き先を入力してください');

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('trip_folders')
    .insert({
      user_id: userId,
      title,
      destination,
      departure_date: input.departureDate?.trim() ?? '',
      return_date: input.returnDate?.trim() ?? '',
      duration_label: input.durationLabel?.trim() ?? '',
      companion_type: input.companionType,
      budget: input.budget?.trim() ?? '',
      currency: input.currency ?? 'JPY',
      saved_trip_id: input.savedTripId ?? null,
      plan_payload: input.planPayload ?? null,
      context_notes: input.contextNotes ?? {},
    })
    .select(SELECT_FOLDER)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? '旅行フォルダの作成に失敗しました');
  }

  return rowToFolder(data as FolderRow);
}

export async function createTripFolderFromSavedTrip(trip: SavedTrip): Promise<TripFolder> {
  const existing = await getTripFolderBySavedTripId(trip.id);
  if (existing) return existing;
  return createTripFolder(createTripFolderInputFromSavedTrip(trip));
}

export async function createTripFolderFromPayload(
  payload: SavedTripPayload,
  title?: string,
): Promise<TripFolder> {
  return createTripFolder(createTripFolderInputFromPayload(payload, title));
}

export async function fetchTripAssistantMessages(
  folderId: string,
): Promise<TripAssistantMessage[]> {
  assertConfigured();
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('trip_assistant_messages')
    .select('id, trip_folder_id, user_id, role, content, created_at')
    .eq('trip_folder_id', folderId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message ?? 'チャット履歴の取得に失敗しました');
  return ((data ?? []) as MessageRow[]).map(rowToMessage);
}

export async function saveTripAssistantMessage(
  folderId: string,
  role: TripAssistantMessage['role'],
  content: string,
): Promise<TripAssistantMessage> {
  assertConfigured();
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('ログインが必要です');

  const trimmed = content.trim();
  if (!trimmed) throw new Error('メッセージが空です');

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('trip_assistant_messages')
    .insert({
      trip_folder_id: folderId,
      user_id: userId,
      role,
      content: trimmed,
    })
    .select('id, trip_folder_id, user_id, role, content, created_at')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'メッセージの保存に失敗しました');
  }

  await supabase
    .from('trip_folders')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', folderId);

  return rowToMessage(data as MessageRow);
}

export async function updateTripFolderPlanPayload(
  folderId: string,
  planPayload: SavedTripPayload,
): Promise<TripFolder | null> {
  assertConfigured();
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('ログインが必要です');

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('trip_folders')
    .update({
      plan_payload: planPayload,
      updated_at: new Date().toISOString(),
    })
    .eq('id', folderId)
    .eq('user_id', userId)
    .select(SELECT_FOLDER)
    .single();

  if (error || !data) return null;
  return rowToFolder(data as FolderRow);
}

export function buildManualFolderDurationLabel(
  departureDate: string,
  returnDate: string,
): string {
  if (departureDate && returnDate) {
    const start = new Date(`${departureDate}T12:00:00`);
    const end = new Date(`${returnDate}T12:00:00`);
    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
    const nights = Math.max(0, days - 1);
    if (nights === 0) return '日帰り';
    return `${nights}泊${days}日`;
  }
  return '';
}

export { getDurationDisplayLabel };
