import type { CurrencyCode } from '@/constants/currency';
import type { NearbyPlace } from '@/types/nearby-places';

export const AFTER_PLAN_COMPANION_TYPES = [
  '友達',
  '会社の人',
  '恋人',
  '初対面',
  '一人',
] as const;

export type AfterPlanCompanionType = (typeof AFTER_PLAN_COMPANION_TYPES)[number];

export const AFTER_PLAN_MOODS = [
  'まだ飲みたい',
  '静かに話したい',
  '盛り上がりたい',
  '締めが食べたい',
  '夜景を見たい',
  'カラオケ行きたい',
  'もう帰りたいけど少し寄りたい',
  'AIに任せる',
] as const;

export type AfterPlanMood = (typeof AFTER_PLAN_MOODS)[number];

export const AFTER_PLAN_WALK_DISTANCES = [
  '5分以内',
  '10分以内',
  '15分以内',
  'タクシーでもOK',
] as const;

export type AfterPlanWalkDistance = (typeof AFTER_PLAN_WALK_DISTANCES)[number];

export const AFTER_PLAN_ALCOHOL_OPTIONS = ['お酒あり', 'お酒なし'] as const;
export type AfterPlanAlcoholOption = (typeof AFTER_PLAN_ALCOHOL_OPTIONS)[number];

export const AFTER_PLAN_VIBE_OPTIONS = ['にぎやか', '静か', 'どちらでも'] as const;
export type AfterPlanVibeOption = (typeof AFTER_PLAN_VIBE_OPTIONS)[number];

export const AFTER_PLAN_SMOKING_OPTIONS = ['喫煙可', '禁煙希望', 'どちらでも'] as const;
export type AfterPlanSmokingOption = (typeof AFTER_PLAN_SMOKING_OPTIONS)[number];

export const AFTER_PLAN_NIGHT_CATEGORIES = [
  '2軒目バー',
  '居酒屋',
  '締めラーメン',
  '夜カフェ',
  'カラオケ',
  'ダーツバー',
  '夜景スポット',
  'コンビニ寄ってホテル',
  '終電前プラン',
] as const;

export type AfterPlanNightCategory = (typeof AFTER_PLAN_NIGHT_CATEGORIES)[number];

export const AFTER_PLAN_QUICK_CHIPS = [
  '2軒目探して',
  '静かなバー',
  '締めラーメン',
  'カラオケ',
  '夜景',
  '終電まで',
  '安く済ませたい',
  'タクシーでもOK',
] as const;

export type AfterPlanQuickChip = (typeof AFTER_PLAN_QUICK_CHIPS)[number];

export type AfterPlanInput = {
  currentLocation: string;
  currentTime: string;
  peopleCount: string;
  companionType: AfterPlanCompanionType;
  mood: AfterPlanMood;
  budget: string;
  currency: CurrencyCode;
  lastTrainTime?: string;
  destinationDirection?: string;
  walkDistance: AfterPlanWalkDistance;
  alcohol: AfterPlanAlcoholOption;
  smoking?: AfterPlanSmokingOption;
  vibe: AfterPlanVibeOption;
  quickNote?: string;
  baseTripId?: string;
  departureTime?: string;
};

export type AfterPlanOption = {
  id: string;
  title: string;
  category: AfterPlanNightCategory;
  reason: string;
  atmosphere: string;
  budgetEstimate: string;
  travelTime: string;
  lastTrainOk: string;
  placeName: string;
  placeAddress?: string;
  placeCategory?: string;
  mapsUrl?: string;
  latitude?: number;
  longitude?: number;
  safetyNote?: string;
  isNonAlcohol?: boolean;
};

export type AfterPlanResult = {
  options: AfterPlanOption[];
  safetyReminder: string;
  placesSource?: string;
  generatedAt: string;
};

export type AfterPlanRecord = {
  id: string;
  userId: string;
  baseTripId: string | null;
  currentLocation: string;
  mood: string;
  peopleCount: string;
  companionType: string;
  budget: string;
  selectedOption: AfterPlanOption;
  inputPayload: AfterPlanInput;
  isPublic: boolean;
  publicTitle: string;
  createdAt: string;
};

export type AfterPlanPlacesContext = {
  coordinates: { latitude: number; longitude: number };
  locationLabel: string;
  places: NearbyPlace[];
  openNowApplied: boolean;
};
