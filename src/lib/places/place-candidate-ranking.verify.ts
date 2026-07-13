/**
 * PlaceCandidate ランキングの簡易検証。
 * プラン生成や UI には接続しない — 開発時の手動確認用。
 */

import type { PlaceCandidate } from '@/types/place-candidate';
import { MOCK_PLACE_CANDIDATES } from './mock-places-data';
import { filterPlaceCandidates } from './place-candidate-safety';
import { rankPlaceCandidates } from './place-candidate-ranking';

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

function cloneWithPatch(
  candidate: PlaceCandidate,
  patch: Partial<PlaceCandidate>,
): PlaceCandidate {
  return { ...candidate, ...patch };
}

export function runPlaceCandidateRankingVerification(): VerificationReport {
  const cases: VerificationCase[] = [];

  const seoulContext = {
    destinationLabel: 'ソウル',
    city: 'Seoul',
    country: 'Korea',
    preferOpenNow: true,
  };

  const seoulRanked = rankPlaceCandidates(MOCK_PLACE_CANDIDATES, seoulContext);
  const seoulTopNames = seoulRanked.slice(0, 5).map((entry) => entry.candidate.placeName);
  const hasOsakaInSeoulTop = seoulRanked
    .slice(0, 8)
    .some((entry) => entry.candidate.city === 'Osaka' || entry.candidate.city === 'Tokyo');

  cases.push(
    assert(
      'seoul_excludes_other_cities',
      !hasOsakaInSeoulTop && seoulTopNames.length > 0,
      hasOsakaInSeoulTop
        ? `Seoul context included foreign city in top: ${seoulTopNames.join(', ')}`
        : `Seoul top: ${seoulTopNames.join(', ')}`,
    ),
  );

  const base = MOCK_PLACE_CANDIDATES.find((c) => c.city === 'Seoul' && c.placeName === '明洞餃子');
  if (base) {
    const lowRated = cloneWithPatch(base, { rating: 3.2, reviewCount: 120, placeId: 'mock:test:low' });
    const highRated = cloneWithPatch(base, {
      placeName: '明洞餃子 別館',
      rating: 4.8,
      reviewCount: 15000,
      placeId: 'mock:test:high',
    });

    const tieBreakRanked = rankPlaceCandidates([lowRated, highRated], {
      ...seoulContext,
      categories: ['food'],
    });

    cases.push(
      assert(
        'prefers_higher_rating_and_reviews',
        tieBreakRanked[0]?.candidate.placeId === 'mock:test:high',
        `Winner: ${tieBreakRanked[0]?.candidate.placeName} (score ${tieBreakRanked[0]?.score})`,
      ),
    );
  } else {
    cases.push({
      name: 'prefers_higher_rating_and_reviews',
      passed: false,
      detail: 'Base Seoul candidate not found',
    });
  }

  if (base) {
    const openCandidate = cloneWithPatch(base, {
      placeId: 'mock:test:open',
      openingHours: { isOpenNow: true },
    });
    const closedCandidate = cloneWithPatch(base, {
      placeName: '明洞餃子 閉店テスト',
      placeId: 'mock:test:closed',
      openingHours: { isOpenNow: false },
      rating: base.rating,
      reviewCount: base.reviewCount,
    });

    const hoursRanked = rankPlaceCandidates([closedCandidate, openCandidate], {
      ...seoulContext,
      preferOpenNow: true,
    });

    cases.push(
      assert(
        'deprioritizes_closed_when_prefer_open',
        hoursRanked[0]?.candidate.placeId === 'mock:test:open',
        `Winner: ${hoursRanked[0]?.candidate.placeName} (score ${hoursRanked[0]?.score})`,
      ),
    );
  }

  const messyInput: PlaceCandidate[] = [
    {
      placeId: '',
      placeName: '',
      source: 'seed',
      city: 'Seoul',
      country: 'Korea',
    },
    {
      placeId: 'mock:bad:rating',
      placeName: '評価異常テスト',
      rating: 99,
      reviewCount: 100,
      coordinates: { lat: 37.5, lng: 127.0 },
      mapsUrl: 'https://maps.example.com',
      source: 'seed',
      city: 'Seoul',
      country: 'Korea',
    },
    ...MOCK_PLACE_CANDIDATES.filter((c) => c.city === 'Seoul').slice(0, 1),
  ];

  let threw = false;
  let filteredCount = -1;
  try {
    const filtered = filterPlaceCandidates(messyInput, seoulContext);
    filteredCount = filtered.kept.length;
  } catch {
    threw = true;
  }

  cases.push(
    assert(
      'handles_incomplete_data_without_throw',
      !threw && filteredCount >= 0,
      threw ? 'filterPlaceCandidates threw' : `kept ${filteredCount} candidates`,
    ),
  );

  const ok = cases.every((item) => item.passed);
  return { ok, cases };
}

export function formatVerificationReport(report: VerificationReport): string {
  const lines = report.cases.map((item) =>
    `${item.passed ? 'PASS' : 'FAIL'} ${item.name}: ${item.detail}`,
  );
  lines.unshift(report.ok ? 'ALL PASSED' : 'SOME FAILED');
  return lines.join('\n');
}
