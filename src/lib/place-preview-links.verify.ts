/**
 * Safe SNS / Maps external-link helpers verify.
 * Run: npm run verify:place-preview-links
 */

import assert from 'node:assert';

import {
  buildGoogleImagesSearchUrl,
  buildInstagramSearchUrl,
  buildSafeSocialSearchQuery,
  buildTikTokSearchUrl,
  getPlacePreviewLinks,
  isSafeSocialQuery,
  parseLocationCityCountry,
} from './place-preview-links';
import { canOfferDirectionsForItem } from './maps-link-safety';
import { getDirectionsUrlFromCurrentLocation } from './concierge-links';
import type { ItineraryItem } from '@/types/plan';

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

check('A real place builds placeName+area+city+country query', () => {
  const query = buildSafeSocialSearchQuery(
    item({
      placeName: 'Cafe Onion',
      placeAddress: 'Seongsu',
      isSpecificPlace: true,
      source: 'google_places',
      placeId: 'places/ChIJcafeonion001',
      activity: 'Cafe Onionでコーヒー',
    }),
    { city: 'Seoul', country: 'Korea' },
  );
  assert.ok(query);
  assert.ok(/Cafe Onion/i.test(query!));
  assert.ok(/Seongsu/i.test(query!));
  assert.ok(/Seoul/i.test(query!));
  assert.ok(/Korea/i.test(query!));

  const links = getPlacePreviewLinks(
    item({
      placeName: 'Cafe Onion',
      placeAddress: 'Seongsu',
      isSpecificPlace: true,
      placeId: 'places/ChIJcafeonion001',
    }),
    { city: 'Seoul', country: 'Korea' },
  );
  assert.ok(links);
  assert.ok(links!.instagram.includes('instagram.com'));
  assert.ok(links!.tiktok.includes('tiktok.com'));
  assert.ok(links!.googleImages.includes('tbm=isch'));
  assert.ok(!/undefined|null|NaN/.test(links!.instagram));
});

check('A mapsQuery used when composed query is weak but mapsQuery is strong', () => {
  const query = buildSafeSocialSearchQuery(
    item({
      placeName: undefined,
      mapsQuery: 'Gwangjang Market Seoul Korea',
      isSpecificPlace: true,
      placeId: 'places/ChIJmarket000001',
    }),
    'ソウル, 韓国',
  );
  assert.strictEqual(query, 'Gwangjang Market Seoul Korea');
});

check('B directions available only with specific + placeId/coords', () => {
  assert.strictEqual(
    canOfferDirectionsForItem(
      item({
        isSpecificPlace: true,
        placeId: 'places/ChIJmuseum00001',
        placeName: '国立中央博物館',
      }),
    ),
    true,
  );
  const url = getDirectionsUrlFromCurrentLocation(
    item({
      isSpecificPlace: true,
      placeId: 'places/ChIJmuseum00001',
      placeName: '国立中央博物館',
      mapsQuery: 'National Museum of Korea Seoul',
    }),
    35.6812,
    139.7671,
    'ソウル, 韓国',
  );
  assert.ok(url);
  assert.ok(url!.includes('maps/dir'));
  assert.ok(!/undefined|null|NaN/.test(url!));
  assert.ok(url!.includes('destination_place_id='));
});

check('C abstract / free-time hides SNS and directions', () => {
  const abstract = item({
    activity: '聖水エリアで自由時間',
    isSpecificPlace: false,
    placeName: undefined,
  });
  assert.strictEqual(getPlacePreviewLinks(abstract, 'ソウル, 韓国'), null);
  assert.strictEqual(canOfferDirectionsForItem(abstract), false);

  const weak = item({
    activity: '人気カフェ',
    placeName: '人気カフェ',
    isSpecificPlace: true,
  });
  assert.strictEqual(buildSafeSocialSearchQuery(weak, 'ソウル'), null);
});

check('D broken tokens never enter URLs', () => {
  assert.strictEqual(isSafeSocialQuery('undefined Seoul Korea'), false);
  assert.strictEqual(buildInstagramSearchUrl('null'), null);
  assert.strictEqual(buildTikTokSearchUrl(''), null);
  assert.strictEqual(buildGoogleImagesSearchUrl('Cafe Onion'), null); // too weak

  const badDirections = getDirectionsUrlFromCurrentLocation(
    item({ isSpecificPlace: true, placeId: 'undefined' }),
    Number.NaN,
    139,
    'ソウル',
  );
  assert.strictEqual(badDirections, null);
});

check('E location parse + transit excluded', () => {
  assert.deepStrictEqual(parseLocationCityCountry('ソウル, 韓国'), {
    city: 'ソウル',
    country: '韓国',
  });
  assert.strictEqual(
    canOfferDirectionsForItem(
      item({
        activityCategory: '移動',
        isSpecificPlace: true,
        placeId: 'places/ChIJtransit0001',
      }),
    ),
    false,
  );
});

console.log(`\nverify:place-preview-links — ${passed} PASS`);
