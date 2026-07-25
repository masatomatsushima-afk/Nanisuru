/**
 * `day-availability.ts` の単体検証（Node.js / tsx で直接実行可能・react-native依存なし）。
 * `npm run verify:day-availability` から実行する。
 */

import assert from 'node:assert';
import {
  resolveDayAvailableMinutes,
  resolveTargetItemCountForAvailableMinutes,
  resolveTargetItemCountForDay,
} from './day-availability';
import type { TravelTimingSettings } from '@/types/travel-timing';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`PASS: ${name}`);
}

// --- Bucket thresholds: short day -> 1-2, half day -> 2-3, near-full day -> 3-5 ---
check('resolveTargetItemCountForAvailableMinutes buckets are monotonic and within spec ranges', () => {
  assert.strictEqual(resolveTargetItemCountForAvailableMinutes(0), 0);
  assert.strictEqual(resolveTargetItemCountForAvailableMinutes(90), 1);
  assert.strictEqual(resolveTargetItemCountForAvailableMinutes(180), 2);
  assert.strictEqual(resolveTargetItemCountForAvailableMinutes(360), 3);
  assert.strictEqual(resolveTargetItemCountForAvailableMinutes(600), 4);
  assert.strictEqual(resolveTargetItemCountForAvailableMinutes(720), 5);
  // monotonic non-decreasing
  let prev = 0;
  for (let minutes = 0; minutes <= 900; minutes += 15) {
    const count = resolveTargetItemCountForAvailableMinutes(minutes);
    assert.ok(count >= prev, `count decreased at ${minutes}min`);
    prev = count;
  }
});

// --- No travel timing at all -> safe default day window (09:00-21:00 = 12h -> near-full day) ---
check('no travel timing -> safe default day window, unaffected by the fix', () => {
  const { availableMinutes, targetItemCount } = resolveTargetItemCountForDay({
    dayIndex: 1,
    totalDays: 3,
    travelTiming: undefined,
  });
  assert.strictEqual(availableMinutes, 12 * 60);
  assert.strictEqual(targetItemCount, 5);
});

// --- Middle day of a multi-day trip always gets the full window regardless of day 1/last-day timing ---
check('middle day is unaffected by arrival/departure — gets full day budget', () => {
  const timing: TravelTimingSettings = {
    arrivalTime: '20:00',
    departureTime: '08:00',
  };
  const { targetItemCount } = resolveTargetItemCountForDay({ dayIndex: 1, totalDays: 3, travelTiming: timing });
  assert.strictEqual(targetItemCount, 5);
});

// --- Test case A: 2N3D gourmet, LATE (evening) departure on day 3 — must NOT collapse to 1 item ---
check('scenario A: evening departure on final day allows a real multi-item day (not 1 item at 17:00)', () => {
  const timing: TravelTimingSettings = {
    arrivalTime: '14:00',
    departureTime: '21:00',
    departurePlace: '空港',
  };
  const { availableMinutes, targetItemCount } = resolveTargetItemCountForDay({
    dayIndex: 2,
    totalDays: 3,
    travelTiming: timing,
  });
  // departure 21:00 - 180min buffer = 18:00 cutoff; default day start 09:00 -> 9h available.
  assert.strictEqual(availableMinutes, 9 * 60);
  assert.ok(targetItemCount >= 3, `expected a real multi-item day, got ${targetItemCount}`);
});

// --- Test case B: 2N3D gourmet, MIDDAY departure — small budget (breakfast + move), no cram ---
check('scenario B: midday departure on final day yields a small, safe budget (breakfast + move)', () => {
  const timing: TravelTimingSettings = {
    arrivalTime: '14:00',
    departureTime: '12:00',
    departurePlace: '空港',
  };
  const { availableMinutes, targetItemCount } = resolveTargetItemCountForDay({
    dayIndex: 2,
    totalDays: 3,
    travelTiming: timing,
  });
  // departure 12:00 - 180min buffer = 09:00 cutoff; default day start 09:00 -> 0 minutes available.
  assert.strictEqual(availableMinutes, 0);
  assert.strictEqual(targetItemCount, 0);
});

// --- First day: arrivalTime is plan start (no airport buffer unless airport is explicit) ---
check('first day start uses arrivalTime directly when transport is unspecified', () => {
  const timing: TravelTimingSettings = {
    arrivalTime: '22:00',
    hotelCheckInTime: '23:00',
  };
  const { availableMinutes } = resolveTargetItemCountForDay({ dayIndex: 0, totalDays: 3, travelTiming: timing });
  // already_in_area: start=22:00, default end=21:00 → 0 available minutes.
  assert.strictEqual(availableMinutes, 0);
});

// --- Single-day trip: both arrival and departure constraints apply to the same day ---
check('single-day trip applies both arrival and departure clamps to day 0', () => {
  const timing: TravelTimingSettings = {
    arrivalTime: '09:00',
    hotelCheckInTime: '10:00',
    departureTime: '20:00',
    departurePlace: '駅',
  };
  const minutes = resolveDayAvailableMinutes({ dayIndex: 0, totalDays: 1, travelTiming: timing });
  // arrival already_in_area → start 09:00; station departure → end 19:00.
  assert.strictEqual(minutes, 19 * 60 - 9 * 60);
});

check('departureTime without place does not apply airport buffer', () => {
  const timing: TravelTimingSettings = {
    arrivalTime: '16:30',
    departureTime: '22:30',
  };
  const minutes = resolveDayAvailableMinutes({ dayIndex: 0, totalDays: 1, travelTiming: timing });
  // stay_in_area: 16:30–22:30 = 6h, no −180 airport buffer.
  assert.strictEqual(minutes, 6 * 60);
});

check('explicit airport departure still applies 180min buffer', () => {
  const timing: TravelTimingSettings = {
    arrivalTime: '09:00',
    departureTime: '21:00',
    departurePlace: '空港',
  };
  const minutes = resolveDayAvailableMinutes({ dayIndex: 0, totalDays: 1, travelTiming: timing });
  // start 09:00, end 18:00
  assert.strictEqual(minutes, 9 * 60);
});

console.log(`\n[day-availability.verify] ${passed} checks passed.`);
