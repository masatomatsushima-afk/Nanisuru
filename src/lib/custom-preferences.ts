import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  createTravelMemory,
  getTravelMemories,
  updateTravelMemory,
} from '@/lib/travel-memory';
import { isSupabaseConfigured } from '@/lib/supabase';
import type { PlanCustomPreferences } from '@/types/plan-preferences';
import type { CreateTravelMemoryInput, TravelMemoryCategory } from '@/types/travel-memory';

const COUNT_STORAGE_KEY = 'nanisuru_custom_pref_phrase_counts';
const MEMORY_THRESHOLD = 2;

type PhraseCounts = Record<string, number>;

type MemoryRule = {
  pattern: RegExp;
  category: TravelMemoryCategory;
  content: (phrase: string) => string;
};

const MEMORY_RULES: MemoryRule[] = [
  { pattern: /焼肉|焼き肉|yakiniku/i, category: 'food', content: () => '焼肉が好き' },
  {
    pattern: /ラーメン|うどん|そば|寿司|グルメ|食事|レストラン|カフェ|coffee|喫茶|スイーツ/i,
    category: 'food',
    content: (phrase) => `${phrase}が好き`,
  },
  {
    pattern: /古着|ヴィンテージ|セレクトショップ|ファッション/i,
    category: 'activities',
    content: (phrase) => `${phrase}に興味がある`,
  },
  {
    pattern: /海|ビーチ|オーシャン|海岸/i,
    category: 'activities',
    content: () => '海が見える場所・海辺が好き',
  },
  {
    pattern: /美術館|博物館|ギャラリー|アート/i,
    category: 'activities',
    content: () => '美術館・文化施設が好き',
  },
  {
    pattern: /静か|落ち着|ゆっくり|のんびり/i,
    category: 'travel_style',
    content: () => '静かな場所・ゆっくりしたペースが好き',
  },
  {
    pattern: /人混み|混雑|込み|行列|観光地の喧騒/i,
    category: 'travel_style',
    content: () => '人混みが苦手',
  },
  {
    pattern: /歩き|徒歩|移動/i,
    category: 'travel_style',
    content: (phrase) => phrase,
  },
  {
    pattern: /高い|高級|予算|コスパ|高そう/i,
    category: 'budget',
    content: (phrase) => phrase,
  },
];

export function parseCommaList(value?: string): string[] {
  if (!value?.trim()) return [];
  return value
    .split(/[,、，\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function formatCombinedMood(selectedMood: string, customMood?: string): string {
  const chip = selectedMood.trim();
  const custom = customMood?.trim() ?? '';

  if (chip && custom) {
    return `${chip}（自由入力: ${custom}）`;
  }
  if (custom) return custom;
  if (chip) return chip;
  return '';
}

export function hasCustomPreferences(prefs?: PlanCustomPreferences): boolean {
  if (!prefs) return false;
  return Boolean(
    prefs.customMood?.trim() ||
      prefs.customTravelIntent?.trim() ||
      parseCommaList(prefs.desiredPlaces).length > 0 ||
      parseCommaList(prefs.avoidPreferences).length > 0,
  );
}

export function buildCustomPreferencesPromptSection(
  prefs?: PlanCustomPreferences,
  selectedMood?: string,
): string {
  if (!hasCustomPreferences(prefs)) return '';

  const customMood = prefs?.customMood?.trim() ?? '';
  const customTravelIntent = prefs?.customTravelIntent?.trim() ?? '';
  const desired = parseCommaList(prefs?.desiredPlaces);
  const avoid = parseCommaList(prefs?.avoidPreferences);
  const lines: string[] = [];

  if (customTravelIntent) {
    lines.push(`- **自由入力の旅行目的（最優先）**: ${customTravelIntent}`);
    if (selectedMood?.trim()) {
      lines.push(`- 選択した旅行目的: ${selectedMood.trim()}`);
    }
  } else if (customMood) {
    lines.push(`- **自由入力の気分（最優先）**: ${customMood}`);
    if (selectedMood?.trim()) {
      lines.push(
        `- 選択した気分: ${selectedMood.trim()} — 自由入力と**両立**させる（例: 「癒されたい」+「焼肉に行きたい」→ 落ち着ける焼肉店でリラックスできるプラン）`,
      );
    }
  } else if (selectedMood?.trim()) {
    lines.push(`- 選択した気分: ${selectedMood.trim()}`);
  }

  if (desired.length > 0) {
    lines.push(`- **行きたい場所・キーワード（最優先で組み込む）**: ${desired.join('、')}`);
    lines.push(
      '  → 実在スポットリストに該当があれば必ず優先。なければ近いジャンル・雰囲気・エリアで代替。',
    );
  }

  if (avoid.length > 0) {
    lines.push(`- **避けたいこと（厳守）**: ${avoid.join('、')}`);
    lines.push('  → 移動量・予算・混雑・雰囲気など、該当要素をプランから排除または最小化。');
  }

  return `

## ユーザーからの自由入力（★最優先 — ボタン・旅行タイプより優先★）
以下はユーザーが自分の言葉で入力した希望です。**矛盾する場合は自由入力を優先**し、可能な限り両立するプランを設計してください。

${lines.join('\n')}

- conciergeAnalysis.userPreferences と overallStrategy に、自由入力をどう反映したか明記すること
- plannerMessage で自由入力への共感を示すこと
- 行きたい場所のキーワードは highlights か timeline に必ず反映すること`;
}

function inferMemoriesFromPhrase(phrase: string): CreateTravelMemoryInput[] {
  const memories: CreateTravelMemoryInput[] = [];
  const seen = new Set<string>();

  for (const rule of MEMORY_RULES) {
    if (!rule.pattern.test(phrase)) continue;
    const content = rule.content(phrase);
    const key = `${rule.category}:${content}`;
    if (seen.has(key)) continue;
    seen.add(key);
    memories.push({ category: rule.category, content });
  }

  if (
    memories.length === 0 &&
    /苦手|嫌|避け|したくない|無理|不要|いや/i.test(phrase)
  ) {
    memories.push({
      category: 'travel_style',
      content: phrase.length > 24 ? phrase.slice(0, 24) : phrase,
    });
  }

  if (memories.length === 0 && phrase.length >= 2) {
    memories.push({
      category: 'activities',
      content: `${phrase}に興味がある`,
    });
  }

  return memories;
}

async function readPhraseCounts(): Promise<PhraseCounts> {
  const raw = await AsyncStorage.getItem(COUNT_STORAGE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as PhraseCounts;
  } catch {
    return {};
  }
}

async function writePhraseCounts(counts: PhraseCounts): Promise<void> {
  await AsyncStorage.setItem(COUNT_STORAGE_KEY, JSON.stringify(counts));
}

function isSimilarMemory(existing: string, incoming: string): boolean {
  const normalize = (value: string) => value.replace(/\s+/g, '').toLowerCase();
  const a = normalize(existing);
  const b = normalize(incoming);
  if (a === b) return true;
  return a.includes(b.slice(0, 6)) || b.includes(a.slice(0, 6));
}

async function ensureTravelMemory(input: CreateTravelMemoryInput): Promise<void> {
  if (!isSupabaseConfigured()) return;

  try {
    const existing = await getTravelMemories();
    const match = existing.find(
      (memory) =>
        memory.category === input.category &&
        isSimilarMemory(memory.content, input.content),
    );

    if (match) {
      await updateTravelMemory(match.id, { content: input.content });
      return;
    }

    await createTravelMemory(input);
  } catch {
    // Best-effort when logged out or Supabase unavailable
  }
}

async function trackPhrase(phrase: string): Promise<void> {
  const normalized = phrase.trim();
  if (normalized.length < 2) return;

  const counts = await readPhraseCounts();
  const nextCount = (counts[normalized] ?? 0) + 1;
  counts[normalized] = nextCount;
  await writePhraseCounts(counts);

  if (nextCount < MEMORY_THRESHOLD) return;

  const memories = inferMemoriesFromPhrase(normalized);
  for (const memory of memories) {
    await ensureTravelMemory(memory);
  }
}

export async function learnFromCustomPreferences(
  prefs?: PlanCustomPreferences,
): Promise<void> {
  if (!prefs) return;

  const phrases = [
    prefs.customMood?.trim(),
    prefs.customTravelIntent?.trim(),
    ...parseCommaList(prefs.desiredPlaces),
    ...parseCommaList(prefs.avoidPreferences),
  ].filter(Boolean) as string[];

  for (const phrase of phrases) {
    await trackPhrase(phrase);
  }
}
