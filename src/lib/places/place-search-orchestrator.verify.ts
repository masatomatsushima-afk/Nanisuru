/**
 * PlaceSearchOrchestrator の単体検証（Node.js / tsx で直接実行可能）。
 * 実際の Google Places 通信は行わず、モックの検索関数（executor）を注入して検証する。
 * `npm run verify:place-search-orchestrator` から実行する。
 */

import assert from 'node:assert';
import {
  MAX_API_CALLS_PER_TRIP,
  MAX_CONCURRENT_SEARCHES,
  MAX_FINAL_CANDIDATE_POOL,
  runPlaceSearchOrchestration,
} from './place-search-orchestrator';
import type { PlaceSearchIntent } from './place-search-intent';
import type { PlaceCandidate } from '@/types/place-candidate';
import type { PlacesSearchInput } from './places-search-input';

function intent(overrides: Partial<PlaceSearchIntent>): PlaceSearchIntent {
  return {
    intentId: 'morning:food',
    dayIndex: null,
    timeSlot: 'morning',
    category: 'food',
    query: 'breakfast restaurants',
    destinationLabel: 'Seoul, South Korea',
    city: 'Seoul',
    country: 'South Korea',
    baseArea: '明洞',
    desiredCount: 5,
    requiredSpecificPlace: true,
    ...overrides,
  };
}

function candidate(placeId: string, overrides: Partial<PlaceCandidate> = {}): PlaceCandidate {
  return { placeId, placeName: `店舗${placeId}`, source: 'google_places', category: 'food', ...overrides };
}

let passed = 0;
async function check(name: string, fn: () => void | Promise<void>): Promise<void> {
  await fn();
  passed += 1;
  console.log(`PASS: ${name}`);
}

async function run(): Promise<void> {
  await check('gathers candidates from multiple intents and dedups by placeId', async () => {
    const intents = [
      intent({ intentId: 'a', category: 'food' }),
      intent({ intentId: 'b', category: 'cafe' }),
      intent({ intentId: 'c', category: 'sightseeing' }),
    ];
    let calls = 0;
    const result = await runPlaceSearchOrchestration(intents, async () => {
      calls += 1;
      return [candidate('shared'), candidate(`unique-${calls}`)];
    });
    assert.ok(result.candidates.length >= 4, `expected several unique candidates, got ${result.candidates.length}`);
    assert.strictEqual(
      result.candidates.filter((c) => c.placeId === 'shared').length,
      1,
      'the same placeId returned by multiple intents must be de-duplicated to 1',
    );
    assert.strictEqual(result.uniqueCandidateCount, result.candidates.length);
  });

  await check('never exceeds MAX_API_CALLS_PER_TRIP even with more intents + broadening', async () => {
    const intents = Array.from({ length: 12 }, (_, i) => intent({ intentId: `intent-${i}`, category: 'food' }));
    let calls = 0;
    const result = await runPlaceSearchOrchestration(intents, async () => {
      calls += 1;
      return []; // force every intent to look "weak" so broadening stages are attempted too
    });
    assert.ok(result.apiCallCount <= MAX_API_CALLS_PER_TRIP, `apiCallCount ${result.apiCallCount} > ${MAX_API_CALLS_PER_TRIP}`);
    assert.ok(calls <= MAX_API_CALLS_PER_TRIP, `executor invoked ${calls} times > ${MAX_API_CALLS_PER_TRIP}`);
  });

  await check('respects MAX_CONCURRENT_SEARCHES (no more than N in-flight at once)', async () => {
    const intents = Array.from({ length: 6 }, (_, i) => intent({ intentId: `intent-${i}` }));
    let inFlight = 0;
    let maxInFlight = 0;
    const result = await runPlaceSearchOrchestration(intents, async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return [candidate(`c-${inFlight}-${Math.random()}`)];
    });
    assert.ok(maxInFlight <= MAX_CONCURRENT_SEARCHES, `max concurrent in-flight searches was ${maxInFlight}`);
    assert.ok(result.candidates.length > 0);
  });

  await check('broadens (stage2/stage3) a weak intent when call budget allows, using a different query', () => {
    const intents = [intent({ intentId: 'weak', category: 'food' })];
    const seenQueries: string[] = [];
    return runPlaceSearchOrchestration(intents, async (input: PlacesSearchInput) => {
      seenQueries.push(input.query ?? '');
      // Stage 1 returns 0 results -> should trigger stage2/stage3 broadening.
      return [];
    }).then((result) => {
      assert.ok(seenQueries.length >= 2, 'a weak intent should be retried with a broader query');
      assert.ok(result.apiCallCount <= MAX_API_CALLS_PER_TRIP);
    });
  });

  await check('final candidate pool never exceeds MAX_FINAL_CANDIDATE_POOL', async () => {
    const intents = Array.from({ length: 8 }, (_, i) => intent({ intentId: `intent-${i}` }));
    const result = await runPlaceSearchOrchestration(intents, async () => {
      return Array.from({ length: 5 }, (_, i) => candidate(`p-${Math.random()}-${i}`));
    });
    assert.ok(result.candidates.length <= MAX_FINAL_CANDIDATE_POOL);
  });

  await check('a single failing executor call does not abort the whole orchestration', async () => {
    const intents = [intent({ intentId: 'ok' }), intent({ intentId: 'fails', category: 'cafe' })];
    const result = await runPlaceSearchOrchestration(intents, async (input) => {
      if (input.category === 'cafe') throw new Error('simulated network failure');
      return [candidate('ok-candidate')];
    });
    assert.ok(result.candidates.some((c) => c.placeId === 'ok-candidate'));
  });

  console.log(`\n[place-search-orchestrator.verify] ${passed} checks passed.`);
}

run().catch((error) => {
  console.error('[place-search-orchestrator.verify] FAILED', error);
  process.exitCode = 1;
});
