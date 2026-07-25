/**
 * Google Places 候補の「この中から選ぶだけ」制約を強制する後処理。
 *
 * - AI が返した item.placeId を候補リストと照合する。
 *   - 有効・未使用の候補 → 候補の実データ（name/rating/reviewCount/address/category）で確定させる。
 *   - 候補外の placeId・重複利用・placeId無しで具体的な場所を名乗る item は、
 *     実在しない店の可能性があるため、安全な一般エリア表現へ強制的にダウングレードする
 *     （実装済みの genericAreaPhrase/genericMapsQuery を再利用 — 新しい店名は創作しない）。
 * - candidates が空（Places無効・失敗時）は何もしない — 既存MVPの挙動を完全に維持する。
 */

import {
  categoryForGenericKind,
  genericAreaPhrase,
  genericMapsQuery,
  normalizeDestination,
  type GenericAreaPhraseKind,
} from '@/lib/destination-safety';
import { hasValidCoordinates, sanitizePlaceId } from '@/lib/maps-link-safety';
import type { ItineraryDay, ItineraryItem } from '@/types/plan';
import type { PlaceCandidate } from '@/types/place-candidate';

// NOTE: intentionally not importing from '@/lib/spot-specificity' here — its transitive import
// chain pulls in AsyncStorage/react-native, which breaks plain-Node verify tooling. These two
// helpers are small, self-contained copies of its `getCandidateAreaLabel` / `inferKindFromItem`
// logic so this enforcement module stays dependency-light and Node-testable.
function getGenericAreaLabel(item: ItineraryItem): string {
  const area = item.placeAddress?.trim() || item.placeName?.trim();
  if (!area) return item.activity.trim();
  if (/カフェ|cafe/i.test(item.activity)) return `${area}周辺のカフェ`;
  if (/ショッピング|shopping/i.test(item.activity)) return `${area}周辺のショッピング`;
  if (/グルメ|料理|ランチ|ディナー|BBQ/i.test(item.activity)) return `${area}周辺のグルメ`;
  return `${area}周辺`;
}

function inferGenericKindFromItem(item: ItineraryItem): GenericAreaPhraseKind {
  const haystack = `${item.activity} ${item.category ?? ''} ${item.activityCategory ?? ''}`;
  if (/カフェ|cafe|デザート/i.test(haystack)) return 'cafe';
  if (/ショッピング|shopping|お土産/i.test(haystack)) return 'shopping';
  if (/夜景|night/i.test(haystack)) return 'night';
  if (/市場|market|グルメ|ランチ|ディナー|食事|BBQ|料理/i.test(haystack)) return 'market';
  if (/観光|culture|散策|宮|タワー|村/i.test(haystack)) return 'culture';
  return 'stroll';
}

export type PlaceCandidateEnforcementResult = {
  days: ItineraryDay[];
  fixesApplied: string[];
};

function buildCandidateMapsQuery(candidate: PlaceCandidate): string {
  const parts = [
    candidate.placeName?.trim(),
    candidate.area?.trim(),
    candidate.city?.trim(),
    candidate.country?.trim(),
  ].filter((part): part is string => Boolean(part));
  const deduped: string[] = [];
  for (const part of parts) {
    if (deduped.some((p) => p.toLowerCase() === part.toLowerCase())) continue;
    deduped.push(part);
  }
  return deduped.join(' ').trim();
}

function candidateCoordinates(
  candidate: PlaceCandidate,
): { latitude: number; longitude: number } | null {
  const lat = candidate.coordinates?.lat;
  const lng = candidate.coordinates?.lng;
  if (!hasValidCoordinates(lat, lng)) return null;
  return { latitude: Number(lat), longitude: Number(lng) };
}

function downgradeToGenericItem(
  item: ItineraryItem,
  normalized: ReturnType<typeof normalizeDestination>,
): ItineraryItem {
  const kind = inferGenericKindFromItem(item);
  const areaLabel = getGenericAreaLabel(item);
  const mapsQuery = genericMapsQuery(normalized, kind);

  return {
    ...item,
    activity: genericAreaPhrase(normalized.destinationLabel, kind),
    placeName: undefined,
    placeAddress: areaLabel,
    category: item.category ?? categoryForGenericKind(kind),
    isSpecificPlace: false,
    confidence: 'low',
    popularityType: 'fallback',
    source: 'fallback',
    mapsQuery,
    socialQuery: mapsQuery,
    placeId: null,
    coordinates: null,
    latitude: null,
    longitude: null,
    rating: null,
    reviewCount: null,
    priceLevel: null,
  };
}

function applyValidCandidate(item: ItineraryItem, candidate: PlaceCandidate): ItineraryItem {
  const mapsQuery = buildCandidateMapsQuery(candidate) || item.mapsQuery;
  const coordinates = candidateCoordinates(candidate);
  const placeId = sanitizePlaceId(candidate.placeId);

  return {
    ...item,
    placeName: candidate.placeName,
    placeAddress: candidate.address?.trim() || item.placeAddress,
    category: candidate.category ?? item.category,
    isSpecificPlace: true,
    confidence: 'high',
    source: 'google_places',
    // Always prefer Google Places canonical id/coords — never keep OpenAI's copy if it drifted.
    placeId,
    coordinates,
    latitude: coordinates?.latitude ?? null,
    longitude: coordinates?.longitude ?? null,
    rating: candidate.rating ?? null,
    reviewCount: candidate.reviewCount ?? null,
    priceLevel: candidate.priceLevel ?? null,
    mapsQuery: mapsQuery || item.mapsQuery,
    socialQuery: mapsQuery || item.socialQuery || item.mapsQuery,
    // Drop potentially broken Maps website URLs; Maps button rebuilds from placeId/coords/query.
    websiteUrl:
      item.websiteUrl && !/google\.com\/maps/i.test(item.websiteUrl) ? item.websiteUrl : undefined,
  };
}

/**
 * candidates が空のときは即座に no-op（disabled/mock未使用/google失敗時 = 既存MVP動作そのまま）。
 * candidates がある場合、全 item を検証し、違反（候補外 / 重複利用 / placeId無しで具体的な場所を
 * 名乗る）は安全な一般エリア表現に置き換える。best-effort — 例外は投げない。
 */
export function enforcePlaceCandidateSelection(
  days: readonly ItineraryDay[],
  candidates: readonly PlaceCandidate[],
  rawLocation: string | undefined | null,
): PlaceCandidateEnforcementResult {
  if (!Array.isArray(days) || days.length === 0 || !candidates || candidates.length === 0) {
    return { days: days as ItineraryDay[], fixesApplied: [] };
  }

  try {
    const candidateMap = new Map(candidates.map((candidate) => [candidate.placeId, candidate]));
    // AI models reliably copy human-readable names but sometimes drop/garble the opaque
    // place_id string even while correctly picking a real candidate. Falling back to an exact
    // name match (still 100% within the provided candidate list — never an invented store)
    // avoids losing placeName/placeId/rating/source for those items.
    const candidateByName = new Map(
      candidates.map((candidate) => [candidate.placeName.trim().toLowerCase(), candidate]),
    );
    const usedPlaceIds = new Set<string>();
    const normalized = normalizeDestination(rawLocation);
    const fixesApplied: string[] = [];

    const nextDays: ItineraryDay[] = days.map((day: ItineraryDay) => ({
      ...day,
      items: day.items.map((item: ItineraryItem): ItineraryItem => {
        const rawPlaceId = item.placeId?.trim() || null;
        const nameKey = item.placeName?.trim().toLowerCase();
        // Match by raw placeId (including mock: ids) or exact placeName within the candidate list.
        const candidate =
          (rawPlaceId ? candidateMap.get(rawPlaceId) : undefined) ??
          (nameKey ? candidateByName.get(nameKey) : undefined);
        const resolvedPlaceId = candidate?.placeId ?? rawPlaceId;

        if (candidate && resolvedPlaceId && !usedPlaceIds.has(resolvedPlaceId)) {
          usedPlaceIds.add(resolvedPlaceId);
          return applyValidCandidate(item, candidate);
        }

        const claimsSpecificPlace = item.isSpecificPlace !== false && Boolean(item.placeName?.trim());
        if (rawPlaceId || claimsSpecificPlace) {
          const reason =
            candidate && resolvedPlaceId && usedPlaceIds.has(resolvedPlaceId)
              ? 'duplicate_place_id'
              : rawPlaceId && !candidate
                ? 'invalid_place_id'
                : 'specific_claim_without_valid_candidate';
          fixesApplied.push(`${reason}: "${item.activity}" (placeId=${resolvedPlaceId ?? 'none'})`);
          return downgradeToGenericItem(item, normalized);
        }

        return item;
      }),
    }));

    return { days: nextDays, fixesApplied };
  } catch (error) {
    console.warn('[enforcePlaceCandidateSelection] failed, keeping original days:', error);
    return { days: days as ItineraryDay[], fixesApplied: [] };
  }
}
