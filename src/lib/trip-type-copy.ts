/**
 * Trip-audience-aware copy for recommendation reasons, item reasons, and feedback chips.
 * Keeps family / solo / friends / couple / date wording from leaking across trip types.
 */

import type { CompanionOption, ItineraryDay, PlanDetails } from '@/types/plan';
import type { PlanCreationType } from '@/types/plan-creation';
import type { PlanFeedbackTag } from '@/types/plan-rating';

export type TripAudience = 'family' | 'couple' | 'date' | 'friends' | 'solo' | 'general';

const SHARED_FEEDBACK_TAGS = [
  '行きたい',
  '微妙',
  '高すぎる',
  '移動が多い',
  'もっとグルメ多め',
  'もっとゆっくりしたい',
] as const satisfies readonly PlanFeedbackTag[];

export const RECOMMEND_REASONS_BY_AUDIENCE: Record<TripAudience, readonly string[]> = {
  family: [
    '家族みんなで楽しめる',
    '子ども連れでも回りやすい',
    '移動時間が少ない',
    '予算内に収まる',
    '雨の日でも楽しめる',
    '休憩を挟みやすい',
    '食事の選択肢が多い',
  ],
  couple: [
    'デート向き',
    '雰囲気が良い',
    '会話しやすい',
    '夜景が楽しめる',
    '写真を撮りやすい',
    '予算内に収まる',
    '移動時間が少ない',
  ],
  date: [
    '初デートで会話しやすい',
    'デート向き',
    '雰囲気が良い',
    '夜景が楽しめる',
    '写真を撮りやすい',
    '予算内に収まる',
    '移動時間が少ない',
  ],
  friends: [
    '友達同士で盛り上がりやすい',
    '写真を撮りやすい',
    '食べ歩きしやすい',
    '移動時間が少ない',
    '予算内に収まる',
    '雨の日でも楽しめる',
  ],
  solo: [
    '一人でも入りやすい',
    '自分のペースで回れる',
    '移動がシンプル',
    '予算内に収まる',
    '雨の日でも楽しめる',
    '休憩を挟みやすい',
  ],
  general: [
    '予算内に収まる',
    '移動時間が少ない',
    '雨の日でも楽しめる',
    '食事の選択肢が多い',
  ],
};

const FEEDBACK_TAGS_BY_AUDIENCE: Record<TripAudience, readonly PlanFeedbackTag[]> = {
  family: [...SHARED_FEEDBACK_TAGS, '家族向きで良い', '子ども連れには微妙'],
  couple: [...SHARED_FEEDBACK_TAGS, 'デート向きで良い'],
  date: [...SHARED_FEEDBACK_TAGS, 'デート向きで良い'],
  friends: [...SHARED_FEEDBACK_TAGS],
  solo: [...SHARED_FEEDBACK_TAGS, '一人向きで良い'],
  general: [...SHARED_FEEDBACK_TAGS],
};

const BANNED_PATTERNS: Record<TripAudience, RegExp[]> = {
  family: [
    /初デート/,
    /デート向き/,
    /デート(?:向|に|で)/,
    /カップル(?:向|に|で|の)?/,
    /一人向き/,
    /ひとり向き/,
    /一人(?:でも|向)/,
    /ソロ(?:向|旅)?/,
  ],
  solo: [/家族(?:みんな|向)/, /子ども連れ/, /家族旅行/, /初デート/, /カップル/],
  date: [/家族(?:みんな|向)/, /子ども連れ/, /一人向き/, /ひとり向き/],
  couple: [/家族(?:みんな|向)/, /子ども連れ/, /初デート/, /一人向き/, /ひとり向き/],
  friends: [/初デート/, /カップル(?:向|に|で)/, /子ども連れ/, /家族(?:みんな|向)/],
  general: [],
};

const ITEM_REASON_FALLBACKS: Record<TripAudience, readonly string[]> = {
  family: [
    '家族みんなで楽しめて、移動も少なめに回れるスポットです。',
    '子ども連れでも無理のないペースで楽しめます。',
    '予算内に収まりやすく、食事の選択肢も広いエリアです。',
  ],
  couple: [
    '二人で過ごしやすく、雰囲気の良いスポットです。',
    '会話しやすいペースで、デート向きの流れに組み込みやすい場所です。',
    '移動を抑えつつ、写真も撮りやすいスポットです。',
  ],
  date: [
    '初デートでも会話しやすく、緊張しすぎない雰囲気のスポットです。',
    '二人のペースで楽しめて、デート向きの流れに合います。',
    '移動が少なく、雰囲気を大切にしたい日に向いています。',
  ],
  friends: [
    '友達同士で盛り上がりやすく、食べ歩きにも向いています。',
    'みんなで回りやすく、写真も撮りやすいスポットです。',
    '移動がシンプルで、グループ旅行のペースに合います。',
  ],
  solo: [
    '一人でも入りやすく、自分のペースで楽しめます。',
    '気兼ねなく回れて、移動もシンプルなスポットです。',
    '予算を抑えつつ、ゆっくり過ごしやすい場所です。',
  ],
  general: [
    '移動を抑えつつ、予算内で楽しみやすいスポットです。',
    '天候や時間帯を問わず回りやすいエリアです。',
  ],
};

export function resolveTripAudience(input: {
  companion?: CompanionOption | null;
  planCreationType?: PlanCreationType | string | null;
}): TripAudience {
  if (input.planCreationType === 'デートプラン') return 'date';

  switch (input.companion) {
    case '家族':
      return 'family';
    case 'カップル':
      return 'couple';
    case '初デート':
      return 'date';
    case '友達':
      return 'friends';
    case '一人':
      return 'solo';
    default:
      return 'general';
  }
}

export function getRecommendReasonsForTrip(
  audience: TripAudience,
  limit = 4,
): string[] {
  const pool = RECOMMEND_REASONS_BY_AUDIENCE[audience] ?? RECOMMEND_REASONS_BY_AUDIENCE.general;
  return pool.slice(0, limit);
}

export function getFeedbackTagsForTrip(audience: TripAudience): PlanFeedbackTag[] {
  return [...(FEEDBACK_TAGS_BY_AUDIENCE[audience] ?? FEEDBACK_TAGS_BY_AUDIENCE.general)];
}

export function isTripCopyAllowed(text: string, audience: TripAudience): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  return !BANNED_PATTERNS[audience].some((pattern) => pattern.test(trimmed));
}

export function sanitizeTripCopyText(
  text: string,
  audience: TripAudience,
  fallbackIndex = 0,
): string {
  if (isTripCopyAllowed(text, audience)) return text.trim();
  const fallbacks = ITEM_REASON_FALLBACKS[audience] ?? ITEM_REASON_FALLBACKS.general;
  return fallbacks[fallbackIndex % fallbacks.length] ?? fallbacks[0];
}

export function filterRecommendReasons(
  reasons: string[],
  audience: TripAudience,
): string[] {
  const filtered = reasons.filter((reason) => isTripCopyAllowed(reason, audience));
  if (filtered.length > 0) return filtered;
  return getRecommendReasonsForTrip(audience, 4);
}

export function sanitizeItineraryTripCopy(
  days: ItineraryDay[],
  audience: TripAudience,
): { days: ItineraryDay[]; fixesApplied: string[] } {
  const fixesApplied: string[] = [];
  let fallbackCursor = 0;

  const nextDays = days.map((day) => ({
    ...day,
    items: day.items.map((item) => {
      if (!item.reason?.trim()) return item;
      if (isTripCopyAllowed(item.reason, audience)) return item;

      const sanitized = sanitizeTripCopyText(item.reason, audience, fallbackCursor);
      fallbackCursor += 1;
      fixesApplied.push(`「${item.activity}」の理由文を${audience}向けに差し替え`);
      return { ...item, reason: sanitized };
    }),
  }));

  return { days: nextDays, fixesApplied };
}

export function sanitizePlanDetailsTripCopy(
  details: PlanDetails,
  audience: TripAudience,
): { details: PlanDetails; fixesApplied: string[] } {
  const fixesApplied: string[] = [];
  let fallbackCursor = 0;

  const highlights = (details.highlights ?? [])
    .map((line) => {
      if (isTripCopyAllowed(line, audience)) return line;
      fixesApplied.push(`ハイライトを${audience}向けに差し替え`);
      return sanitizeTripCopyText(line, audience, fallbackCursor++);
    })
    .filter(Boolean);

  const plannerMessage =
    details.plannerMessage && !isTripCopyAllowed(details.plannerMessage, audience)
      ? (fixesApplied.push(`プランナーメッセージを${audience}向けに差し替え`),
        sanitizeTripCopyText(details.plannerMessage, audience, fallbackCursor++))
      : details.plannerMessage;

  const overallStrategy = details.conciergeAnalysis?.overallStrategy;
  const sanitizedStrategy =
    overallStrategy && !isTripCopyAllowed(overallStrategy, audience)
      ? (fixesApplied.push(`overallStrategyを${audience}向けに差し替え`),
        sanitizeTripCopyText(overallStrategy, audience, fallbackCursor++))
      : overallStrategy;

  return {
    details: {
      ...details,
      highlights: highlights.length > 0 ? highlights : getRecommendReasonsForTrip(audience, 3),
      plannerMessage,
      conciergeAnalysis: details.conciergeAnalysis
        ? {
            ...details.conciergeAnalysis,
            overallStrategy: sanitizedStrategy ?? details.conciergeAnalysis.overallStrategy,
          }
        : details.conciergeAnalysis,
    },
    fixesApplied,
  };
}

export function buildTripTypePromptSection(
  audience: TripAudience,
  companion?: CompanionOption | null,
): string {
  const companionLabel = companion ?? '未指定';
  return [
    `【tripType・重要】同行者/tripType: ${companionLabel}（audience=${audience}）`,
    'Recommendation reasons (description/reason), highlights, and planner messages MUST match this tripType only.',
    audience === 'family'
      ? 'For family trips: emphasize kid-friendly pacing, group enjoyment, budget, and easy movement. NEVER mention dating, couples, first dates, or solo travel.'
      : null,
    audience === 'solo'
      ? 'For solo trips: emphasize easy solo access and flexible pacing. NEVER mention family, kids, couples, or dating.'
      : null,
    audience === 'friends'
      ? 'For friends trips: emphasize group fun, food walks, and photos. NEVER mention dating, couples, or family/kids.'
      : null,
    audience === 'couple' || audience === 'date'
      ? 'For couple/date trips: atmosphere, conversation, and photo spots are OK. Do NOT mention family/kids unless user selected family.'
      : null,
    'Feedback-oriented phrasing in reasons must not reference a different tripType.',
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n');
}
