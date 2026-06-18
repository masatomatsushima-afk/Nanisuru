import type { CompanionOption, ItineraryItem } from '@/types/plan';

type LocationKind = 'osaka' | 'tokyo' | 'generic';

const ITINERARIES: Record<CompanionOption, Record<LocationKind, ItineraryItem[]>> = {
  一人: {
    generic: [
      { time: '10:00', activity: 'カフェ' },
      { time: '13:00', activity: '読書' },
      { time: '15:00', activity: '散歩' },
      { time: '18:00', activity: 'ラーメン' },
    ],
    tokyo: [
      { time: '10:00', activity: '浅草カフェ' },
      { time: '13:00', activity: '隅田公園で読書' },
      { time: '15:00', activity: 'スカイツリー散策' },
      { time: '18:00', activity: '浅草ラーメン' },
    ],
    osaka: [
      { time: '10:00', activity: '梅田カフェ' },
      { time: '13:00', activity: '読書' },
      { time: '15:00', activity: '道頓堀散策' },
      { time: '18:00', activity: '道頓堀ラーメン' },
    ],
  },
  友達: {
    generic: [
      { time: '10:00', activity: 'ボウリング' },
      { time: '13:00', activity: 'ランチ' },
      { time: '15:00', activity: 'ゲームセンター' },
      { time: '18:00', activity: '居酒屋' },
    ],
    tokyo: [
      { time: '10:00', activity: '渋谷ボウリング' },
      { time: '13:00', activity: '渋谷ランチ' },
      { time: '15:00', activity: '渋谷ゲームセンター' },
      { time: '18:00', activity: '渋谷居酒屋' },
    ],
    osaka: [
      { time: '10:00', activity: '梅田ボウリング' },
      { time: '13:00', activity: '道頓堀ランチ' },
      { time: '15:00', activity: '梅田ゲームセンター' },
      { time: '18:00', activity: '道頓堀居酒屋' },
    ],
  },
  カップル: {
    generic: [
      { time: '10:00', activity: 'カフェ' },
      { time: '12:00', activity: 'ランチ' },
      { time: '15:00', activity: '美術館' },
      { time: '18:00', activity: 'ディナー' },
      { time: '20:00', activity: '夜景' },
    ],
    tokyo: [
      { time: '10:00', activity: '浅草カフェ' },
      { time: '12:00', activity: '浅草ランチ' },
      { time: '15:00', activity: 'スカイツリー' },
      { time: '18:00', activity: '渋谷ディナー' },
      { time: '20:00', activity: 'スカイツリー夜景' },
    ],
    osaka: [
      { time: '10:00', activity: '梅田カフェ' },
      { time: '12:00', activity: '梅田ランチ' },
      { time: '15:00', activity: '海遊館' },
      { time: '18:00', activity: '道頓堀ディナー' },
      { time: '20:00', activity: '梅田夜景' },
    ],
  },
  初デート: {
    generic: [
      { time: '10:00', activity: 'カフェ' },
      { time: '12:00', activity: 'ランチ' },
      { time: '15:00', activity: '水族館' },
      { time: '18:00', activity: 'ディナー' },
      { time: '20:00', activity: '夜景' },
    ],
    tokyo: [
      { time: '10:00', activity: '浅草カフェ' },
      { time: '12:00', activity: '浅草ランチ' },
      { time: '15:00', activity: 'スカイツリー' },
      { time: '18:00', activity: '渋谷ディナー' },
      { time: '20:00', activity: 'スカイツリー夜景' },
    ],
    osaka: [
      { time: '10:00', activity: '梅田カフェ' },
      { time: '12:00', activity: '道頓堀ランチ' },
      { time: '15:00', activity: '海遊館' },
      { time: '18:00', activity: '道頓堀ディナー' },
      { time: '20:00', activity: '道頓堀夜景' },
    ],
  },
  家族: {
    generic: [
      { time: '10:00', activity: '公園' },
      { time: '12:00', activity: 'ランチ' },
      { time: '15:00', activity: '動物園' },
      { time: '17:00', activity: 'ショッピング' },
    ],
    tokyo: [
      { time: '10:00', activity: '浅草散策' },
      { time: '12:00', activity: '浅草ランチ' },
      { time: '15:00', activity: 'スカイツリー' },
      { time: '17:00', activity: '渋谷ショッピング' },
    ],
    osaka: [
      { time: '10:00', activity: '道頓堀散策' },
      { time: '12:00', activity: '道頓堀ランチ' },
      { time: '15:00', activity: '海遊館' },
      { time: '17:00', activity: '梅田ショッピング' },
    ],
  },
};

export const COMPANION_SUBTITLES: Record<CompanionOption, string> = {
  一人: '自分だけの時間を楽しむプラン',
  友達: 'みんなで盛り上がるプラン',
  カップル: 'ふたりの時間を大切にするプラン',
  初デート: '第一印象を大切にするプラン',
  家族: '家族みんなで楽しめるプラン',
};

function getLocationKind(location: string): LocationKind {
  if (location.includes('大阪')) return 'osaka';
  if (location.includes('東京')) return 'tokyo';
  return 'generic';
}

export function getItinerary(companion: CompanionOption, location: string): ItineraryItem[] {
  return ITINERARIES[companion][getLocationKind(location)];
}

export function getItineraryEyebrow(companion: CompanionOption, location: string): string {
  const locationLabel =
    getLocationKind(location) === 'tokyo' ? '東京' : getLocationKind(location) === 'osaka' ? '大阪' : null;
  if (locationLabel) return `${locationLabel}・${companion}のプラン`;
  return `${companion}のプラン`;
}
