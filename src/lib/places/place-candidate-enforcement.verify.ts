/**
 * enforcePlaceCandidateSelection の簡易検証。
 * プラン生成や UI には接続しない — 開発時の手動確認用。
 */

import type { ItineraryDay, ItineraryItem } from '@/types/plan';
import type { PlaceCandidate } from '@/types/place-candidate';
import { enforcePlaceCandidateSelection } from './place-candidate-enforcement';

export type VerificationCase = {
  name: string;
  passed: boolean;
  detail: string;
};

export type VerificationReport = {
  ok: boolean;
  cases: VerificationCase[];
};

function assert(name: string, condition: boolean, detail: string): VerificationCase {
  return { name, passed: condition, detail };
}

function baseItem(overrides: Partial<ItineraryItem>): ItineraryItem {
  return {
    time: '12:00',
    activity: 'テスト活動',
    placeName: 'テスト店',
    placeAddress: 'テストエリア',
    isSpecificPlace: true,
    confidence: 'medium',
    source: 'openai',
    placeId: null,
    ...overrides,
  };
}

function buildDays(items: ItineraryItem[]): ItineraryDay[] {
  return [{ dayNumber: 1, label: '1日目', theme: 'テスト', items }];
}

const CANDIDATES: PlaceCandidate[] = [
  {
    placeId: 'places/valid-1',
    placeName: '広蔵市場',
    rating: 4.3,
    reviewCount: 12500,
    address: 'Seoul, Korea',
    category: 'food',
    city: 'Seoul',
    country: 'Korea',
    source: 'google_places',
    confidence: 'high',
  },
  {
    placeId: 'places/valid-2',
    placeName: '景福宮',
    rating: 4.6,
    reviewCount: 28400,
    address: 'Seoul, Korea',
    category: 'sightseeing',
    city: 'Seoul',
    country: 'Korea',
    source: 'google_places',
    confidence: 'high',
  },
];

export function runPlaceCandidateEnforcementVerification(): VerificationReport {
  const cases: VerificationCase[] = [];

  // 1. candidates が空 → 完全に no-op（既存MVP動作を維持）。
  const noCandidatesInput = buildDays([baseItem({ activity: '発明された店', placeName: '実在しない店', placeId: null })]);
  const noCandidatesResult = enforcePlaceCandidateSelection(noCandidatesInput, [], 'Seoul, Korea');
  cases.push(
    assert(
      'empty_candidates_is_noop',
      noCandidatesResult.days[0]?.items[0]?.placeName === '実在しない店' &&
        noCandidatesResult.fixesApplied.length === 0,
      `days unchanged when candidates=[] (placeName=${noCandidatesResult.days[0]?.items[0]?.placeName})`,
    ),
  );

  // 2. 有効な未使用candidate → 確定させ、候補の実データで上書きする。
  const validPickInput = buildDays([
    baseItem({ activity: '広蔵市場でグルメ', placeName: '広蔵市場', placeId: 'places/valid-1' }),
  ]);
  const validPickResult = enforcePlaceCandidateSelection(validPickInput, CANDIDATES, 'Seoul, Korea');
  const validItem = validPickResult.days[0]?.items[0];
  cases.push(
    assert(
      'valid_candidate_is_confirmed',
      validItem?.placeId === 'places/valid-1' &&
        validItem?.isSpecificPlace === true &&
        validItem?.rating === 4.3 &&
        validPickResult.fixesApplied.length === 0,
      `item confirmed with rating=${validItem?.rating}, source=${validItem?.source}`,
    ),
  );

  // 3. 候補リストに存在しない placeId（AIの創作/幻覚） → 一般エリア表現へダウングレード。
  const hallucinatedInput = buildDays([
    baseItem({ activity: '存在しない店で食事', placeName: '存在しない店', placeId: 'places/does-not-exist' }),
  ]);
  const hallucinatedResult = enforcePlaceCandidateSelection(hallucinatedInput, CANDIDATES, 'Seoul, Korea');
  const hallucinatedItem = hallucinatedResult.days[0]?.items[0];
  cases.push(
    assert(
      'invalid_place_id_is_downgraded',
      hallucinatedItem?.isSpecificPlace === false &&
        hallucinatedItem?.placeId == null &&
        !hallucinatedItem?.placeName &&
        hallucinatedResult.fixesApplied.some((f) => f.startsWith('invalid_place_id')),
      `downgraded item: isSpecificPlace=${hallucinatedItem?.isSpecificPlace}, placeName=${hallucinatedItem?.placeName ?? 'none'}`,
    ),
  );

  // 4. placeId無しで具体的な場所を名乗る item（instructions非遵守） → ダウングレード。
  const unauthorizedClaimInput = buildDays([
    baseItem({ activity: '勝手に決めた店で食事', placeName: '勝手に決めた店', placeId: null, isSpecificPlace: true }),
  ]);
  const unauthorizedResult = enforcePlaceCandidateSelection(unauthorizedClaimInput, CANDIDATES, 'Seoul, Korea');
  const unauthorizedItem = unauthorizedResult.days[0]?.items[0];
  cases.push(
    assert(
      'unauthorized_specific_claim_is_downgraded',
      unauthorizedItem?.isSpecificPlace === false &&
        unauthorizedResult.fixesApplied.some((f) => f.startsWith('specific_claim_without_valid_candidate')),
      `downgraded item: isSpecificPlace=${unauthorizedItem?.isSpecificPlace}`,
    ),
  );

  // 5. 同じ place_id を2つのitemで使用 → 2件目はダウングレード（1trip 1回まで）。
  const duplicateInput = buildDays([
    baseItem({ activity: '広蔵市場でグルメ1', placeName: '広蔵市場', placeId: 'places/valid-1' }),
    baseItem({ activity: '広蔵市場でグルメ2', placeName: '広蔵市場', placeId: 'places/valid-1' }),
  ]);
  const duplicateResult = enforcePlaceCandidateSelection(duplicateInput, CANDIDATES, 'Seoul, Korea');
  const [firstDup, secondDup] = duplicateResult.days[0]?.items ?? [];
  cases.push(
    assert(
      'duplicate_place_id_used_once',
      firstDup?.placeId === 'places/valid-1' &&
        firstDup?.isSpecificPlace === true &&
        secondDup?.placeId == null &&
        secondDup?.isSpecificPlace === false &&
        duplicateResult.fixesApplied.some((f) => f.startsWith('duplicate_place_id')),
      `first=${firstDup?.placeId}/${firstDup?.isSpecificPlace}, second=${secondDup?.placeId ?? 'none'}/${secondDup?.isSpecificPlace}`,
    ),
  );

  // 6. 例外を投げない（不正な入力でも best-effort でフォールバック）。
  let threw = false;
  try {
    enforcePlaceCandidateSelection(
      [{ dayNumber: 1, label: '1日目', theme: '', items: [] }],
      CANDIDATES,
      undefined,
    );
  } catch {
    threw = true;
  }
  cases.push(assert('handles_empty_items_without_throw', !threw, threw ? 'threw' : 'no throw'));

  const ok = cases.every((item) => item.passed);
  return { ok, cases };
}

export function formatVerificationReport(report: VerificationReport): string {
  const lines = report.cases.map((item) => `${item.passed ? 'PASS' : 'FAIL'} ${item.name}: ${item.detail}`);
  lines.unshift(report.ok ? 'ALL PASSED' : 'SOME FAILED');
  return lines.join('\n');
}
