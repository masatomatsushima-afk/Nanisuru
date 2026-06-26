import { flattenItineraryDays } from '@/lib/trip-duration';
import type { PublicPlanCategory } from '@/types/public-plan';
import type { CompanionOption, PersonalityOption, TripDurationOption } from '@/types/plan';
import type { SavedTripPayload } from '@/types/trip';

export type DiscoverSamplePlan = {
  id: string;
  title: string;
  description: string;
  category: PublicPlanCategory;
  tags: string[];
  gradientStart: string;
  gradientEnd: string;
  emoji: string;
  previewLikeCount: number;
  previewSaveCount: number;
  creatorDisplayName: string;
  payload: SavedTripPayload;
};

type SampleSpot = {
  time: string;
  name: string;
  reason: string;
  cost: string;
};

function buildSamplePayload(input: {
  location: string;
  budget: string;
  currency: SavedTripPayload['currency'];
  people: string;
  mood: string;
  companion: CompanionOption;
  personality: PersonalityOption;
  tripDuration: TripDurationOption;
  totalBudget: string;
  theme: string;
  highlights: string[];
  rainyAlternatives?: string[];
  spots: SampleSpot[];
}): SavedTripPayload {
  const days = [
    {
      dayNumber: 1,
      label: '1日目',
      theme: input.theme,
      items: input.spots.map((spot) => ({
        time: spot.time,
        activity: spot.name,
        reason: spot.reason,
        estimatedCost: spot.cost,
      })),
    },
  ];

  return {
    location: input.location,
    budget: input.budget,
    currency: input.currency,
    people: input.people,
    mood: input.mood,
    companion: input.companion,
    personality: input.personality,
    tripDuration: input.tripDuration,
    days,
    items: flattenItineraryDays(days),
    details: {
      totalBudget: input.totalBudget,
      duration: input.tripDuration,
      tripDuration: input.tripDuration,
      highlights: input.highlights,
      rainyDayAlternatives: input.rainyAlternatives ?? [],
      plannerMessage: 'Nanisuruのサンプルプランです。自分用に編集して、あなただけの行程にカスタマイズできます。',
    },
  };
}

export const DISCOVER_SAMPLE_PLANS: DiscoverSamplePlan[] = [
  {
    id: 'osaka-night-date',
    title: '大阪・夜デートプラン',
    description:
      '道頓堀のネオンから梅田スカイビルまで。夜景とグルメを楽しむ、大人の夜デートコース。',
    category: 'デート',
    tags: ['デート', '夜景', 'グルメ', '低予算'],
    gradientStart: '#312E81',
    gradientEnd: '#7C3AED',
    emoji: '🌃',
    previewLikeCount: 128,
    previewSaveCount: 54,
    creatorDisplayName: 'Nanisuruサンプル',
    payload: buildSamplePayload({
      location: '大阪',
      budget: '15000',
      currency: 'JPY',
      people: '2',
      mood: 'ワクワク',
      companion: 'カップル',
      personality: '映え重視',
      tripDuration: '1日',
      totalBudget: '約 ¥15,000（2人）',
      theme: 'ネオンと夜景の夜デート',
      highlights: ['道頓堀のライトアップ', '梅田スカイビルからの夜景', '地元グルメ'],
      spots: [
        { time: '17:00', name: '心斎橋でショッピング', reason: 'デートの導入にぴったり', cost: '¥3,000' },
        { time: '19:00', name: '道頓堀たこ焼き＆お好み焼き', reason: '大阪の定番をシェア', cost: '¥4,000' },
        { time: '21:00', name: '梅田スカイビル 空中庭園', reason: '360°の夜景で締めくくり', cost: '¥3,000' },
      ],
    }),
  },
  {
    id: 'melbourne-cafe-hop',
    title: 'メルボルン・カフェ巡り',
    description:
      'ランewaysのストリートアートと specialty coffee。のんびり歩きながら味わう半日プラン。',
    category: 'グルメ',
    tags: ['グルメ', 'カフェ', '散歩', '映え'],
    gradientStart: '#1E3A5F',
    gradientEnd: '#0891B2',
    emoji: '☕',
    previewLikeCount: 96,
    previewSaveCount: 41,
    creatorDisplayName: 'Nanisuruサンプル',
    payload: buildSamplePayload({
      location: 'Melbourne',
      budget: '80',
      currency: 'AUD',
      people: '2',
      mood: 'リラックス',
      companion: '友達',
      personality: 'グルメ',
      tripDuration: '半日',
      totalBudget: '約 A$80（2人）',
      theme: 'カフェとアートの午後',
      highlights: ['Hosier Lane のストリートアート', 'スペシャルティコーヒー', 'フリガニー地区散策'],
      spots: [
        { time: '10:00', name: 'Degraves Street ブランチ', reason: 'メルボルン定番の路地カフェ', cost: 'A$25' },
        { time: '12:00', name: 'Hosier Lane アート散策', reason: '写真映えスポット', cost: '無料' },
        { time: '14:00', name: 'Patricia Coffee Brewers', reason: '地元民に人気のコーヒー', cost: 'A$12' },
      ],
    }),
  },
  {
    id: 'tokyo-rainy-date',
    title: '東京・雨の日デート',
    description:
      '雨でも楽しめる屋内デート。美術館、カフェ、ショッピングを組み合わせた安心コース。',
    category: 'デート',
    tags: ['デート', '雨の日', '屋内', 'カフェ'],
    gradientStart: '#1F2937',
    gradientEnd: '#6366F1',
    emoji: '🌧️',
    previewLikeCount: 112,
    previewSaveCount: 67,
    creatorDisplayName: 'Nanisuruサンプル',
    payload: buildSamplePayload({
      location: '東京',
      budget: '12000',
      currency: 'JPY',
      people: '2',
      mood: '落ち着き',
      companion: '初デート',
      personality: 'のんびり',
      tripDuration: '1日',
      totalBudget: '約 ¥12,000（2人）',
      theme: '雨の日でも安心の屋内デート',
      highlights: ['屋内中心で移動少なめ', '会話が弾むカフェタイム', '美術館で感性を共有'],
      rainyAlternatives: ['表参道ヒルズ', '国立新美術館', '代官山蔦屋書店'],
      spots: [
        { time: '11:00', name: '国立新美術館', reason: '雨の日でも充実した時間', cost: '¥2,000' },
        { time: '13:30', name: '表参道カフェランチ', reason: '落ち着いた雰囲気で会話', cost: '¥3,500' },
        { time: '16:00', name: '代官山 蔦屋書店', reason: '本と音楽で締めくくり', cost: '¥2,000' },
      ],
    }),
  },
  {
    id: 'seoul-gourmet-trip',
    title: 'ソウル・グルメ旅',
    description:
      '広蔵市場からカロフルな弘大まで。K-フードを堪能する1日グルメ旅。',
    category: 'グルメ',
    tags: ['グルメ', '旅行', '低予算', '映え'],
    gradientStart: '#7F1D1D',
    gradientEnd: '#F97316',
    emoji: '🍜',
    previewLikeCount: 143,
    previewSaveCount: 89,
    creatorDisplayName: 'Nanisuruサンプル',
    payload: buildSamplePayload({
      location: 'ソウル',
      budget: '80000',
      currency: 'JPY',
      people: '2',
      mood: 'ワクワク',
      companion: '友達',
      personality: 'グルメ',
      tripDuration: '1日',
      totalBudget: '約 ₩80,000（2人）',
      theme: 'K-フードを巡る1日',
      highlights: ['広蔵市場の朝ごはん', '弘大のストリートフード', '夜景バーで締め'],
      spots: [
        { time: '09:00', name: '広蔵市場 ビビンパ', reason: 'ソウル朝食の定番', cost: '₩15,000' },
        { time: '13:00', name: '弘大 チキン&ビール', reason: '若者文化とグルメ', cost: '₩25,000' },
        { time: '19:00', name: '南山タワー 夜景ディナー', reason: '旅の締めくくり', cost: '₩40,000' },
      ],
    }),
  },
  {
    id: 'kyoto-slow-walk',
    title: '京都・ゆっくり散歩',
    description:
      '哲学の道から祇園まで。古都の風情を感じる、のんびり半日散歩プラン。',
    category: '旅行',
    tags: ['散歩', 'のんびり', '低予算', 'デート'],
    gradientStart: '#14532D',
    gradientEnd: '#059669',
    emoji: '🍃',
    previewLikeCount: 87,
    previewSaveCount: 38,
    creatorDisplayName: 'Nanisuruサンプル',
    payload: buildSamplePayload({
      location: '京都',
      budget: '8000',
      currency: 'JPY',
      people: '2',
      mood: '癒し',
      companion: 'カップル',
      personality: 'のんびり',
      tripDuration: '半日',
      totalBudget: '約 ¥8,000（2人）',
      theme: '古都をゆっくり歩く',
      highlights: ['哲学の道の緑', '和カフェで一息', '祇園の夕暮れ'],
      spots: [
        { time: '10:00', name: '銀閣寺 → 哲学の道', reason: '自然と歴史を感じる散歩', cost: '¥1,000' },
        { time: '13:00', name: '永観堂近く 和カフェ', reason: '抹茶スイーツで休憩', cost: '¥2,500' },
        { time: '16:00', name: '祇園 花見小路', reason: '夕暮れの風情', cost: '無料' },
      ],
    }),
  },
];

export function getDiscoverSamplePlanById(id: string): DiscoverSamplePlan | undefined {
  return DISCOVER_SAMPLE_PLANS.find((plan) => plan.id === id);
}

export function isDiscoverSamplePlanId(id: string): boolean {
  return id.startsWith('sample:') || DISCOVER_SAMPLE_PLANS.some((plan) => plan.id === id);
}
