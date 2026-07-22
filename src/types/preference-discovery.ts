/**
 * Preference Discovery Engine — Phase 1 types only.
 *
 * Trip DNA / Purpose Profile = journey skeleton (composition, time slots).
 * Preference Profile (this module) = individual taste (dimensions + confidence).
 * Do not conflate the two.
 *
 * Phase 1: types + pure functions only — no UI, Places, OpenAI, or Supabase wiring.
 */

/** Travel purpose ids used for preference scoping (extensible string union via registry). */
export type TravelIntentId =
  | 'gourmet'
  | 'shopping'
  | 'sightseeing'
  | 'nature'
  | 'relaxation'
  | 'nightlife'
  | 'adventure'
  | (string & {});

/** Where a preference value or signal came from. Unknown strings are tolerated at runtime. */
export type PreferenceSignalSource =
  | 'explicit_selection'
  | 'onboarding_question'
  | 'plan_feedback'
  | 'saved_place'
  | 'replaced_place'
  | 'skipped_place'
  | 'opened_maps'
  | 'inferred_behavior'
  | 'secretary_confirmation'
  | (string & {});

/** Scalar / enum / multi-enum preference payloads. `undefined` means unset (never auto-fill 0/false). */
export type PreferenceDimensionValue = string | string[] | number | boolean | null | undefined;

/**
 * A single preference slot. Absent PreferenceValue (or value === undefined/null with low/no
 * confidence) means "unknown" — do not coerce to 0/false.
 */
export type PreferenceValue<T = PreferenceDimensionValue> = {
  value: T;
  /** 0–1. Low values must not drive assertive ranking/copy. */
  confidence: number;
  source: PreferenceSignalSource;
  updatedAt: string;
  /** How many signals have touched this slot (soft learning). */
  evidenceCount?: number;
};

/** Snapshot of confidence for a dimension (optional mirror for UI/debug). */
export type PreferenceConfidence = {
  dimensionId: string;
  confidence: number;
  source: PreferenceSignalSource;
  updatedAt: string;
};

/** One prioritized travel intent on the profile. */
export type TravelIntentPreference = {
  intentId: TravelIntentId;
  /** 1 = strongest. Max 3 intents on a profile. */
  priority: 1 | 2 | 3;
};

/** Category-scoped dimensions for one travel intent (keys are dimension ids). */
export type CategoryPreference = {
  intentId: TravelIntentId;
  dimensions: Record<string, PreferenceValue>;
};

/** Cross-category pace / crowd / famous-vs-hidden style preferences. */
export type UniversalPreference = {
  dimensions: Record<string, PreferenceValue>;
};

/** Behavioral or explicit learning event. Pure data — no side effects. */
export type PreferenceSignal = {
  id: string;
  source: PreferenceSignalSource;
  /** Dimension to update (registry key). Required for profile mutation. */
  dimensionId?: string;
  /** Scope: travel intent id, or `universal`. */
  scope?: TravelIntentId | 'universal';
  /** Proposed value for soft/explicit updates. Omitted signals only bump evidence weakly. */
  value?: PreferenceDimensionValue;
  /**
   * Optional override for learning strength (0–1). When omitted, source defaults apply.
   * Still capped so a single weak action cannot dominate.
   */
  strength?: number;
  createdAt?: string;
  placeId?: string;
  beforePlaceId?: string;
  afterPlaceId?: string;
};

export type PreferenceQuestionChoice = {
  id: string;
  /** i18n / display key — Phase 1 stores the key, not UI strings. */
  labelKey: string;
  value: PreferenceDimensionValue;
};

/** Config-driven question — new categories add registry rows, not engine ifs. */
export type PreferenceQuestion = {
  id: string;
  /** Which intents this question serves; `universal` for cross-cutting. */
  intentIds: Array<TravelIntentId | 'universal'>;
  dimensionId: string;
  scope: TravelIntentId | 'universal';
  promptKey: string;
  choices: PreferenceQuestionChoice[];
  /** Base priority for information value (higher = ask sooner when confidence is low). */
  informationValueBase: number;
  /** Relative impact on plan quality / ranking (higher = prefer when uncertain). */
  planImpact: number;
  sensitivity?: 'none' | 'low' | 'high';
};

export type PreferenceAnswer = {
  questionId: string;
  value: PreferenceDimensionValue;
  answeredAt: string;
  source: Extract<PreferenceSignalSource, 'onboarding_question' | 'secretary_confirmation' | 'explicit_selection'>;
};

/** Ranking breakdown placeholder for later Phases — typed now, unused in Phase 1 wiring. */
export type CandidatePreferenceScore = {
  placeId: string;
  finalScore: number;
  components: {
    purposeFit: number;
    categoryPreferenceFit: number;
    universalPreferenceFit: number;
    contextFit: number;
    quality: number;
    routeConvenience: number;
    diversity: number;
    constraintPenalty: number;
  };
  reasons: ExplainableRecommendationReason[];
};

export type ExplainableRecommendationReason = {
  code: string;
  messageKey: string;
  messageParams?: Record<string, string | number>;
  relatedDimensions?: string[];
  confidence: number;
  strength: 'primary' | 'secondary';
};

/**
 * Individual taste profile. Journey composition stays in Trip DNA / Purpose Profile.
 * Unset dimensions are simply missing from the maps — never pre-filled with false zeros.
 */
export type PreferenceProfile = {
  schemaVersion: number;
  /** Stable local id until auth/Supabase exists. */
  profileId: string;
  travelIntents: TravelIntentPreference[];
  categoryPreferences: Record<string, CategoryPreference>;
  universal: UniversalPreference;
  /** Signal ids already applied — prevents double-counting the same event. */
  appliedSignalIds: string[];
  updatedAt: string;
};
