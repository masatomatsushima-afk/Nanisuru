/**
 * PlaceCandidate の安全フィルタ。
 * 不完全・不一致候補を除外または低評価対象としてマークする（ランキング前処理）。
 */

import type { PlaceCandidate } from '@/types/place-candidate';
import type { PlaceRankingContext } from './place-ranking-context';

export type PlaceCandidateRejectReason =
  | 'empty_name'
  | 'wrong_destination'
  | 'missing_identity'
  | 'insufficient_maps_info'
  | 'invalid_rating'
  | 'invalid_review_count';

export type RejectedPlaceCandidate = {
  candidate: PlaceCandidate;
  reason: PlaceCandidateRejectReason;
};

export type PlaceCandidateFilterResult = {
  kept: PlaceCandidate[];
  rejected: RejectedPlaceCandidate[];
};

const MAX_REVIEW_COUNT = 5_000_000;

function normalizeToken(value: string | undefined | null): string {
  return (value ?? '').trim().toLowerCase();
}

function destinationTokens(context: PlaceRankingContext): string[] {
  const raw = [context.destinationLabel, context.city, context.country]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const tokens = new Set<string>();
  for (const part of raw.split(/[\s,、/]+/)) {
    const trimmed = part.trim();
    if (trimmed) tokens.add(trimmed);
  }

  if (raw.includes('seoul') || raw.includes('ソウル') || raw.includes('韓国') || raw.includes('korea')) {
    tokens.add('seoul');
    tokens.add('ソウル');
    tokens.add('korea');
  }
  if (raw.includes('tokyo') || raw.includes('東京')) {
    tokens.add('tokyo');
    tokens.add('東京');
  }
  if (raw.includes('osaka') || raw.includes('大阪')) {
    tokens.add('osaka');
    tokens.add('大阪');
  }

  return [...tokens];
}

function candidateDestinationText(candidate: PlaceCandidate): string {
  return [candidate.city, candidate.country, candidate.area, candidate.address]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function isDestinationMatch(
  candidate: PlaceCandidate,
  context: PlaceRankingContext,
): boolean {
  const tokens = destinationTokens(context);
  if (tokens.length === 0) return true;

  const haystack = candidateDestinationText(candidate);
  return tokens.some((token) => haystack.includes(token));
}

export function hasValidRating(rating: number | null | undefined): boolean {
  if (rating == null) return true;
  return Number.isFinite(rating) && rating >= 0 && rating <= 5;
}

export function hasValidReviewCount(reviewCount: number | null | undefined): boolean {
  if (reviewCount == null) return true;
  return Number.isFinite(reviewCount) && reviewCount >= 0 && reviewCount <= MAX_REVIEW_COUNT;
}

export function hasSufficientMapsInfo(candidate: PlaceCandidate): boolean {
  const hasCoords = Boolean(candidate.coordinates?.lat != null && candidate.coordinates?.lng != null);
  const hasMapsUrl = Boolean(candidate.mapsUrl?.trim());
  const hasPlaceId = Boolean(candidate.placeId?.trim());
  return hasCoords || hasMapsUrl || hasPlaceId;
}

export function hasPlaceIdentity(candidate: PlaceCandidate): boolean {
  const hasCoords = Boolean(candidate.coordinates?.lat != null && candidate.coordinates?.lng != null);
  const hasPlaceId = Boolean(candidate.placeId?.trim());
  return hasCoords || hasPlaceId;
}

function rejectReasonFor(candidate: PlaceCandidate, context: PlaceRankingContext): PlaceCandidateRejectReason | null {
  if (!candidate.placeName?.trim()) return 'empty_name';
  if (!isDestinationMatch(candidate, context)) return 'wrong_destination';
  if (!hasPlaceIdentity(candidate)) return 'missing_identity';
  if (!hasSufficientMapsInfo(candidate)) return 'insufficient_maps_info';
  if (!hasValidRating(candidate.rating)) return 'invalid_rating';
  if (!hasValidReviewCount(candidate.reviewCount)) return 'invalid_review_count';
  return null;
}

/** 不完全・不一致候補を除外する。データ不足でも例外は出さない。 */
export function filterPlaceCandidates(
  candidates: readonly PlaceCandidate[],
  context: PlaceRankingContext,
): PlaceCandidateFilterResult {
  const kept: PlaceCandidate[] = [];
  const rejected: RejectedPlaceCandidate[] = [];

  for (const candidate of candidates) {
    const reason = rejectReasonFor(candidate, context);
    if (reason) {
      rejected.push({ candidate, reason });
      continue;
    }
    kept.push(candidate);
  }

  return { kept, rejected };
}

/** ランキング用の安全スコアペナルティ（除外はせず低評価）。 */
export function placeCandidateSafetyPenalty(candidate: PlaceCandidate): number {
  let penalty = 0;

  if (!candidate.mapsUrl?.trim()) penalty += 4;
  if (candidate.confidence === 'low') penalty += 8;
  if (candidate.confidence === 'medium') penalty += 3;
  if (!hasValidRating(candidate.rating)) penalty += 10;
  if (!hasValidReviewCount(candidate.reviewCount)) penalty += 10;

  return penalty;
}
