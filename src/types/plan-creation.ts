import type { CompanionOption, PersonalityOption } from '@/types/plan';

export const PLAN_CREATION_TYPES = [
  '今日のお出かけ',
  'デートプラン',
  '旅行プラン',
  '週末プラン',
  'AIに任せる',
] as const;

export type PlanCreationType = (typeof PLAN_CREATION_TYPES)[number];

export const TRAVEL_INTENT_OPTIONS = [
  'ゆっくり観光したい',
  'グルメを楽しみたい',
  '王道スポットを回りたい',
  '穴場を巡りたい',
  '自然を楽しみたい',
  '買い物したい',
  '文化・歴史を感じたい',
  '友達と思い出を作りたい',
  '恋人と特別な旅にしたい',
  '家族で安心して楽しみたい',
] as const;

export type TravelIntentOption = (typeof TRAVEL_INTENT_OPTIONS)[number];

export const TRAVEL_INTENT_PERSONALITY: Record<TravelIntentOption, PersonalityOption> = {
  ゆっくり観光したい: 'のんびり',
  グルメを楽しみたい: 'グルメ',
  王道スポットを回りたい: '冒険家',
  穴場を巡りたい: '穴場好き',
  自然を楽しみたい: '冒険家',
  買い物したい: '映え重視',
  '文化・歴史を感じたい': 'のんびり',
  友達と思い出を作りたい: '冒険家',
  恋人と特別な旅にしたい: '映え重視',
  家族で安心して楽しみたい: 'のんびり',
};

export const TRAVEL_INTENT_COMPANION_HINT: Partial<Record<TravelIntentOption, CompanionOption>> = {
  友達と思い出を作りたい: '友達',
  恋人と特別な旅にしたい: 'カップル',
  家族で安心して楽しみたい: '家族',
};
