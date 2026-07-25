/**
 * generate-plan.ts と Places モジュールの接続点。
 *
 * - デフォルト（EXPO_PUBLIC_PLACES_MODE 未設定 = disabled）では何もせず、
 *   既存の generate-plan の挙動を一切変えない（candidates が空 = 後段の enforcement も no-op）。
 * - mode=mock / google のときは、selectedPurposes + Trip DNA から複数の検索意図を作り、
 *   意図ごとに Google Places を検索してから 1つの候補プールへ束ねる。
 * - 目的ごとの候補が 0 件なら、別 query で再検索する。
 * - 失敗しても例外を投げない。
 */

import type { PlanInput } from '@/lib/prompts';
import { normalizeAccommodationFields } from '@/lib/accommodation-input';
import { resolveDestinationDetailsFromPlanInput } from '@/lib/destination-detail-input';
import type { PlaceCategory } from '@/lib/destination-safety';
import { getPlacesSearchCategories, resolveTripDnaOrDefault } from '@/lib/trip-dna/trip-dna-engine';
import type { PlaceCandidate } from '@/types/place-candidate';
import { resolvePlacesMode } from './get-places-provider';
import { pickTopPlaceCandidates } from './place-candidate-ranking';
import type { PlaceRankingContext, PlaceWeatherFitContext } from './place-ranking-context';
import {
  buildPlaceSearchIntents,
  buildPurposeRetryIntents,
  countCandidatesByPurpose,
  type PlaceSearchIntent,
} from './place-search-intent';
import { runPlaceSearchOrchestration } from './place-search-orchestrator';

/** OpenAIへ渡す最終候補数（候補プール自体はこれより大きく保つ — orchestrator 側で最大30件）。 */
const MAX_CANDIDATES_FOR_PROMPT = 16;

const ALL_CATEGORIES: PlaceCategory[] = ['food', 'cafe', 'sightseeing', 'shopping', 'nightlife', 'activity'];

export type PlanPlaceCandidatesResult = {
  candidates: PlaceCandidate[];
  /** null の場合はプロンプトに何も追加しない（=既存動作のまま）。 */
  promptSection: string | null;
  /** dev診断用（安全な件数のみ・秘密情報なし）。API未接続時は undefined。 */
  diagnostics?: {
    searchIntentCount: number;
    intentCategories: string[];
    candidatesPerIntent: Record<string, number>;
    candidateCountByPurpose: Record<string, number>;
    totalCandidatesBeforeDedup: number;
    uniqueCandidateCount: number;
    apiCallCount: number;
    candidatesPassedToOpenAI: number;
    purposeRetryTriggered: boolean;
  };
};

const EMPTY_RESULT: PlanPlaceCandidatesResult = { candidates: [], promptSection: null };

type DestinationForSearch = {
  destination: string;
  city?: string;
  country?: string;
  baseArea?: string;
};

function resolveDestinationForSearch(input: PlanInput): DestinationForSearch | null {
  const destinationDetails = resolveDestinationDetailsFromPlanInput(input);
  const accommodation = normalizeAccommodationFields(input.accommodation ?? input.accommodationArea);
  const baseArea = destinationDetails.baseArea?.trim() || accommodation.accommodation?.trim() || undefined;
  const destination = destinationDetails.destinationLabel?.trim() || input.location?.trim() || '';

  if (!destination) return null;

  return {
    destination,
    city: destinationDetails.city,
    country: destinationDetails.country,
    baseArea,
  };
}

type PromptCandidate = {
  place_id: string;
  name: string;
  rating: number | null;
  reviewCount: number | null;
  category: string | null;
  address: string | null;
  openNow: boolean | null;
};

function toPromptCandidate(candidate: PlaceCandidate): PromptCandidate {
  return {
    place_id: candidate.placeId,
    name: candidate.placeName,
    rating: candidate.rating ?? null,
    reviewCount: candidate.reviewCount ?? null,
    category: candidate.category ?? null,
    address: candidate.address ?? null,
    openNow: candidate.openingHours?.isOpenNow ?? null,
  };
}

function buildPlaceCandidatesPromptSection(candidates: PlaceCandidate[]): string {
  const json = JSON.stringify(candidates.map(toPromptCandidate));

  return (
    '【Google Places候補リスト・絶対厳守】以下のJSONはGoogle Placesから取得した実在確認済みの候補です。' +
    'これ以外の店名・施設名を書くことは禁止です。\n' +
    'ルール:\n' +
    '1. 具体的な店名・施設名を書く場合は、必ず下のリストの中から選ぶこと。リストに無い店名を創作・想像で書いてはならない。\n' +
    '2. 選んだ候補の "place_id" を、そのitemのplaceIdフィールドにそのまま入れること（改変・省略しない）。\n' +
    '3. 各place_idは旅行全体で最大1回まで使用できる。同じplace_idを2つ以上のitemで使わないこと。\n' +
    '4. リストの中に該当する項目が無い場合は、店名を創作する代わりに一般的なエリア表現（例:「◯◯エリアで自由時間」）を使い、placeIdは空文字にすること。\n' +
    '5. placeNameには、選んだ候補の"name"の値をそのまま使うこと（表記を変えない）。予定タイトル（activity）も原則その店名のみにすること。\n' +
    '6. category（food/cafe/sightseeing/shopping/nightlife/activity）を参考に、朝食・カフェ枠には' +
    'food/cafe、観光枠にはsightseeing、買い物枠にはshopping、ナイトライフ枠にはnightlifeの候補を優先して割り当てること。\n' +
    '7. 「日本・大阪（難波拠点）で〇〇を楽しむ」のような抽象タイトルは禁止。\n' +
    '候補リスト（JSON）:\n' +
    json
  );
}

function mergeUniqueCandidates(
  primary: readonly PlaceCandidate[],
  extra: readonly PlaceCandidate[],
): PlaceCandidate[] {
  const byId = new Map<string, PlaceCandidate>();
  for (const candidate of [...primary, ...extra]) {
    if (candidate.placeId) byId.set(candidate.placeId, candidate);
  }
  return Array.from(byId.values());
}

/**
 * 例外を投げない安全な入口。EXPO_PUBLIC_PLACES_MODE が disabled、または候補0件のときは
 * 即座に空を返す（= 既存の generate-plan 挙動・後段の enforcement は両方 no-op）。
 */
export async function fetchPlaceCandidatesForPlanPrompt(
  input: PlanInput,
  options?: { weatherFit?: PlaceWeatherFitContext },
): Promise<PlanPlaceCandidatesResult> {
  try {
    if (resolvePlacesMode() === 'disabled') return EMPTY_RESULT;

    const destination = resolveDestinationForSearch(input);
    if (!destination) return EMPTY_RESULT;

    const selectedPurposes = input.selectedPurposes ?? [];
    const dna = resolveTripDnaOrDefault({
      personality: input.personality,
      companion: input.companion,
      mood: input.mood,
      travelIntent: input.travelIntent,
      customPreferences: input.customPreferences,
      selectedPurposes,
    });

    const searchDestination = {
      destinationLabel: destination.destination,
      city: destination.city,
      country: destination.country,
      baseArea: destination.baseArea,
    };

    const intents: PlaceSearchIntent[] = buildPlaceSearchIntents(dna, searchDestination, {
      selectedPurposes,
    });

    if (intents.length === 0) return EMPTY_RESULT;

    let orchestration = await runPlaceSearchOrchestration(intents);
    let allCandidates = orchestration.candidates;
    let purposeRetryTriggered = false;

    let candidateCountByPurpose = countCandidatesByPurpose(allCandidates, selectedPurposes);
    const missingPurposes = selectedPurposes
      .map((purpose) => purpose.purpose)
      .filter((purposeId) => (candidateCountByPurpose[purposeId] ?? 0) === 0);

    if (missingPurposes.length > 0) {
      const usedIds = new Set(intents.map((intent) => intent.intentId));
      const retryIntents: PlaceSearchIntent[] = [];
      for (const purposeId of missingPurposes) {
        retryIntents.push(...buildPurposeRetryIntents(purposeId, searchDestination, usedIds, 2));
      }

      if (retryIntents.length > 0) {
        purposeRetryTriggered = true;
        const retryResult = await runPlaceSearchOrchestration(retryIntents);
        allCandidates = mergeUniqueCandidates(allCandidates, retryResult.candidates);
        orchestration = {
          ...orchestration,
          candidates: allCandidates,
          apiCallCount: orchestration.apiCallCount + retryResult.apiCallCount,
          totalCandidatesBeforeDedup:
            orchestration.totalCandidatesBeforeDedup + retryResult.totalCandidatesBeforeDedup,
          uniqueCandidateCount: allCandidates.length,
          candidatesPerIntent: {
            ...orchestration.candidatesPerIntent,
            ...retryResult.candidatesPerIntent,
          },
        };
        candidateCountByPurpose = countCandidatesByPurpose(allCandidates, selectedPurposes);
      }
    }

    if (__DEV__) {
      console.log('[Places] search orchestration result', {
        searchIntentCount: intents.length,
        intentCategories: intents.map((intent) => `${intent.timeSlot}:${intent.category}`),
        candidatesPerIntent: orchestration.candidatesPerIntent,
        candidateCountByPurpose,
        purposeRetryTriggered,
        totalCandidatesBeforeDedup: orchestration.totalCandidatesBeforeDedup,
        uniqueCandidateCount: orchestration.uniqueCandidateCount,
        apiCallCount: orchestration.apiCallCount,
      });
    }

    if (allCandidates.length === 0) return EMPTY_RESULT;

    const rankingContext: PlaceRankingContext = {
      destinationLabel: destination.destination,
      city: destination.city,
      country: destination.country,
      baseArea: destination.baseArea,
      categories: getPlacesSearchCategories(dna) ?? ALL_CATEGORIES,
      preferOpenNow: true,
      weatherFit: options?.weatherFit,
    };

    const ranked = pickTopPlaceCandidates(allCandidates, rankingContext, MAX_CANDIDATES_FOR_PROMPT);
    if (__DEV__) {
      console.log('[Places] ranked candidates for OpenAI', {
        uniqueCandidateCount: allCandidates.length,
        candidatesPassedToOpenAI: ranked.length,
        candidateCountByPurpose: countCandidatesByPurpose(ranked, selectedPurposes),
        weatherFitApplied: Boolean(options?.weatherFit),
      });
    }
    if (ranked.length === 0) return EMPTY_RESULT;

    return {
      candidates: ranked,
      promptSection: buildPlaceCandidatesPromptSection(ranked),
      diagnostics: {
        searchIntentCount: intents.length,
        intentCategories: intents.map((intent) => `${intent.timeSlot}:${intent.category}`),
        candidatesPerIntent: orchestration.candidatesPerIntent,
        candidateCountByPurpose,
        totalCandidatesBeforeDedup: orchestration.totalCandidatesBeforeDedup,
        uniqueCandidateCount: orchestration.uniqueCandidateCount,
        apiCallCount: orchestration.apiCallCount,
        candidatesPassedToOpenAI: ranked.length,
        purposeRetryTriggered,
      },
    };
  } catch (error) {
    console.warn('[fetchPlaceCandidatesForPlanPrompt] failed, continuing without candidates:', error);
    return EMPTY_RESULT;
  }
}
