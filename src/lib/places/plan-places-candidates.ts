/**
 * generate-plan.ts と Places モジュールの接続点（最小構成）。
 *
 * - デフォルト（EXPO_PUBLIC_PLACES_MODE 未設定 = disabled）では何もせず、
 *   既存の generate-plan の挙動を一切変えない。
 * - mode=google のときのみ、destination / baseArea を検索条件に反映して
 *   5〜10件の実在候補を取得し、OpenAI プロンプトに「候補リスト」として渡す。
 * - 失敗しても例外を投げない（プロンプトセクションを付けずに既存フローへ自動フォールバック）。
 */

import type { PlanInput } from '@/lib/prompts';
import { normalizeAccommodationFields } from '@/lib/accommodation-input';
import {
  resolveDestinationDetailsFromPlanInput,
} from '@/lib/destination-detail-input';
import type { PlaceCandidate } from '@/types/place-candidate';
import { pickTopPlaceCandidates } from './place-candidate-ranking';
import type { PlaceRankingContext } from './place-ranking-context';
import { searchPlacesSafe } from './places-search-service';
import type { PlacesSearchInput } from './places-search-input';

const MAX_CANDIDATES_FOR_PROMPT = 8;

export type PlanPlaceCandidatesResult = {
  candidates: PlaceCandidate[];
  /** null の場合はプロンプトに何も追加しない（=既存動作のまま）。 */
  promptSection: string | null;
};

const EMPTY_RESULT: PlanPlaceCandidatesResult = { candidates: [], promptSection: null };

function buildSearchInputFromPlanInput(input: PlanInput): PlacesSearchInput | null {
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
    accommodation: accommodation.accommodation,
    limit: MAX_CANDIDATES_FOR_PROMPT,
  };
}

function buildPlaceCandidatesPromptSection(candidates: PlaceCandidate[]): string {
  const lines = candidates.map((candidate, index) => {
    const parts = [`${index + 1}. name=${candidate.placeName}`];
    if (candidate.rating != null) parts.push(`rating=${candidate.rating}`);
    if (candidate.address) parts.push(`address=${candidate.address}`);
    return parts.join(' / ');
  });

  return (
    '【実在候補リスト・重要】以下はGoogle Placesで実在確認済みの候補です（このリスト以外の場所を否定するものではありません）。' +
    '食事・カフェ・観光・ショッピングなどのitemでは、内容に合う候補があればこのリストから1店舗だけ選び、placeNameに正確な店名を入れてください。' +
    'リストに無い店名を創作しないこと。各候補は旅行全体で1回のみ使用できます（同じ店舗名を複数のitemで使い回さないこと）。' +
    '合う候補が無い場合は、通常のルール（実在確信があるか、なければ一般的なエリア表現）に従ってください。\n' +
    lines.join('\n')
  );
}

/**
 * 例外を投げない安全な入口。EXPO_PUBLIC_PLACES_MODE が google 以外なら即座に空を返す
 * （mock/disabled のときも既存の generate-plan 挙動は変わらない）。
 */
export async function fetchPlaceCandidatesForPlanPrompt(
  input: PlanInput,
): Promise<PlanPlaceCandidatesResult> {
  try {
    const searchInput = buildSearchInputFromPlanInput(input);
    if (!searchInput) return EMPTY_RESULT;

    const result = await searchPlacesSafe(searchInput);
    if (!result.ok || result.candidates.length === 0) {
      return EMPTY_RESULT;
    }

    const rankingContext: PlaceRankingContext = {
      destinationLabel: searchInput.destination,
      city: searchInput.city,
      country: searchInput.country,
      baseArea: searchInput.baseArea,
      accommodation: searchInput.accommodation,
    };

    const ranked = pickTopPlaceCandidates(result.candidates, rankingContext, MAX_CANDIDATES_FOR_PROMPT);
    if (ranked.length === 0) return EMPTY_RESULT;

    return {
      candidates: ranked,
      promptSection: buildPlaceCandidatesPromptSection(ranked),
    };
  } catch (error) {
    console.warn('[fetchPlaceCandidatesForPlanPrompt] failed, continuing without candidates:', error);
    return EMPTY_RESULT;
  }
}
