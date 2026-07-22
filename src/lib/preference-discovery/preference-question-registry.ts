/**
 * Preference question registry (config only).
 * Adding a category/question = append a row here — do not add purpose-specific ifs in the engine.
 */

import type { PreferenceQuestion } from '@/types/preference-discovery';

/**
 * Seed questions for Phase 1 selection logic.
 * Keep the pool small; `selectNextPreferenceQuestions` returns at most 2–4.
 */
export const PREFERENCE_QUESTION_REGISTRY: readonly PreferenceQuestion[] = [
  {
    id: 'gourmet_local_vs_famous',
    intentIds: ['gourmet'],
    dimensionId: 'local_vs_famous',
    scope: 'gourmet',
    promptKey: 'preference.gourmet.local_vs_famous',
    choices: [
      { id: 'local', labelKey: 'preference.choice.local', value: 'local' },
      { id: 'balanced', labelKey: 'preference.choice.balanced', value: 'balanced' },
      { id: 'famous', labelKey: 'preference.choice.famous', value: 'famous' },
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
    choices: [
      { id: 'casual', labelKey: 'preference.choice.casual', value: 'casual' },
      { id: 'mid', labelKey: 'preference.choice.mid', value: 'mid' },
      { id: 'luxury', labelKey: 'preference.choice.luxury', value: 'luxury' },
    ],
    informationValueBase: 0.85,
    planImpact: 0.9,
  },
  {
    id: 'gourmet_food_formats',
    intentIds: ['gourmet'],
    dimensionId: 'food_formats',
    scope: 'gourmet',
    promptKey: 'preference.gourmet.food_formats',
    choices: [
      { id: 'restaurant', labelKey: 'preference.choice.restaurant', value: 'restaurant' },
      { id: 'cafe', labelKey: 'preference.choice.cafe', value: 'cafe' },
      { id: 'market_food', labelKey: 'preference.choice.market_food', value: 'market_food' },
      { id: 'dessert', labelKey: 'preference.choice.dessert', value: 'dessert' },
    ],
    informationValueBase: 0.7,
    planImpact: 0.75,
  },
  {
    id: 'shopping_focus',
    intentIds: ['shopping'],
    dimensionId: 'shopping_focus',
    scope: 'shopping',
    promptKey: 'preference.shopping.focus',
    choices: [
      { id: 'street_fashion', labelKey: 'preference.choice.street_fashion', value: 'street_fashion' },
      { id: 'local_brands', labelKey: 'preference.choice.local_brands', value: 'local_brands' },
      { id: 'cosmetics', labelKey: 'preference.choice.cosmetics', value: 'cosmetics' },
      { id: 'souvenirs', labelKey: 'preference.choice.souvenirs', value: 'souvenirs' },
      { id: 'luxury', labelKey: 'preference.choice.luxury', value: 'luxury' },
    ],
    informationValueBase: 0.9,
    planImpact: 0.95,
  },
  {
    id: 'shopping_budget_vs_quality',
    intentIds: ['shopping'],
    dimensionId: 'budget_vs_quality',
    scope: 'shopping',
    promptKey: 'preference.shopping.budget_vs_quality',
    choices: [
      { id: 'budget', labelKey: 'preference.choice.budget', value: 'budget' },
      { id: 'balanced', labelKey: 'preference.choice.balanced', value: 'balanced' },
      { id: 'quality', labelKey: 'preference.choice.quality', value: 'quality' },
    ],
    informationValueBase: 0.8,
    planImpact: 0.85,
  },
  {
    id: 'sightseeing_focus',
    intentIds: ['sightseeing'],
    dimensionId: 'sight_focus',
    scope: 'sightseeing',
    promptKey: 'preference.sightseeing.focus',
    choices: [
      { id: 'history', labelKey: 'preference.choice.history', value: 'history' },
      { id: 'art', labelKey: 'preference.choice.art', value: 'art' },
      { id: 'viewpoints', labelKey: 'preference.choice.viewpoints', value: 'viewpoints' },
      { id: 'local_culture', labelKey: 'preference.choice.local_culture', value: 'local_culture' },
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
    choices: [
      { id: 'iconic', labelKey: 'preference.choice.iconic', value: 'iconic' },
      { id: 'balanced', labelKey: 'preference.choice.balanced', value: 'balanced' },
      { id: 'hidden', labelKey: 'preference.choice.hidden', value: 'hidden' },
    ],
    informationValueBase: 0.85,
    planImpact: 0.88,
  },
  {
    id: 'universal_pace',
    intentIds: ['universal'],
    dimensionId: 'pace',
    scope: 'universal',
    promptKey: 'preference.universal.pace',
    choices: [
      { id: 'packed', labelKey: 'preference.choice.packed', value: 'packed' },
      { id: 'balanced', labelKey: 'preference.choice.balanced', value: 'balanced' },
      { id: 'relaxed', labelKey: 'preference.choice.relaxed', value: 'relaxed' },
    ],
    informationValueBase: 0.75,
    planImpact: 0.92,
  },
  {
    id: 'universal_crowd',
    intentIds: ['universal'],
    dimensionId: 'crowd_tolerance',
    scope: 'universal',
    promptKey: 'preference.universal.crowd_tolerance',
    choices: [
      { id: 'avoid', labelKey: 'preference.choice.avoid_crowds', value: 'avoid' },
      { id: 'neutral', labelKey: 'preference.choice.neutral', value: 'neutral' },
      { id: 'ok', labelKey: 'preference.choice.crowds_ok', value: 'ok' },
    ],
    informationValueBase: 0.7,
    planImpact: 0.8,
  },
  {
    id: 'universal_famous_vs_hidden',
    intentIds: ['universal'],
    dimensionId: 'famous_vs_hidden',
    scope: 'universal',
    promptKey: 'preference.universal.famous_vs_hidden',
    choices: [
      { id: 'famous', labelKey: 'preference.choice.famous', value: 'famous' },
      { id: 'balanced', labelKey: 'preference.choice.balanced', value: 'balanced' },
      { id: 'hidden', labelKey: 'preference.choice.hidden', value: 'hidden' },
    ],
    informationValueBase: 0.72,
    planImpact: 0.85,
  },
] as const;
