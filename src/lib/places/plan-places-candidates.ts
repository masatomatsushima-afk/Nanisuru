/**
 * generate-plan.ts と Places モジュールの接続点。
 *
 * - デフォルト（EXPO_PUBLIC_PLACES_MODE 未設定 = disabled）では何もせず、
 *   既存の generate-plan の挙動を一切変えない（candidates が空 = 後段の enforcement も no-op）。
 * - mode=mock / google のときのみ、destination / baseArea を検索条件に反映して
 *   rating・reviewCount・distance・category・openingHours で並び替えた上位10件を取得し、
 *   OpenAIには「この候補だけから選ぶ」前提のJSON付きプロンプトを渡す。
 * - 失敗しても例外を投げない（プロンプトセクションを付けずに既存フローへ自動フォールバック）。
 */

import type { PlanInput } from '@/lib/prompts';
import { normalizeAccommodationFields } from '@/lib/accommodation-input';
import { resolveDestinationDetailsFromPlanInput } from '@/lib/destination-detail-input';
import type { PlaceCategory } from '@/lib/destination-safety';
import type { PlaceCandidate } from '@/types/place-candidate';
import { pickTopPlaceCandidates } from './place-candidate-ranking';
import type { PlaceRankingContext } from './place-ranking-context';
import { searchPlacesSafe } from './places-search-service';
import type { PlacesSearchInput } from './places-search-input';

const MAX_CANDIDATES_FOR_PROMPT = 10;

const ALL_CATEGORIES: PlaceCategory[] = ['food', 'cafe', 'sightseeing', 'shopping', 'nightlife', 'activity'];

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
    categories: ALL_CATEGORIES,
    limit: MAX_CANDIDATES_FOR_PROMPT,
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
  const json = JSON.stringify(candidates.map(toPromptCandidate), null, 2);

  return (
    '【Google Places候補リスト・絶対厳守】以下のJSONはGoogle Placesから取得した実在確認済みの候補です。' +
    'これ以外の店名・施設名を書くことは禁止です。\n' +
    'ルール:\n' +
    '1. 具体的な店名・施設名を書く場合は、必ず下のリストの中から選ぶこと。リストに無い店名を創作・想像で書いてはならない。\n' +
    '2. 選んだ候補の "place_id" を、そのitemのplaceIdフィールドにそのまま入れること（改変・省略しない）。\n' +
    '3. 各place_idは旅行全体で最大1回まで使用できる。同じplace_idを2つ以上のitemで使わないこと。\n' +
    '4. リストの中に該当する項目が無い場合は、店名を創作する代わりに一般的なエリア表現（例:「◯◯エリアを散策」）を使い、placeIdは空文字にすること。\n' +
    '5. placeNameには、選んだ候補の"name"の値をそのまま使うこと（表記を変えない）。\n' +
    '候補リスト（JSON）:\n' +
    json
  );
}

/**
 * 例外を投げない安全な入口。EXPO_PUBLIC_PLACES_MODE が disabled、または候補0件のときは
 * 即座に空を返す（= 既存の generate-plan 挙動・後段の enforcement は両方 no-op）。
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
      categories: ALL_CATEGORIES,
      preferOpenNow: true,
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
