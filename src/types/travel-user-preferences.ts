export const FAVORITE_CATEGORY_OPTIONS = [
  'グルメ',
  'カフェ',
  '自然',
  '映え',
  '買い物',
  '夜遊び',
  '温泉',
  '歴史・文化',
  'アクティビティ',
  'ローカル穴場',
] as const;

export const TRAVEL_PACE_OPTIONS = ['ゆっくり', 'ちょうどいい', '詰め込みたい'] as const;

export const WALKING_TOLERANCE_OPTIONS = [
  '歩き少なめ',
  '多少歩ける',
  'たくさん歩ける',
  '車・タクシーも使いたい',
] as const;

export const BUDGET_STYLE_OPTIONS = [
  '節約',
  '普通',
  '少し贅沢',
  '記念日は贅沢したい',
] as const;

export const AVOID_THING_OPTIONS = [
  '人混み',
  '長時間歩く',
  '高すぎる店',
  '雨に弱い場所',
  '予約必須の店',
  '早起き',
  '夜遅い予定',
] as const;

export const COMPANION_TYPE_OPTIONS = [
  '一人',
  '友達',
  'カップル',
  '家族',
  '初デート',
  '仕事仲間',
] as const;

export type FavoriteCategory = (typeof FAVORITE_CATEGORY_OPTIONS)[number];
export type TravelPace = (typeof TRAVEL_PACE_OPTIONS)[number];
export type WalkingTolerance = (typeof WALKING_TOLERANCE_OPTIONS)[number];
export type BudgetStyle = (typeof BUDGET_STYLE_OPTIONS)[number];
export type AvoidThing = (typeof AVOID_THING_OPTIONS)[number];
export type CompanionTypePreference = (typeof COMPANION_TYPE_OPTIONS)[number];

/** 好み診断で保存するユーザー設定 */
export type TravelUserPreferences = {
  favoriteCategories: string[];
  travelPace: string | null;
  walkingTolerance: string | null;
  budgetStyle: string | null;
  avoidThings: string[];
  companionTypes: string[];
  freeTextPreference: string;
  updatedAt: string;
};

export const EMPTY_TRAVEL_USER_PREFERENCES: TravelUserPreferences = {
  favoriteCategories: [],
  travelPace: null,
  walkingTolerance: null,
  budgetStyle: null,
  avoidThings: [],
  companionTypes: [],
  freeTextPreference: '',
  updatedAt: '',
};

export function hasTravelUserPreferences(prefs: TravelUserPreferences): boolean {
  return (
    prefs.favoriteCategories.length > 0 ||
    prefs.travelPace !== null ||
    prefs.walkingTolerance !== null ||
    prefs.budgetStyle !== null ||
    prefs.avoidThings.length > 0 ||
    prefs.companionTypes.length > 0 ||
    prefs.freeTextPreference.trim().length > 0
  );
}

export function summarizeTravelUserPreferences(prefs: TravelUserPreferences): string {
  const parts = [
    ...prefs.favoriteCategories.slice(0, 2),
    prefs.travelPace,
    prefs.walkingTolerance,
    prefs.budgetStyle,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : '未設定';
}

export function getTravelUserPreferenceChips(prefs: TravelUserPreferences): string[] {
  const chips = [
    ...prefs.favoriteCategories.slice(0, 3),
    prefs.travelPace,
    prefs.walkingTolerance,
    prefs.budgetStyle,
  ].filter((value): value is string => Boolean(value));
  return chips.slice(0, 4);
}
