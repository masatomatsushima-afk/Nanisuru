import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  createTravelMemory,
  getTravelMemories,
  updateTravelMemory,
} from '@/lib/travel-memory';
import type { CreateTravelMemoryInput, TravelMemoryCategory } from '@/types/travel-memory';
import type {
  PlanFeedbackTag,
  PlanRating,
  PlanRatingContext,
  RatingTendencies,
  SavePlanRatingInput,
} from '@/types/plan-rating';
import { PLAN_FEEDBACK_TAGS } from '@/types/plan-rating';

type PlanRatingRow = {
  id: string;
  user_id: string;
  trip_id: string | null;
  stars: number;
  feedback_tags: string[];
  plan_source: PlanRating['planSource'];
  plan_snapshot: PlanRatingContext;
  created_at: string;
};

const FEEDBACK_MEMORY_MAP: Partial<
  Record<PlanFeedbackTag, CreateTravelMemoryInput>
> = {
  微妙: {
    category: 'travel_style',
    content: 'バランスの悪い・詰め込みすぎのプランは好まない',
  },
  高すぎる: {
    category: 'budget',
    content: '予算は抑えめ・コスパ重視のプランを好む',
  },
  移動が多い: {
    category: 'travel_style',
    content: '移動は少なめ・徒歩圏内でまとめたい',
  },
  もっとグルメ多め: {
    category: 'food',
    content: '食事・グルメの時間を多めにしたい',
  },
  もっとゆっくりしたい: {
    category: 'travel_style',
    content: 'ゆっくりしたペース・余裕のある行程を好む',
  },
  'デート向きで良い': {
    category: 'companion',
    content: 'デート向き・二人で楽しめるプランを好む',
  },
  一人向きで良い: {
    category: 'companion',
    content: '一人でも楽しめる・気兼ねしないプランを好む',
  },
};

const POSITIVE_ACTIVITY_PATTERNS: Array<{
  pattern: RegExp;
  memory: CreateTravelMemoryInput;
}> = [
  {
    pattern: /カフェ|coffee|コーヒー|喫茶|ベーカリー/i,
    memory: { category: 'activities', content: 'カフェ・落ち着いたスポットを好む' },
  },
  {
    pattern: /レストラン|ランチ|ディナー|グルメ|食事|寿司|ラーメン|イタリアン/i,
    memory: { category: 'food', content: 'グルメ・食事体験を重視する' },
  },
  {
    pattern: /美術館|博物館|ギャラリー|アート/i,
    memory: { category: 'activities', content: '美術館・文化施設が好き' },
  },
  {
    pattern: /公園|自然|散歩|ハイキング|ビーチ/i,
    memory: { category: 'activities', content: '自然・公園でのんびりするのが好き' },
  },
  {
    pattern: /温泉|スパ|サウナ/i,
    memory: { category: 'activities', content: '温泉・リラックス系が好き' },
  },
  {
    pattern: /夜景|展望|スカイ/i,
    memory: { category: 'activities', content: '夜景・眺望スポットが好き' },
  },
];

function assertPlanRatingsConfigured(): void {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'プラン評価には Supabase の設定が必要です。\n.env を確認し、plan_ratings テーブルを作成してください。',
    );
  }
}

async function requireUserId(): Promise<string> {
  assertPlanRatingsConfigured();

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

function rowToPlanRating(row: PlanRatingRow): PlanRating {
  return {
    id: row.id,
    userId: row.user_id,
    tripId: row.trip_id,
    stars: row.stars,
    feedbackTags: row.feedback_tags.filter((tag): tag is PlanFeedbackTag =>
      PLAN_FEEDBACK_TAGS.includes(tag as PlanFeedbackTag),
    ),
    planSource: row.plan_source,
    planSnapshot: row.plan_snapshot,
    createdAt: row.created_at,
  };
}

function isSimilarMemory(existing: string, incoming: string): boolean {
  const normalize = (value: string) => value.replace(/\s+/g, '').toLowerCase();
  const a = normalize(existing);
  const b = normalize(incoming);
  if (a === b) return true;
  if (a.includes(b.slice(0, 6)) || b.includes(a.slice(0, 6))) return true;
  return false;
}

async function ensureTravelMemory(input: CreateTravelMemoryInput): Promise<void> {
  const existing = await getTravelMemories();
  const match = existing.find(
    (memory) =>
      memory.category === input.category && isSimilarMemory(memory.content, input.content),
  );

  if (match) {
    await updateTravelMemory(match.id, { content: input.content });
    return;
  }

  await createTravelMemory(input);
}

function buildPositiveMemoriesFromPlan(context: PlanRatingContext): CreateTravelMemoryInput[] {
  const blob = context.items
    .map((item) => `${item.activity} ${item.placeAddress ?? ''}`)
    .join(' ');
  const memories: CreateTravelMemoryInput[] = [];
  const seen = new Set<TravelMemoryCategory>();

  for (const { pattern, memory } of POSITIVE_ACTIVITY_PATTERNS) {
    if (!pattern.test(blob)) continue;
    if (seen.has(memory.category)) continue;
    seen.add(memory.category);
    memories.push(memory);
  }

  if (context.personality) {
    memories.push({
      category: 'travel_style',
      content: `${context.personality}タイプのプランを好む`,
    });
  }

  return memories;
}

export async function applyRatingToTravelMemory(input: SavePlanRatingInput): Promise<void> {
  const { stars, feedbackTags, context } = input;
  const isPositive = stars >= 4 || feedbackTags.includes('行きたい');

  for (const tag of feedbackTags) {
    const memory = FEEDBACK_MEMORY_MAP[tag];
    if (memory) {
      await ensureTravelMemory(memory);
    }
  }

  if (isPositive && !feedbackTags.includes('微妙')) {
    const positiveMemories = buildPositiveMemoriesFromPlan(context);
    for (const memory of positiveMemories) {
      await ensureTravelMemory(memory);
    }
  }

  if (stars <= 2 && !feedbackTags.includes('高すぎる')) {
    await ensureTravelMemory({
      category: 'travel_style',
      content: '全体の満足度が低いプランは避けたい（行程の見直しを希望）',
    });
  }
}

export async function savePlanRating(input: SavePlanRatingInput): Promise<PlanRating> {
  const userId = await requireUserId();

  if (input.stars < 1 || input.stars > 5) {
    throw new Error('評価は1〜5の星で選んでください');
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('plan_ratings')
    .insert({
      user_id: userId,
      trip_id: input.tripId ?? null,
      stars: input.stars,
      feedback_tags: input.feedbackTags,
      plan_source: input.context.source,
      plan_snapshot: input.context,
    })
    .select('id, user_id, trip_id, stars, feedback_tags, plan_source, plan_snapshot, created_at')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? '評価の保存に失敗しました');
  }

  try {
    await applyRatingToTravelMemory(input);
  } catch {
    // Rating saved; memory sync is best-effort
  }

  return rowToPlanRating(data as PlanRatingRow);
}

export async function linkPlanRatingToTrip(ratingId: string, tripId: string): Promise<void> {
  await requireUserId();

  const supabase = getSupabase();
  const { error } = await supabase
    .from('plan_ratings')
    .update({ trip_id: tripId })
    .eq('id', ratingId)
    .is('trip_id', null);

  if (error) {
    throw new Error(error.message ?? '評価とプランの紐づけに失敗しました');
  }
}

export async function getUserPlanRatings(): Promise<PlanRating[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = getSupabase();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return [];

  const { data, error } = await supabase
    .from('plan_ratings')
    .select('id, user_id, trip_id, stars, feedback_tags, plan_source, plan_snapshot, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message ?? '評価履歴の取得に失敗しました');
  }

  return (data as PlanRatingRow[]).map(rowToPlanRating);
}

function buildInsights(
  ratings: PlanRating[],
  tagCounts: Map<PlanFeedbackTag, number>,
): string[] {
  const insights: string[] = [];

  if (ratings.length === 0) return insights;

  const avg =
    ratings.reduce((sum, rating) => sum + rating.stars, 0) / Math.max(ratings.length, 1);
  insights.push(`平均評価 ${avg.toFixed(1)} / 5（${ratings.length}件）`);

  const topTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([tag]) => tag);

  if (topTags.length > 0) {
    insights.push(`よく選ぶフィードバック: ${topTags.join('、')}`);
  }

  if (tagCounts.has('もっとグルメ多め') || tagCounts.has('行きたい')) {
    const highRatedGourmet = ratings.filter(
      (rating) =>
        rating.stars >= 4 &&
        /グルメ|レストラン|カフェ|食/i.test(
          rating.planSnapshot.items.map((item) => item.activity).join(' '),
        ),
    );
    if (highRatedGourmet.length >= 2 || tagCounts.has('もっとグルメ多め')) {
      insights.push('グルメ・食事重視のプランを好む傾向');
    }
  }

  if (tagCounts.has('移動が多い')) {
    insights.push('移動少なめ・徒歩圏内のプランを希望');
  }

  if (tagCounts.has('高すぎる')) {
    insights.push('コスパ重視・予算抑えめのプランを希望');
  }

  if (tagCounts.has('もっとゆっくりしたい')) {
    insights.push('ゆっくりしたペースを好む');
  }

  if (tagCounts.has('デート向きで良い')) {
    insights.push('デート向きのプランを高評価');
  }

  if (tagCounts.has('一人向きで良い')) {
    insights.push('一人旅向きのプランを高評価');
  }

  const personalityCounts = new Map<string, number>();
  for (const rating of ratings.filter((item) => item.stars >= 4)) {
    const key = rating.planSnapshot.personality;
    personalityCounts.set(key, (personalityCounts.get(key) ?? 0) + 1);
  }
  const topPersonality = [...personalityCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topPersonality && topPersonality[1] >= 2) {
    insights.push(`高評価が多いタイプ: ${topPersonality[0]}`);
  }

  return insights;
}

export async function getRatingTendencies(): Promise<RatingTendencies> {
  const ratings = await getUserPlanRatings();

  if (ratings.length === 0) {
    return {
      totalRatings: 0,
      averageStars: null,
      topFeedbackTags: [],
      insights: [],
    };
  }

  const tagCounts = new Map<PlanFeedbackTag, number>();
  for (const rating of ratings) {
    for (const tag of rating.feedbackTags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  const averageStars =
    ratings.reduce((sum, rating) => sum + rating.stars, 0) / ratings.length;

  const topFeedbackTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag, count]) => ({ tag, count }));

  return {
    totalRatings: ratings.length,
    averageStars,
    topFeedbackTags,
    insights: buildInsights(ratings, tagCounts),
  };
}
