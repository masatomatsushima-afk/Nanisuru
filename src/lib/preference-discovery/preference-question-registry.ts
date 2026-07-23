/**
 * Preference question registry (config only).
 * Adding a category/question = append a row here — do not add purpose-specific ifs in the engine.
 */

import type { PreferenceQuestion } from '@/types/preference-discovery';

/**
 * Seed questions for onboarding selection.
 * Keep the pool modest; `selectNextPreferenceQuestions` returns at most 2–4.
 */
export const PREFERENCE_QUESTION_REGISTRY: readonly PreferenceQuestion[] = [
  // --- Gourmet ---
  {
    id: 'gourmet_local_vs_famous',
    intentIds: ['gourmet'],
    dimensionId: 'local_vs_famous',
    scope: 'gourmet',
    promptKey: 'preference.gourmet.local_vs_famous',
    prompt: 'お店の雰囲気はどちらが好み？',
    choices: [
      { id: 'local', labelKey: 'preference.choice.local', label: '地元で人気の店', value: 'local' },
      { id: 'balanced', labelKey: 'preference.choice.balanced', label: 'どちらも', value: 'balanced' },
      { id: 'famous', labelKey: 'preference.choice.famous', label: '有名な定番店', value: 'famous' },
    ],
    informationValueBase: 0.9,
    planImpact: 0.95,
  },
  {
    id: 'gourmet_casual_vs_luxury',
    intentIds: ['gourmet'],
    dimensionId: 'casual_vs_luxury',
    scope: 'gourmet',
    promptKey: 'preference.gourmet.casual_vs_luxury',
    prompt: '食事のスタイルは？',
    choices: [
      { id: 'casual', labelKey: 'preference.choice.casual', label: '気軽で安い', value: 'casual' },
      { id: 'mid', labelKey: 'preference.choice.mid', label: 'おしゃれ', value: 'mid' },
      { id: 'luxury', labelKey: 'preference.choice.luxury', label: '少し贅沢', value: 'luxury' },
    ],
    informationValueBase: 0.85,
    planImpact: 0.9,
  },
  {
    id: 'gourmet_classic_vs_adventurous',
    intentIds: ['gourmet'],
    dimensionId: 'classic_vs_adventurous',
    scope: 'gourmet',
    promptKey: 'preference.gourmet.classic_vs_adventurous',
    prompt: '料理の冒険度は？',
    choices: [
      { id: 'classic', labelKey: 'preference.choice.classic', label: '定番料理', value: 'classic' },
      { id: 'mixed', labelKey: 'preference.choice.mixed', label: '少し冒険', value: 'mixed' },
      {
        id: 'adventurous',
        labelKey: 'preference.choice.adventurous',
        label: '珍しい料理',
        value: 'adventurous',
      },
    ],
    informationValueBase: 0.8,
    planImpact: 0.82,
  },
  {
    id: 'gourmet_food_formats',
    intentIds: ['gourmet'],
    dimensionId: 'food_formats',
    scope: 'gourmet',
    promptKey: 'preference.gourmet.food_formats',
    prompt: 'どんな食べ方が好き？（複数可）',
    multiSelect: true,
    choices: [
      {
        id: 'restaurant',
        labelKey: 'preference.choice.restaurant',
        label: 'レストラン',
        value: 'restaurant',
      },
      {
        id: 'market_food',
        labelKey: 'preference.choice.market_food',
        label: '市場グルメ',
        value: 'market_food',
      },
      { id: 'cafe', labelKey: 'preference.choice.cafe', label: 'カフェ', value: 'cafe' },
      { id: 'dessert', labelKey: 'preference.choice.dessert', label: 'スイーツ', value: 'dessert' },
    ],
    informationValueBase: 0.7,
    planImpact: 0.75,
  },

  // --- Shopping ---
  {
    id: 'shopping_focus',
    intentIds: ['shopping'],
    dimensionId: 'shopping_focus',
    scope: 'shopping',
    promptKey: 'preference.shopping.focus',
    prompt: '何を買いたい？（複数可）',
    multiSelect: true,
    choices: [
      {
        id: 'street_fashion',
        labelKey: 'preference.choice.street_fashion',
        label: 'ストリートファッション',
        value: 'street_fashion',
      },
      {
        id: 'local_brands',
        labelKey: 'preference.choice.local_brands',
        label: 'ローカルブランド',
        value: 'local_brands',
      },
      {
        id: 'cosmetics',
        labelKey: 'preference.choice.cosmetics',
        label: 'コスメ',
        value: 'cosmetics',
      },
      { id: 'vintage', labelKey: 'preference.choice.vintage', label: 'ヴィンテージ', value: 'vintage' },
      { id: 'luxury', labelKey: 'preference.choice.luxury', label: 'ラグジュアリー', value: 'luxury' },
      {
        id: 'lifestyle',
        labelKey: 'preference.choice.lifestyle',
        label: 'ライフスタイル雑貨',
        value: 'lifestyle',
      },
      {
        id: 'souvenirs',
        labelKey: 'preference.choice.souvenirs',
        label: 'お土産',
        value: 'souvenirs',
      },
      {
        id: 'character_goods',
        labelKey: 'preference.choice.character_goods',
        label: 'キャラクターグッズ',
        value: 'character_goods',
      },
    ],
    informationValueBase: 0.9,
    planImpact: 0.95,
  },
  {
    id: 'shopping_trend_vs_timeless',
    intentIds: ['shopping'],
    dimensionId: 'trend_vs_timeless',
    scope: 'shopping',
    promptKey: 'preference.shopping.trend_vs_timeless',
    prompt: '買い物の価値観は？',
    choices: [
      { id: 'trend', labelKey: 'preference.choice.trend', label: 'トレンド重視', value: 'trend' },
      { id: 'balanced', labelKey: 'preference.choice.balanced', label: 'バランス', value: 'balanced' },
      {
        id: 'timeless',
        labelKey: 'preference.choice.timeless',
        label: '長く使える物',
        value: 'timeless',
      },
    ],
    informationValueBase: 0.78,
    planImpact: 0.8,
  },
  {
    id: 'shopping_budget_vs_quality',
    intentIds: ['shopping'],
    dimensionId: 'budget_vs_quality',
    scope: 'shopping',
    promptKey: 'preference.shopping.budget_vs_quality',
    prompt: '予算の使い方は？',
    choices: [
      {
        id: 'budget',
        labelKey: 'preference.choice.budget',
        label: '安くたくさん',
        value: 'budget',
      },
      { id: 'balanced', labelKey: 'preference.choice.balanced', label: 'バランス', value: 'balanced' },
      {
        id: 'quality',
        labelKey: 'preference.choice.quality',
        label: '良い物を少数',
        value: 'quality',
      },
    ],
    informationValueBase: 0.8,
    planImpact: 0.85,
  },

  // --- Sightseeing ---
  {
    id: 'sightseeing_focus',
    intentIds: ['sightseeing'],
    dimensionId: 'sight_focus',
    scope: 'sightseeing',
    promptKey: 'preference.sightseeing.focus',
    prompt: 'どんな観光が好き？（複数可）',
    multiSelect: true,
    choices: [
      { id: 'history', labelKey: 'preference.choice.history', label: '歴史', value: 'history' },
      {
        id: 'architecture',
        labelKey: 'preference.choice.architecture',
        label: '建築',
        value: 'architecture',
      },
      { id: 'art', labelKey: 'preference.choice.art', label: 'アート', value: 'art' },
      { id: 'nature', labelKey: 'preference.choice.nature', label: '自然', value: 'nature' },
      {
        id: 'viewpoints',
        labelKey: 'preference.choice.viewpoints',
        label: '展望・景色',
        value: 'viewpoints',
      },
      {
        id: 'local_culture',
        labelKey: 'preference.choice.local_culture',
        label: 'ローカル文化',
        value: 'local_culture',
      },
      {
        id: 'pop_culture',
        labelKey: 'preference.choice.pop_culture',
        label: 'ポップカルチャー',
        value: 'pop_culture',
      },
    ],
    informationValueBase: 0.9,
    planImpact: 0.9,
  },
  {
    id: 'sightseeing_iconic_vs_hidden',
    intentIds: ['sightseeing'],
    dimensionId: 'iconic_vs_hidden',
    scope: 'sightseeing',
    promptKey: 'preference.sightseeing.iconic_vs_hidden',
    prompt: 'スポットの選び方は？',
    choices: [
      { id: 'iconic', labelKey: 'preference.choice.iconic', label: '有名スポット', value: 'iconic' },
      { id: 'balanced', labelKey: 'preference.choice.balanced', label: 'バランス', value: 'balanced' },
      { id: 'hidden', labelKey: 'preference.choice.hidden', label: '穴場', value: 'hidden' },
    ],
    informationValueBase: 0.85,
    planImpact: 0.88,
  },
  {
    id: 'sightseeing_photo_vs_learning',
    intentIds: ['sightseeing'],
    dimensionId: 'photo_vs_learning',
    scope: 'sightseeing',
    promptKey: 'preference.sightseeing.photo_vs_learning',
    prompt: '観光で大切にしたいことは？',
    choices: [
      {
        id: 'photography',
        labelKey: 'preference.choice.photography',
        label: '写真重視',
        value: 'photography',
      },
      { id: 'balanced', labelKey: 'preference.choice.balanced', label: 'バランス', value: 'balanced' },
      {
        id: 'learning',
        labelKey: 'preference.choice.learning',
        label: '学び・体験重視',
        value: 'learning',
      },
    ],
    informationValueBase: 0.8,
    planImpact: 0.84,
  },

  // --- Universal ---
  {
    id: 'universal_pace',
    intentIds: ['universal'],
    dimensionId: 'pace',
    scope: 'universal',
    promptKey: 'preference.universal.pace',
    prompt: 'スケジュールの密度は？',
    choices: [
      { id: 'packed', labelKey: 'preference.choice.packed', label: '予定ぎっしり', value: 'packed' },
      { id: 'balanced', labelKey: 'preference.choice.balanced', label: 'バランス', value: 'balanced' },
      { id: 'relaxed', labelKey: 'preference.choice.relaxed', label: 'ゆったり', value: 'relaxed' },
    ],
    informationValueBase: 0.75,
    planImpact: 0.92,
  },
  {
    id: 'universal_walking',
    intentIds: ['universal'],
    dimensionId: 'walking_tolerance',
    scope: 'universal',
    promptKey: 'preference.universal.walking_tolerance',
    prompt: '移動の好みは？',
    choices: [
      { id: 'high', labelKey: 'preference.choice.walk_ok', label: '徒歩OK', value: 'high' },
      { id: 'medium', labelKey: 'preference.choice.walk_medium', label: '普通', value: 'medium' },
      { id: 'low', labelKey: 'preference.choice.walk_low', label: '移動少なめ', value: 'low' },
    ],
    informationValueBase: 0.72,
    planImpact: 0.86,
  },
  {
    id: 'universal_crowd',
    intentIds: ['universal'],
    dimensionId: 'crowd_tolerance',
    scope: 'universal',
    promptKey: 'preference.universal.crowd_tolerance',
    prompt: '人混みはどうする？',
    choices: [
      { id: 'ok', labelKey: 'preference.choice.crowds_ok', label: '人混みOK', value: 'ok' },
      { id: 'neutral', labelKey: 'preference.choice.neutral', label: 'どちらでも', value: 'neutral' },
      {
        id: 'avoid',
        labelKey: 'preference.choice.avoid_crowds',
        label: '混雑を避けたい',
        value: 'avoid',
      },
    ],
    informationValueBase: 0.7,
    planImpact: 0.8,
  },
  {
    id: 'universal_indoor_outdoor',
    intentIds: ['universal'],
    dimensionId: 'indoor_outdoor',
    scope: 'universal',
    promptKey: 'preference.universal.indoor_outdoor',
    prompt: '過ごす場所の傾向は？',
    choices: [
      { id: 'outdoor', labelKey: 'preference.choice.outdoor', label: '屋外中心', value: 'outdoor' },
      { id: 'balanced', labelKey: 'preference.choice.balanced', label: 'バランス', value: 'balanced' },
      { id: 'indoor', labelKey: 'preference.choice.indoor', label: '屋内中心', value: 'indoor' },
    ],
    informationValueBase: 0.68,
    planImpact: 0.78,
  },
] as const;
