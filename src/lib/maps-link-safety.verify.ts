/**
 * Maps link safety verify — run via npm run verify:maps-link-safety
 */

import assert from 'node:assert';

import {
  buildSafeMapsSearchQuery,
  canOfferDirectionsForItem,
  hasValidCoordinates,
  isValidGooglePlaceId,
  resolveItineraryMapsLink,
  sanitizePlaceId,
  urlLooksBrokenForMaps,
} from './maps-link-safety';
import type { ItineraryItem } from '@/types/plan';
import { enforcePlaceCandidateSelection } from './places/place-candidate-enforcement';
import type { PlaceCandidate } from '@/types/place-candidate';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`PASS: ${name}`);
}

function item(overrides: Partial<ItineraryItem>): ItineraryItem {
  return {
    time: '12:00',
    activity: 'テスト',
    ...overrides,
  };
}

check('A valid placeId → place_id URL, no invalid tokens', () => {
  const link = resolveItineraryMapsLink(
    item({
      placeId: 'ChIJu2-1O1eZfDURH_AZTLKhUQs',
      placeName: 'Cafe Onion',
      mapsQuery: 'Cafe Onion Seongsu Seoul Korea',
      isSpecificPlace: true,
      source: 'google_places',
    }),
    '韓国',
  );
  assert.ok(link);
  assert.strictEqual(link!.type, 'place_id');
  assert.ok(link!.url.includes('query_place_id='));
  assert.ok(!urlLooksBrokenForMaps(link!.url));
  assert.ok(!/undefined|null|NaN/i.test(link!.url));
});

check('B no placeId + valid coords → coordinates URL', () => {
  const link = resolveItineraryMapsLink(
    item({
      placeId: null,
      placeName: 'Cafe Onion',
      coordinates: { latitude: 37.5445, longitude: 127.0557 },
      isSpecificPlace: true,
      source: 'google_places',
    }),
  );
  assert.ok(link);
  assert.strictEqual(link!.type, 'coordinates');
  assert.ok(link!.url.includes('37.5445'));
  assert.ok(!urlLooksBrokenForMaps(link!.url));
});

check('C name + city/country text search', () => {
  const link = resolveItineraryMapsLink(
    item({
      placeId: null,
      placeName: 'Cafe Onion',
      mapsQuery: 'Cafe Onion Seongsu Seoul Korea',
      isSpecificPlace: true,
      source: 'openai',
    }),
  );
  assert.ok(link);
  assert.strictEqual(link!.type, 'text_search');
  assert.ok(decodeURIComponent(link!.url).includes('Cafe Onion'));
  assert.ok(decodeURIComponent(link!.url).includes('Seoul'));
});

check('D null/undefined/NaN coords → no broken URL', () => {
  assert.strictEqual(hasValidCoordinates(null, null), false);
  assert.strictEqual(hasValidCoordinates(undefined, undefined), false);
  assert.strictEqual(hasValidCoordinates(NaN, NaN), false);
  assert.strictEqual(hasValidCoordinates('undefined', 'null'), false);
  assert.strictEqual(hasValidCoordinates(0, 0), false);
  assert.strictEqual(sanitizePlaceId('undefined'), null);
  assert.strictEqual(sanitizePlaceId('null'), null);
  assert.strictEqual(isValidGooglePlaceId('mock:seoul:cafe'), false);

  const link = resolveItineraryMapsLink(
    item({
      placeId: 'undefined',
      latitude: NaN as unknown as number,
      longitude: undefined,
      placeName: undefined,
      mapsQuery: undefined,
      isSpecificPlace: false,
      source: 'fallback',
    }),
  );
  assert.strictEqual(link, null);
});

check('E abstract spot → no directions', () => {
  const abstract = item({
    activity: '聖水エリアを散策',
    isSpecificPlace: false,
    source: 'fallback',
    mapsQuery: 'Seongsu Seoul Korea',
    placeId: null,
  });
  assert.strictEqual(canOfferDirectionsForItem(abstract), false);
});

check('F Places rebind keeps coords + placeId data path', () => {
  const candidates: PlaceCandidate[] = [
    {
      placeId: 'ChIJu2-1O1eZfDURH_AZTLKhUQs',
      placeName: 'Cafe Onion',
      coordinates: { lat: 37.5445, lng: 127.0557 },
      address: 'Seongsu, Seoul',
      area: 'Seongsu',
      city: 'Seoul',
      country: 'Korea',
      category: 'cafe',
      source: 'google_places',
      confidence: 'high',
    },
  ];
  const days = [
    {
      dayNumber: 1,
      label: '1日目',
      theme: 't',
      items: [
        item({
          activity: 'Cafe Onionで休憩',
          placeName: 'Cafe Onion',
          placeId: 'garbled-by-openai',
          isSpecificPlace: true,
          source: 'openai',
        }),
      ],
    },
  ];
  const result = enforcePlaceCandidateSelection(days, candidates, 'ソウル, 韓国');
  const next = result.days[0].items[0];
  assert.strictEqual(next.source, 'google_places');
  assert.strictEqual(next.placeId, 'ChIJu2-1O1eZfDURH_AZTLKhUQs');
  assert.ok(next.coordinates);
  assert.strictEqual(next.coordinates!.latitude, 37.5445);
  assert.strictEqual(next.isSpecificPlace, true);
  assert.ok(next.mapsQuery?.includes('Cafe Onion'));
  assert.ok(next.mapsQuery?.includes('Seoul'));

  const link = resolveItineraryMapsLink(next, '韓国');
  assert.ok(link);
  assert.strictEqual(link!.type, 'place_id');
});

check('G mock placeId falls back to coordinates, never query_place_id=mock', () => {
  const link = resolveItineraryMapsLink(
    item({
      placeId: 'mock:seoul:cafe-onion',
      placeName: 'Cafe Onion',
      coordinates: { latitude: 37.5445, longitude: 127.0557 },
      mapsQuery: 'Cafe Onion Seongsu Seoul Korea',
      isSpecificPlace: true,
      source: 'google_places',
    }),
  );
  assert.ok(link);
  assert.strictEqual(link!.type, 'coordinates');
  assert.ok(!link!.url.includes('query_place_id=mock'));
});

check('safe search query requires more than bare name', () => {
  assert.strictEqual(
    buildSafeMapsSearchQuery({ placeName: 'Cafe Onion' }),
    null,
  );
  assert.ok(
    buildSafeMapsSearchQuery({
      placeName: 'Cafe Onion',
      city: 'Seoul',
      country: 'Korea',
    })?.includes('Seoul'),
  );
});

console.log(`\nverify:maps-link-safety — ${passed} PASS`);
