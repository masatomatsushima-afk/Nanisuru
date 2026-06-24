import AsyncStorage from '@react-native-async-storage/async-storage';

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  SHARED_REACTION_TYPES,
  type SharedReactionCounts,
  type SharedReactionType,
} from '@/types/shared-reaction';

type ReactionRow = {
  reaction_type: string;
};

const REACTION_STORAGE_PREFIX = 'nanisuru_shared_reaction_';

function emptyCounts(): SharedReactionCounts {
  return {
    行きたい: 0,
    微妙: 0,
    ここ良い: 0,
    変更したい: 0,
    高そう: 0,
    楽しそう: 0,
  };
}

function isReactionType(value: string): value is SharedReactionType {
  return SHARED_REACTION_TYPES.includes(value as SharedReactionType);
}

function reactionStorageKey(sharedPlanId: string): string {
  return `${REACTION_STORAGE_PREFIX}${sharedPlanId}`;
}

export async function getLocalReactionTypes(sharedPlanId: string): Promise<SharedReactionType[]> {
  const raw = await AsyncStorage.getItem(reactionStorageKey(sharedPlanId));
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as string[];
    return parsed.filter(isReactionType);
  } catch {
    return [];
  }
}

async function markLocalReaction(sharedPlanId: string, reactionType: SharedReactionType): Promise<void> {
  const existing = await getLocalReactionTypes(sharedPlanId);
  if (existing.includes(reactionType)) return;

  await AsyncStorage.setItem(
    reactionStorageKey(sharedPlanId),
    JSON.stringify([...existing, reactionType]),
  );
}

export async function getSharedReactionCounts(
  sharedPlanId: string,
): Promise<SharedReactionCounts> {
  if (!isSupabaseConfigured() || !sharedPlanId.trim()) {
    return emptyCounts();
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('shared_trip_reactions')
    .select('reaction_type')
    .eq('shared_plan_id', sharedPlanId);

  if (error || !data) {
    return emptyCounts();
  }

  const counts = emptyCounts();
  for (const row of data as ReactionRow[]) {
    if (isReactionType(row.reaction_type)) {
      counts[row.reaction_type] += 1;
    }
  }

  return counts;
}

export async function addSharedReaction(
  sharedPlanId: string,
  reactionType: SharedReactionType,
): Promise<{ counts: SharedReactionCounts; alreadyReacted: boolean }> {
  if (!isSupabaseConfigured()) {
    throw new Error('リアクション機能には Supabase の設定が必要です');
  }

  const localTypes = await getLocalReactionTypes(sharedPlanId);
  if (localTypes.includes(reactionType)) {
    const counts = await getSharedReactionCounts(sharedPlanId);
    return { counts, alreadyReacted: true };
  }

  const supabase = getSupabase();
  const { error } = await supabase.from('shared_trip_reactions').insert({
    shared_plan_id: sharedPlanId,
    reaction_type: reactionType,
  });

  if (error) {
    throw new Error(error.message ?? 'リアクションの送信に失敗しました');
  }

  await markLocalReaction(sharedPlanId, reactionType);
  const counts = await getSharedReactionCounts(sharedPlanId);
  return { counts, alreadyReacted: false };
}
