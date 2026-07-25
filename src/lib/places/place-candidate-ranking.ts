/**
 * PlaceCandidate の簡易ランキング。
 * 将来 Google Places 取得結果を AI へ渡す前に、Nanisuru 側で比較・選定するための下準備。
 */

import { haversineDistanceMeters } from '@/lib/geo';
import type { PlaceCandidate } from '@/types/place-candidate';
import {
  filterPlaceCandidates,
  isDestinationMatch,
  placeCandidateSafetyPenalty,
} from './place-candidate-safety';
import type { PlaceRankingContext } from './place-ranking-context';
import { resolveVenueSetting } from './place-venue-setting';

export type { PlaceRankingContext } from './place-ranking-context';

export type RankedPlaceCandidate = {
  candidate: PlaceCandidate;
  score: number;
};

function normalizeText(value: string | undefined | null): string {
  return (value ?? '').trim().toLowerCase();
}

function scoreDestinationMatch(candidate: PlaceCandidate, context: PlaceRankingContext): number {
  if (!isDestinationMatch(candidate, context)) return 0;

  let score = 30;

  const ctxCity = normalizeText(context.city);
  const ctxCountry = normalizeText(context.country);
  const candCity = normalizeText(candidate.city);
  const candCountry = normalizeText(candidate.country);

  if (ctxCity && candCity && ctxCity === candCity) score += 15;
  if (ctxCountry && candCountry && ctxCountry === candCountry) score += 10;

  const label = normalizeText(context.destinationLabel);
  const area = normalizeText(candidate.area);
  if (area && label.includes(area)) score += 8;

  return score;
}

function scoreCategoryMatch(candidate: PlaceCandidate, context: PlaceRankingContext): number {
  if (!context.categories?.length || !candidate.category) return 0;
  return context.categories.includes(candidate.category) ? 20 : 0;
}

function scoreRating(candidate: PlaceCandidate): number {
  const rating = candidate.rating;
  if (rating == null || !Number.isFinite(rating)) return 0;
  return Math.max(0, Math.min(15, (rating / 5) * 15));
}

function scoreReviewCount(candidate: PlaceCandidate): number {
  const count = candidate.reviewCount;
  if (count == null || !Number.isFinite(count) || count <= 0) return 0;
  return Math.min(12, Math.log10(count + 1) * 4);
}

function scorePriceLevel(candidate: PlaceCandidate): number {
  const level = candidate.priceLevel;
  if (level == null || !Number.isFinite(level)) return 0;
  if (level < 0 || level > 4) return 0;
  return 2;
}

function scoreProximity(candidate: PlaceCandidate, context: PlaceRankingContext): number {
  let score = 0;

  const baseArea = normalizeText(context.baseArea ?? context.accommodation);
  const area = normalizeText(candidate.area);
  if (baseArea && area && (area.includes(baseArea) || baseArea.includes(area))) {
    score += 12;
  }

  if (context.coordinates && candidate.coordinates) {
    const meters = haversineDistanceMeters(
      { latitude: context.coordinates.lat, longitude: context.coordinates.lng },
      { latitude: candidate.coordinates.lat, longitude: candidate.coordinates.lng },
    );
    const km = meters / 1000;
    score += Math.max(0, 15 - km * 3);
  }

  return score;
}

function scoreOpeningHours(candidate: PlaceCandidate, context: PlaceRankingContext): number {
  if (!context.preferOpenNow) return 0;
  const isOpen = candidate.openingHours?.isOpenNow;
  if (isOpen === true) return 6;
  if (isOpen === false) return -12;
  return 0;
}

function scoreConfidence(candidate: PlaceCandidate): number {
  switch (candidate.confidence) {
    case 'high':
      return 8;
    case 'medium':
      return 4;
    case 'low':
      return 0;
    default:
      return 2;
  }
}

/**
 * Weather fit — boost/penalty from venue setting + trip weather bias.
 * Unknown venue settings are barely touched (no dangerous outdoor assertion).
 */
function scoreWeatherFit(candidate: PlaceCandidate, context: PlaceRankingContext): number {
  const fit = context.weatherFit;
  if (!fit) return 0;

  const setting = resolveVenueSetting(candidate);

  let score = 0;
  if (fit.preferIndoor || fit.rainRisk) {
    if (setting === 'indoor') score += 14;
    else if (setting === 'mixed') score += 6;
    else if (setting === 'outdoor') score -= 12;
    // unknown: mild indoor preference only when rain is clear
    else if (fit.rainRisk) score += 2;
  } else if (fit.preferOutdoor) {
    if (setting === 'outdoor') score += 10;
    else if (setting === 'indoor') score -= 3;
  }

  if (fit.heatRisk) {
    if (setting === 'indoor') score += 6;
    else if (setting === 'outdoor') score -= 6;
  }
  if (fit.coldRisk) {
    if (setting === 'indoor') score += 5;
    else if (setting === 'outdoor') score -= 4;
  }

  return score;
}

function scoreCandidate(candidate: PlaceCandidate, context: PlaceRankingContext): number {
  const raw =
    scoreDestinationMatch(candidate, context) +
    scoreCategoryMatch(candidate, context) +
    scoreRating(candidate) +
    scoreReviewCount(candidate) +
    scorePriceLevel(candidate) +
    scoreProximity(candidate, context) +
    scoreOpeningHours(candidate, context) +
    scoreConfidence(candidate) +
    scoreWeatherFit(candidate, context);

  return Math.max(0, raw - placeCandidateSafetyPenalty(candidate));
}

/**
 * 候補をスコア降順で並べ替える。
 * 安全フィルタを通した後にランキングする。
 */
export function rankPlaceCandidates(
  candidates: readonly PlaceCandidate[],
  context: PlaceRankingContext,
): RankedPlaceCandidate[] {
  const safeInput = Array.isArray(candidates) ? candidates : [];
  const { kept } = filterPlaceCandidates(safeInput, context);

  return kept
    .map((candidate) => ({
      candidate,
      score: scoreCandidate(candidate, context),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      const reviewDiff = (right.candidate.reviewCount ?? 0) - (left.candidate.reviewCount ?? 0);
      if (reviewDiff !== 0) return reviewDiff;
      return left.candidate.placeName.localeCompare(right.candidate.placeName, 'ja');
    });
}

/** 上位 N 件を返す。maxCount が不正でも例外を出さない。 */
export function pickTopPlaceCandidates(
  candidates: readonly PlaceCandidate[],
  context: PlaceRankingContext,
  maxCount = 10,
): PlaceCandidate[] {
  const limit = Number.isFinite(maxCount) && maxCount > 0 ? Math.floor(maxCount) : 10;
  return rankPlaceCandidates(candidates, context)
    .slice(0, limit)
    .map((entry) => entry.candidate);
}
