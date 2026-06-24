import type { CurrencyCode } from '@/constants/currency';
import { buildGoogleMapsPlaceUrl, estimateWalkMinutes, formatDistanceLabel, haversineDistanceMeters } from '@/lib/geo';
import { inferCurrencyFromLocation } from '@/lib/location-currency';
import type { GeoCoordinates, NearbyPlace, NearbyPlaceCategory } from '@/types/nearby-places';

type StaticPlaceSeed = {
  id: string;
  name: string;
  address: string;
  category: NearbyPlaceCategory;
  categoryLabel: string;
  latitude: number;
  longitude: number;
  rating?: number;
};

type StaticCityPack = {
  id: string;
  keywords: readonly string[];
  locationLabel: string;
  coordinates: GeoCoordinates;
  geocodeAddress: string;
  inferredCurrency: CurrencyCode;
  places: readonly StaticPlaceSeed[];
};

const STATIC_CITY_PACKS: readonly StaticCityPack[] = [
  {
    id: 'tokyo',
    keywords: ['tokyo', '東京', '渋谷', '新宿', '浅草', '銀座', '原宿', '表参道', '六本木', '上野', '秋葉原'],
    locationLabel: '東京',
    coordinates: { latitude: 35.6762, longitude: 139.6503 },
    geocodeAddress: 'Tokyo, Japan',
    inferredCurrency: 'JPY',
    places: [
      { id: 'tokyo-1', name: '浅草寺', address: '東京都台東区浅草2-3-1', category: 'tourist_attraction', categoryLabel: '観光スポット', latitude: 35.7148, longitude: 139.7967, rating: 4.5 },
      { id: 'tokyo-2', name: '東京スカイツリー', address: '東京都墨田区押上1-1-2', category: 'tourist_attraction', categoryLabel: '観光スポット', latitude: 35.7101, longitude: 139.8107, rating: 4.4 },
      { id: 'tokyo-3', name: '明治神宮', address: '東京都渋谷区代々木神園町1-1', category: 'tourist_attraction', categoryLabel: '観光スポット', latitude: 35.6764, longitude: 139.6993, rating: 4.6 },
      { id: 'tokyo-4', name: '築地場外市場', address: '東京都中央区築地4-16-2', category: 'restaurant', categoryLabel: 'レストラン', latitude: 35.6654, longitude: 139.7707, rating: 4.3 },
      { id: 'tokyo-5', name: '新宿御苑', address: '東京都新宿区内藤町11', category: 'park', categoryLabel: '公園', latitude: 35.6852, longitude: 139.7100, rating: 4.5 },
      { id: 'tokyo-6', name: '表参道ヒルズ', address: '東京都渋谷区神宮前4-12-10', category: 'tourist_attraction', categoryLabel: '観光スポット', latitude: 35.6672, longitude: 139.7089, rating: 4.2 },
      { id: 'tokyo-7', name: 'ブルーボトルコーヒー 清澄白河', address: '東京都江東区平野1-8-16', category: 'cafe', categoryLabel: 'カフェ', latitude: 35.6825, longitude: 139.7986, rating: 4.3 },
      { id: 'tokyo-8', name: '東京国立博物館', address: '東京都台東区上野公園13-9', category: 'tourist_attraction', categoryLabel: '観光スポット', latitude: 35.7188, longitude: 139.7765, rating: 4.5 },
    ],
  },
  {
    id: 'osaka',
    keywords: ['osaka', '大阪', '道頓堀', '心斎橋', '梅田', '通天閣', '難波', 'USJ'],
    locationLabel: '大阪',
    coordinates: { latitude: 34.6937, longitude: 135.5023 },
    geocodeAddress: 'Osaka, Japan',
    inferredCurrency: 'JPY',
    places: [
      { id: 'osaka-1', name: '大阪城', address: '大阪府大阪市中央区大阪城1-1', category: 'tourist_attraction', categoryLabel: '観光スポット', latitude: 34.6873, longitude: 135.5262, rating: 4.4 },
      { id: 'osaka-2', name: '道頓堀', address: '大阪府大阪市中央区道頓堀', category: 'tourist_attraction', categoryLabel: '観光スポット', latitude: 34.6687, longitude: 135.5013, rating: 4.5 },
      { id: 'osaka-3', name: '通天閣', address: '大阪府大阪市浪速区恵美須東1-18-6', category: 'tourist_attraction', categoryLabel: '観光スポット', latitude: 34.6525, longitude: 135.5063, rating: 4.2 },
      { id: 'osaka-4', name: '黒門市場', address: '大阪府大阪市中央区日本橋2-4-1', category: 'restaurant', categoryLabel: 'レストラン', latitude: 34.6654, longitude: 135.5068, rating: 4.3 },
      { id: 'osaka-5', name: '心斎橋筋商店街', address: '大阪府大阪市中央区心斎橋筋', category: 'tourist_attraction', categoryLabel: '観光スポット', latitude: 34.6727, longitude: 135.5010, rating: 4.3 },
      { id: 'osaka-6', name: '万博記念公園', address: '大阪府吹田市千里万博公園', category: 'park', categoryLabel: '公園', latitude: 34.8094, longitude: 135.5339, rating: 4.4 },
      { id: 'osaka-7', name: '法善寺横丁', address: '大阪府大阪市中央区法善寺横町', category: 'bar', categoryLabel: 'バー', latitude: 34.6678, longitude: 135.5080, rating: 4.2 },
      { id: 'osaka-8', name: 'カフェ・ド・ランブル 梅田', address: '大阪府大阪市北区梅田3-1-1', category: 'cafe', categoryLabel: 'カフェ', latitude: 34.7024, longitude: 135.4959, rating: 4.1 },
    ],
  },
  {
    id: 'melbourne',
    keywords: ['melbourne', 'メルボルン', 'victoria', 'vic'],
    locationLabel: 'Melbourne',
    coordinates: { latitude: -37.8136, longitude: 144.9631 },
    geocodeAddress: 'Melbourne VIC, Australia',
    inferredCurrency: 'AUD',
    places: [
      { id: 'mel-1', name: 'Federation Square', address: 'Swanston St & Flinders St, Melbourne VIC 3000', category: 'tourist_attraction', categoryLabel: '観光スポット', latitude: -37.8180, longitude: 144.9691, rating: 4.4 },
      { id: 'mel-2', name: 'Queen Victoria Market', address: 'Queen St, Melbourne VIC 3000', category: 'restaurant', categoryLabel: 'レストラン', latitude: -37.8076, longitude: 144.9568, rating: 4.5 },
      { id: 'mel-3', name: 'Royal Botanic Gardens Victoria', address: 'Birdwood Ave, Melbourne VIC 3004', category: 'park', categoryLabel: '公園', latitude: -37.8304, longitude: 144.9796, rating: 4.7 },
      { id: 'mel-4', name: 'Hosier Lane', address: 'Hosier Ln, Melbourne VIC 3000', category: 'tourist_attraction', categoryLabel: '観光スポット', latitude: -37.8170, longitude: 144.9690, rating: 4.3 },
      { id: 'mel-5', name: "Pellegrini's Espresso Bar", address: '66 Bourke St, Melbourne VIC 3000', category: 'cafe', categoryLabel: 'カフェ', latitude: -37.8115, longitude: 144.9698, rating: 4.4 },
      { id: 'mel-6', name: 'National Gallery of Victoria', address: '180 St Kilda Rd, Melbourne VIC 3006', category: 'tourist_attraction', categoryLabel: '観光スポット', latitude: -37.8226, longitude: 144.9689, rating: 4.6 },
      { id: 'mel-7', name: 'Shrine of Remembrance', address: 'Birdwood Ave, Melbourne VIC 3001', category: 'tourist_attraction', categoryLabel: '観光スポット', latitude: -37.8305, longitude: 144.9734, rating: 4.7 },
      { id: 'mel-8', name: 'Chin Chin', address: '125 Flinders Ln, Melbourne VIC 3000', category: 'restaurant', categoryLabel: 'レストラン', latitude: -37.8155, longitude: 144.9695, rating: 4.3 },
    ],
  },
  {
    id: 'seoul',
    keywords: ['seoul', 'ソウル', 'korea', '韓国', '明洞', '江南', '弘大', '釜山'],
    locationLabel: 'ソウル',
    coordinates: { latitude: 37.5665, longitude: 126.9780 },
    geocodeAddress: 'Seoul, South Korea',
    inferredCurrency: 'KRW',
    places: [
      { id: 'seo-1', name: '景福宮', address: 'ソウル特別市鍾路区サムチョンロ161', category: 'tourist_attraction', categoryLabel: '観光スポット', latitude: 37.5796, longitude: 126.9770, rating: 4.6 },
      { id: 'seo-2', name: '北村韓屋村', address: 'ソウル特別市鍾路区ギョンデリロ', category: 'tourist_attraction', categoryLabel: '観光スポット', latitude: 37.5826, longitude: 126.9830, rating: 4.5 },
      { id: 'seo-3', name: '明洞', address: 'ソウル特別市中区明洞', category: 'tourist_attraction', categoryLabel: '観光スポット', latitude: 37.5636, longitude: 126.9869, rating: 4.4 },
      { id: 'seo-4', name: 'Nソウルタワー', address: 'ソウル特別市龍山区龍山洞2街', category: 'tourist_attraction', categoryLabel: '観光スポット', latitude: 37.5512, longitude: 126.9882, rating: 4.5 },
      { id: 'seo-5', name: '広蔵市場', address: 'ソウル特別市鍾路区昌信洞', category: 'restaurant', categoryLabel: 'レストラン', latitude: 37.5700, longitude: 126.9996, rating: 4.3 },
      { id: 'seo-6', name: '汉江市民公園', address: 'ソウル特別市永登浦区汝矣島洞', category: 'park', categoryLabel: '公園', latitude: 37.5285, longitude: 126.9327, rating: 4.5 },
      { id: 'seo-7', name: 'スターバックス 三清洞店', address: 'ソウル特別市鍾路区三清路', category: 'cafe', categoryLabel: 'カフェ', latitude: 37.5840, longitude: 126.9818, rating: 4.2 },
      { id: 'seo-8', name: '梨泰院', address: 'ソウル特別市龍山区梨泰院洞', category: 'bar', categoryLabel: 'バー', latitude: 37.5344, longitude: 126.9944, rating: 4.3 },
    ],
  },
];

function seedToNearbyPlace(seed: StaticPlaceSeed, origin: GeoCoordinates): NearbyPlace {
  const distanceMeters = haversineDistanceMeters(origin, {
    latitude: seed.latitude,
    longitude: seed.longitude,
  });

  return {
    id: seed.id,
    name: seed.name,
    address: seed.address,
    category: seed.category,
    categoryLabel: seed.categoryLabel,
    latitude: seed.latitude,
    longitude: seed.longitude,
    distanceMeters,
    distanceLabel: formatDistanceLabel(distanceMeters),
    walkMinutes: estimateWalkMinutes(distanceMeters),
    rating: seed.rating,
    mapsUrl: buildGoogleMapsPlaceUrl(seed.latitude, seed.longitude, seed.name),
  };
}

export function findStaticCityPack(location: string): StaticCityPack | null {
  const normalized = location.trim().toLowerCase();
  if (!normalized) return null;

  for (const pack of STATIC_CITY_PACKS) {
    if (pack.keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))) {
      return pack;
    }
  }

  return null;
}

export function buildStaticPlacesContext(
  pack: StaticCityPack,
  queryLocation: string,
): import('@/types/nearby-places').NearbyPlacesContext {
  const places = pack.places.map((seed) => seedToNearbyPlace(seed, pack.coordinates));

  return {
    coordinates: pack.coordinates,
    locationLabel: pack.locationLabel,
    searchedAt: new Date().toISOString(),
    places,
    geocodeAddress: pack.geocodeAddress,
    inferredCurrency: pack.inferredCurrency ?? inferCurrencyFromLocation(queryLocation),
    source: 'static',
  };
}
