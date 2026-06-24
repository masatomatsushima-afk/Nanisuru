import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import type {
  CreateTravelMemoryInput,
  TravelMemory,
  TravelMemoryCategory,
  UpdateTravelMemoryInput,
} from '@/types/travel-memory';
import {
  getTravelMemoryCategoryLabel,
  TRAVEL_MEMORY_CATEGORIES,
} from '@/types/travel-memory';

type TravelMemoryRow = {
  id: string;
  user_id: string;
  category: TravelMemoryCategory;
  content: string;
  created_at: string;
  updated_at: string;
};

function assertTravelMemoryConfigured(): void {
  if (!isSupabaseConfigured()) {
    throw new Error(
      '旅行メモリーには Supabase の設定が必要です。\n.env を確認し、travel_memories テーブルを作成してください。',
    );
  }
}

function rowToTravelMemory(row: TravelMemoryRow): TravelMemory {
  return {
    id: row.id,
    userId: row.user_id,
    category: row.category,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function requireUserId(): Promise<string> {
  assertTravelMemoryConfigured();

  const supabase = getSupabase();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error('ログインが必要です');
  }

  return user.id;
}

export async function getTravelMemories(): Promise<TravelMemory[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = getSupabase();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return [];

  const { data, error } = await supabase
    .from('travel_memories')
    .select('id, user_id, category, content, created_at, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(error.message ?? '旅行メモリーの取得に失敗しました');
  }

  return (data as TravelMemoryRow[]).map(rowToTravelMemory);
}

export async function createTravelMemory(
  input: CreateTravelMemoryInput,
): Promise<TravelMemory> {
  const userId = await requireUserId();
  const content = input.content.trim();
  if (!content) {
    throw new Error('内容を入力してください');
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('travel_memories')
    .insert({
      user_id: userId,
      category: input.category,
      content,
      updated_at: new Date().toISOString(),
    })
    .select('id, user_id, category, content, created_at, updated_at')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? '旅行メモリーの追加に失敗しました');
  }

  return rowToTravelMemory(data as TravelMemoryRow);
}

export async function updateTravelMemory(
  memoryId: string,
  input: UpdateTravelMemoryInput,
): Promise<TravelMemory> {
  await requireUserId();

  const updates: Partial<TravelMemoryRow> = {
    updated_at: new Date().toISOString(),
  };

  if (input.category) updates.category = input.category;
  if (input.content != null) {
    const content = input.content.trim();
    if (!content) throw new Error('内容を入力してください');
    updates.content = content;
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('travel_memories')
    .update(updates)
    .eq('id', memoryId)
    .select('id, user_id, category, content, created_at, updated_at')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? '旅行メモリーの更新に失敗しました');
  }

  return rowToTravelMemory(data as TravelMemoryRow);
}

export async function deleteTravelMemory(memoryId: string): Promise<void> {
  await requireUserId();

  const supabase = getSupabase();
  const { error } = await supabase.from('travel_memories').delete().eq('id', memoryId);

  if (error) {
    throw new Error(error.message ?? '旅行メモリーの削除に失敗しました');
  }
}

export function buildTravelMemoryPromptSection(memories: TravelMemory[]): string {
  if (memories.length === 0) return '';

  const grouped = TRAVEL_MEMORY_CATEGORIES.map(({ value, label }) => {
    const items = memories.filter((memory) => memory.category === value);
    if (items.length === 0) return null;
    const lines = items.map((memory) => `- ${memory.content}`).join('\n');
    return `### ${label}\n${lines}`;
  }).filter(Boolean);

  return `

## 旅行メモリー（ユーザー登録・最優先で反映）
ユーザーがマイページで登録した旅行の好みです。**今回の入力条件と矛盾しない範囲で、必ずプランに反映**してください。

${grouped.join('\n\n')}

- 食の好み → レストラン・カフェ選定、食事の配分
- 旅行スタイル → スポットの選び方、1日のペース
- 予算感 → 費用配分、高級/リーズナブルのバランス
- 好きなアクティビティ → 類似ジャンルのスポットを積極的に提案
- 同行者の傾向 → 同行者向けの配慮（子供連れ、カップル等）
- plannerMessage で、旅行メモリーを理解していることが伝わる一言を添えること`;
}

export function summarizeTravelMemoriesForAnalysis(memories: TravelMemory[]): string {
  if (memories.length === 0) {
    return '旅行メモリー未登録。今回の入力条件と自動学習の好みを優先。';
  }

  return memories
    .map(
      (memory) =>
        `${getTravelMemoryCategoryLabel(memory.category)}: ${memory.content}`,
    )
    .join(' / ');
}
