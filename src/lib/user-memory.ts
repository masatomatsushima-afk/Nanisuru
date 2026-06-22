import AsyncStorage from '@react-native-async-storage/async-storage';

import { formatAmount, type CurrencyCode } from '@/constants/currency';
import type { PersonalityOption, TripDurationOption } from '@/types/plan';
import { PERSONALITY_OPTIONS, TRIP_DURATION_OPTIONS } from '@/types/plan';
import type { StoredUserMemory, UserPreferences } from '@/types/user-memory';

const STORAGE_KEY = 'nanisuru_user_memory';
const MAX_BUDGET_SAMPLES = 12;
const MAX_ACTIVITY_ENTRIES = 30;
const TOP_ACTIVITIES_DISPLAY = 5;

function emptyMemory(): StoredUserMemory {
  return {
    travelStyleCounts: {},
    tripDurationCounts: {},
    budgetSamples: [],
    activityCounts: {},
    updatedAt: new Date().toISOString(),
  };
}

async function readMemory(): Promise<StoredUserMemory> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return emptyMemory();

  try {
    const parsed = JSON.parse(raw) as StoredUserMemory;
    return {
      travelStyleCounts: parsed.travelStyleCounts ?? {},
      tripDurationCounts: parsed.tripDurationCounts ?? {},
      budgetSamples: Array.isArray(parsed.budgetSamples) ? parsed.budgetSamples : [],
      activityCounts: parsed.activityCounts ?? {},
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    return emptyMemory();
  }
}

async function writeMemory(memory: StoredUserMemory): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
}

function getTopKey<T extends string>(counts: Partial<Record<T, number>>): T | null {
  let best: T | null = null;
  let bestCount = 0;

  for (const [key, count] of Object.entries(counts)) {
    if (typeof count !== 'number' || count <= bestCount) continue;
    bestCount = count;
    best = key as T;
  }

  return best;
}

function computeBudgetPreference(
  samples: Array<{ amount: number; currency: CurrencyCode }>,
): { label: string; amount: number; currency: CurrencyCode } | null {
  if (samples.length === 0) return null;

  const latestCurrency = samples[samples.length - 1].currency;
  const sameCurrency = samples.filter((sample) => sample.currency === latestCurrency);
  if (sameCurrency.length === 0) return null;

  const average = Math.round(
    sameCurrency.reduce((sum, sample) => sum + sample.amount, 0) / sameCurrency.length,
  );

  return {
    label: `約 ${formatAmount(average, latestCurrency)}`,
    amount: average,
    currency: latestCurrency,
  };
}

function getTopActivities(counts: Record<string, number>, limit = TOP_ACTIVITIES_DISPLAY): string[] {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name]) => name);
}

export async function getUserPreferences(): Promise<UserPreferences> {
  const memory = await readMemory();
  const favoriteTravelStyle = getTopKey<PersonalityOption>(memory.travelStyleCounts);
  const preferredTripDuration = getTopKey<TripDurationOption>(memory.tripDurationCounts);
  const budget = computeBudgetPreference(memory.budgetSamples);
  const favoriteActivities = getTopActivities(memory.activityCounts);

  const hasData = Boolean(
    favoriteTravelStyle ||
      preferredTripDuration ||
      budget ||
      favoriteActivities.length > 0,
  );

  return {
    favoriteTravelStyle,
    budgetPreference: budget?.label ?? null,
    favoriteActivities,
    preferredTripDuration,
    hasData,
  };
}

export async function getAverageBudgetAmount(): Promise<{
  amount: number;
  currency: CurrencyCode;
} | null> {
  const memory = await readMemory();
  const budget = computeBudgetPreference(memory.budgetSamples);
  if (!budget) return null;
  return { amount: budget.amount, currency: budget.currency };
}

export async function recordPlanPreferences(input: {
  personality: PersonalityOption;
  tripDuration: TripDurationOption;
  budget: string;
  currency: CurrencyCode;
  activities: string[];
}): Promise<void> {
  const memory = await readMemory();

  memory.travelStyleCounts[input.personality] =
    (memory.travelStyleCounts[input.personality] ?? 0) + 1;
  memory.tripDurationCounts[input.tripDuration] =
    (memory.tripDurationCounts[input.tripDuration] ?? 0) + 1;

  const amount = parseInt(input.budget.replace(/[^\d]/g, ''), 10);
  if (amount > 0) {
    memory.budgetSamples.push({ amount, currency: input.currency });
    if (memory.budgetSamples.length > MAX_BUDGET_SAMPLES) {
      memory.budgetSamples = memory.budgetSamples.slice(-MAX_BUDGET_SAMPLES);
    }
  }

  for (const activity of input.activities) {
    const name = activity.trim();
    if (!name) continue;
    memory.activityCounts[name] = (memory.activityCounts[name] ?? 0) + 1;
  }

  const sortedActivities = Object.entries(memory.activityCounts).sort((a, b) => b[1] - a[1]);
  if (sortedActivities.length > MAX_ACTIVITY_ENTRIES) {
    memory.activityCounts = Object.fromEntries(sortedActivities.slice(0, MAX_ACTIVITY_ENTRIES));
  }

  memory.updatedAt = new Date().toISOString();
  await writeMemory(memory);
}

export async function seedTravelStylePreference(personality: PersonalityOption): Promise<void> {
  if (!PERSONALITY_OPTIONS.includes(personality)) return;

  const memory = await readMemory();
  if ((memory.travelStyleCounts[personality] ?? 0) > 0) return;

  memory.travelStyleCounts[personality] = 1;
  memory.updatedAt = new Date().toISOString();
  await writeMemory(memory);
}

export function buildUserMemoryPromptSection(preferences: UserPreferences): string {
  if (!preferences.hasData) return '';

  const lines: string[] = [];

  if (preferences.favoriteTravelStyle) {
    lines.push(`- 好みの旅行タイプ: ${preferences.favoriteTravelStyle}`);
  }
  if (preferences.budgetPreference) {
    lines.push(`- 予算の目安: ${preferences.budgetPreference}`);
  }
  if (preferences.preferredTripDuration) {
    lines.push(`- 好みの期間: ${preferences.preferredTripDuration}`);
  }
  if (preferences.favoriteActivities.length > 0) {
    lines.push(`- よく選ばれるアクティビティ: ${preferences.favoriteActivities.join('、')}`);
  }

  return `

## ユーザーの好み（記憶・必ず反映）
このユーザーは過去の利用履歴から、以下の傾向が学習されています。今回の入力条件を最優先しつつ、矛盾しない範囲でプランに反映してください。

${lines.join('\n')}

- 好みの旅行タイプに合うスポット選定を意識すること
- 予算の目安を大きく超えない配分にすること
- 好きなアクティビティと似たジャンル・雰囲気のスポットも積極的に検討すること
- 好みの期間に合ったペース（スポット数・滞在時間）を維持すること
- plannerMessage で、ユーザーの好みを理解していることが伝わる一言を添えること`;
}

export async function clearUserMemory(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export function isValidStoredTripDuration(value: string): value is TripDurationOption {
  return TRIP_DURATION_OPTIONS.includes(value as TripDurationOption);
}
