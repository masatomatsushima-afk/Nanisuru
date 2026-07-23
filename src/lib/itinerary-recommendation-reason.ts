/**
 * User-facing "おすすめポイント" for itinerary cards (Plan Detail / timeline).
 *
 * Keeps a stable resolution API so Preference Profile explainable reasons can be
 * plugged in later without changing card UI. Does not mutate plan generation.
 */

import type { ItineraryItem } from '@/types/plan';
import type { ExplainableRecommendationReason } from '@/types/preference-discovery';

const LOGISTICS_OR_BUFFER_CATEGORY = new Set([
  '移動',
  '休憩',
  'transportation',
  'logistics',
  'transit',
  'rest',
]);

const LOGISTICS_ACTIVITY_PATTERN =
  /移動|チェックイン|チェックアウト|空港|駅|フライト|出発|到着|荷物|トランジット|transfer|check[\s-]?in|check[\s-]?out|airport|station/i;

const BUFFER_ACTIVITY_PATTERN = /休憩|時間調整|バッファ|余裕を持っ|free time|buffer/i;

/** Internal / technical phrases that must never surface in the UI. */
const TECHNICAL_REASON_PATTERN =
  /候補選定|対象外|fallback|seed|google\s*places|google\s*候補|実在候補|候補不足|validation|logistics|ロジスティクス|ui確認|テスト用|フォールバック|開発環境|placeid|nanisuru_dev|dev\s*fallback|enforcement|orchestrat/i;

const ABSTRACT_REASON_PATTERN =
  /^(おすすめ|スポット|候補|選定|理由)[。．\s]*$|^(n\/a|none|null|undefined)$/i;

export type RecommendationHighlightInput = {
  item: ItineraryItem;
  /**
   * Optional Preference Profile reasons (Phase 3+).
   * When present and user-facing, these are preferred over raw `item.reason`.
   */
  preferenceReasons?: readonly ExplainableRecommendationReason[];
};

function normalizedCategory(item: ItineraryItem): string {
  return (item.activityCategory ?? item.placeCategory ?? item.category ?? '')
    .toString()
    .trim()
    .toLowerCase();
}

/** Transit / check-in / rest stops — never show recommendation copy. */
export function isNonRecommendableItineraryStop(item: ItineraryItem): boolean {
  const category = normalizedCategory(item);
  if (LOGISTICS_OR_BUFFER_CATEGORY.has(category) || LOGISTICS_OR_BUFFER_CATEGORY.has(item.activityCategory ?? '')) {
    return true;
  }

  const haystack = [item.activity, item.placeName, item.note].filter(Boolean).join(' ');
  if (LOGISTICS_ACTIVITY_PATTERN.test(haystack)) return true;
  if (BUFFER_ACTIVITY_PATTERN.test(haystack) && item.isSpecificPlace !== true) return true;
  return false;
}

/** Concrete place / experience worth explaining to the user. */
export function isConcreteRecommendationTarget(item: ItineraryItem): boolean {
  if (isNonRecommendableItineraryStop(item)) return false;
  if (item.isSpecificPlace === true) return true;
  if (item.placeName?.trim()) return true;
  if (item.placeId?.trim()) return true;
  // Named activity that is not a bare logistics label.
  const activity = item.activity?.trim() ?? '';
  if (!activity) return false;
  if (LOGISTICS_ACTIVITY_PATTERN.test(activity) || BUFFER_ACTIVITY_PATTERN.test(activity)) {
    return false;
  }
  return activity.length >= 2;
}

export function isTechnicalOrNonUserFacingReason(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (TECHNICAL_REASON_PATTERN.test(trimmed)) return true;
  if (ABSTRACT_REASON_PATTERN.test(trimmed)) return true;
  return false;
}

/**
 * Strip / reject reason text that is empty, abstract, or internal.
 * Returns null when nothing user-facing remains.
 */
export function sanitizeUserFacingRecommendationReason(
  reason: string | null | undefined,
): string | null {
  if (typeof reason !== 'string') return null;
  const trimmed = reason.replace(/\s+/g, ' ').trim();
  if (!trimmed) return null;
  if (isTechnicalOrNonUserFacingReason(trimmed)) return null;
  // Too short to be useful as a highlight.
  if (trimmed.length < 4) return null;
  return trimmed;
}

function resolvePreferenceReasonTexts(
  reasons: readonly ExplainableRecommendationReason[] | undefined,
): string[] {
  if (!reasons?.length) return [];
  return reasons
    .map((reason) => {
      // Until i18n lands, messageKey may already be a Japanese sentence.
      const raw = reason.messageKey?.trim() || '';
      return sanitizeUserFacingRecommendationReason(raw);
    })
    .filter((text): text is string => Boolean(text));
}

/**
 * Resolve the single string shown under「おすすめポイント」.
 * Returns null → caller must hide both heading and box.
 *
 * MVP: never surface raw `item.reason` (often internal / Places boilerplate).
 * Preference Profile explainable reasons can still be shown when provided.
 * `item.reason` remains on the itinerary payload for later reuse.
 */
export function resolveItineraryRecommendationHighlight(
  input: RecommendationHighlightInput,
): string | null {
  const { item, preferenceReasons } = input;
  if (!isConcreteRecommendationTarget(item)) return null;

  // MVP gate: only Preference-derived copy is eligible for the blue highlight box.
  // Raw generation/fallback `item.reason` stays in data but is not displayed.
  if (!preferenceReasons?.length) return null;

  for (const text of resolvePreferenceReasonTexts(preferenceReasons)) {
    // Prefer a short one-line highlight when Preference Profile is connected.
    return text.length > 48 ? `${text.slice(0, 47)}…` : text;
  }

  return null;
}
