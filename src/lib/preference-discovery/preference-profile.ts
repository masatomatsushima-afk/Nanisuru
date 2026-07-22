/**
 * Preference Discovery Engine — Phase 1 pure functions.
 *
 * No UI / Places / OpenAI / Supabase / auth. Safe to import from Node verify scripts.
 */

import type {
  CategoryPreference,
  PreferenceDimensionValue,
  PreferenceProfile,
  PreferenceQuestion,
  PreferenceSignal,
  PreferenceSignalSource,
  PreferenceValue,
  TravelIntentId,
  TravelIntentPreference,
  UniversalPreference,
} from '@/types/preference-discovery';
import { PREFERENCE_QUESTION_REGISTRY } from './preference-question-registry';

export const PREFERENCE_PROFILE_SCHEMA_VERSION = 1;

/** Soft learning: single weak actions must not dominate. */
const SOURCE_BASE_STRENGTH: Record<string, number> = {
  explicit_selection: 0.85,
  onboarding_question: 0.8,
  secretary_confirmation: 0.8,
  plan_feedback: 0.45,
  saved_place: 0.18,
  replaced_place: 0.22,
  skipped_place: 0.15,
  opened_maps: 0.08,
  inferred_behavior: 0.06,
};

const EXPLICIT_SOURCES = new Set([
  'explicit_selection',
  'onboarding_question',
  'secretary_confirmation',
]);

const DEFAULT_QUESTION_LIMIT_MIN = 2;
const DEFAULT_QUESTION_LIMIT_MAX = 4;

export type PreferenceProfileValidationIssue = {
  path: string;
  message: string;
};

export type PreferenceProfileValidationResult = {
  ok: boolean;
  issues: PreferenceProfileValidationIssue[];
};

function nowIso(): string {
  return new Date().toISOString();
}

function createProfileId(): string {
  return `pref_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Clamp to [0, 1]; non-finite → 0. */
export function clampConfidence(value: unknown): number {
  if (!isFiniteNumber(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function resolveSourceStrength(source: PreferenceSignalSource, override?: number): number {
  const base = SOURCE_BASE_STRENGTH[source] ?? SOURCE_BASE_STRENGTH.inferred_behavior;
  if (override != null && isFiniteNumber(override)) {
    return Math.min(base, clampConfidence(override));
  }
  return base;
}

function isExplicitSource(source: PreferenceSignalSource): boolean {
  return EXPLICIT_SOURCES.has(source);
}

function clonePreferenceValue(value: PreferenceValue): PreferenceValue {
  return {
    ...value,
    value: Array.isArray(value.value) ? [...value.value] : value.value,
  };
}

function cloneCategoryPreference(category: CategoryPreference): CategoryPreference {
  const dimensions: Record<string, PreferenceValue> = {};
  for (const [key, slot] of Object.entries(category.dimensions ?? {})) {
    dimensions[key] = clonePreferenceValue(slot);
  }
  return { intentId: category.intentId, dimensions };
}

function cloneProfile(profile: PreferenceProfile): PreferenceProfile {
  const categoryPreferences: Record<string, CategoryPreference> = {};
  for (const [key, category] of Object.entries(profile.categoryPreferences ?? {})) {
    categoryPreferences[key] = cloneCategoryPreference(category);
  }
  const universalDimensions: Record<string, PreferenceValue> = {};
  for (const [key, slot] of Object.entries(profile.universal?.dimensions ?? {})) {
    universalDimensions[key] = clonePreferenceValue(slot);
  }
  return {
    schemaVersion: profile.schemaVersion,
    profileId: profile.profileId,
    travelIntents: (profile.travelIntents ?? []).map((intent) => ({ ...intent })),
    categoryPreferences,
    universal: { dimensions: universalDimensions },
    appliedSignalIds: [...(profile.appliedSignalIds ?? [])],
    updatedAt: profile.updatedAt,
  };
}

/**
 * Empty profile: no dimensions pre-filled. Missing keys = unknown (not 0/false).
 */
export function createEmptyPreferenceProfile(options?: {
  profileId?: string;
  travelIntents?: TravelIntentPreference[];
  now?: string;
}): PreferenceProfile {
  const updatedAt = options?.now ?? nowIso();
  return {
    schemaVersion: PREFERENCE_PROFILE_SCHEMA_VERSION,
    profileId: options?.profileId?.trim() || createProfileId(),
    travelIntents: (options?.travelIntents ?? []).slice(0, 3).map((intent, index) => ({
      intentId: intent.intentId,
      priority: intent.priority ?? ((index + 1) as 1 | 2 | 3),
    })),
    categoryPreferences: {},
    universal: { dimensions: {} },
    appliedSignalIds: [],
    updatedAt,
  };
}

function sanitizeDimensionValue(value: PreferenceDimensionValue): PreferenceDimensionValue {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === 'string' || typeof item === 'number');
  }
  return undefined;
}

function normalizePreferenceValue(raw: unknown): PreferenceValue | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Partial<PreferenceValue>;
  const value = sanitizeDimensionValue(record.value as PreferenceDimensionValue);
  // Keep slot only if we have something meaningful OR an explicit unknown with metadata.
  // Prefer dropping empty garbage; callers treat missing keys as unknown.
  if (value === undefined && record.confidence == null && !record.source) return null;

  return {
    value,
    confidence: clampConfidence(record.confidence),
    source: (typeof record.source === 'string' && record.source.trim()
      ? record.source.trim()
      : 'inferred_behavior') as PreferenceSignalSource,
    updatedAt: typeof record.updatedAt === 'string' && record.updatedAt.trim()
      ? record.updatedAt
      : nowIso(),
    evidenceCount:
      record.evidenceCount != null && isFiniteNumber(record.evidenceCount)
        ? Math.max(0, Math.floor(record.evidenceCount))
        : undefined,
  };
}

function normalizeCategoryMap(
  raw: unknown,
): Record<string, CategoryPreference> {
  if (!raw || typeof raw !== 'object') return {};
  const result: Record<string, CategoryPreference> = {};
  for (const [intentId, categoryRaw] of Object.entries(raw as Record<string, unknown>)) {
    if (!intentId || !categoryRaw || typeof categoryRaw !== 'object') continue;
    const category = categoryRaw as Partial<CategoryPreference>;
    const dimensions: Record<string, PreferenceValue> = {};
    for (const [dimensionId, slotRaw] of Object.entries(category.dimensions ?? {})) {
      const slot = normalizePreferenceValue(slotRaw);
      if (slot) dimensions[dimensionId] = slot;
    }
    result[intentId] = {
      intentId: (category.intentId as TravelIntentId) || intentId,
      dimensions,
    };
  }
  return result;
}

function normalizeUniversal(raw: unknown): UniversalPreference {
  if (!raw || typeof raw !== 'object') return { dimensions: {} };
  const dimensions: Record<string, PreferenceValue> = {};
  const record = raw as Partial<UniversalPreference>;
  for (const [dimensionId, slotRaw] of Object.entries(record.dimensions ?? {})) {
    const slot = normalizePreferenceValue(slotRaw);
    if (slot) dimensions[dimensionId] = slot;
  }
  return { dimensions };
}

function normalizeTravelIntents(raw: unknown): TravelIntentPreference[] {
  if (!Array.isArray(raw)) return [];
  const intents: TravelIntentPreference[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const intentId = (item as TravelIntentPreference).intentId;
    if (typeof intentId !== 'string' || !intentId.trim()) continue;
    const priorityRaw = (item as TravelIntentPreference).priority;
    const priority = priorityRaw === 2 || priorityRaw === 3 ? priorityRaw : 1;
    intents.push({ intentId, priority });
    if (intents.length >= 3) break;
  }
  return intents;
}

/**
 * Coerce incomplete / dirty profile data into a safe shape without inventing taste values.
 */
export function normalizePreferenceProfile(input: unknown): PreferenceProfile {
  const empty = createEmptyPreferenceProfile();
  if (!input || typeof input !== 'object') return empty;

  const raw = input as Partial<PreferenceProfile>;
  const appliedSignalIds = Array.isArray(raw.appliedSignalIds)
    ? raw.appliedSignalIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    : [];

  return {
    schemaVersion:
      raw.schemaVersion != null && isFiniteNumber(raw.schemaVersion)
        ? Math.max(1, Math.floor(raw.schemaVersion))
        : PREFERENCE_PROFILE_SCHEMA_VERSION,
    profileId:
      typeof raw.profileId === 'string' && raw.profileId.trim()
        ? raw.profileId.trim()
        : empty.profileId,
    travelIntents: normalizeTravelIntents(raw.travelIntents),
    categoryPreferences: normalizeCategoryMap(raw.categoryPreferences),
    universal: normalizeUniversal(raw.universal),
    appliedSignalIds: [...new Set(appliedSignalIds)],
    updatedAt:
      typeof raw.updatedAt === 'string' && raw.updatedAt.trim() ? raw.updatedAt : empty.updatedAt,
  };
}

export function validatePreferenceProfile(profile: unknown): PreferenceProfileValidationResult {
  const issues: PreferenceProfileValidationIssue[] = [];
  if (!profile || typeof profile !== 'object') {
    return { ok: false, issues: [{ path: '', message: 'profile is not an object' }] };
  }

  const normalized = normalizePreferenceProfile(profile);

  if (!normalized.profileId) {
    issues.push({ path: 'profileId', message: 'missing profileId' });
  }

  for (const [intentId, category] of Object.entries(normalized.categoryPreferences)) {
    for (const [dimensionId, slot] of Object.entries(category.dimensions)) {
      if (slot.confidence < 0 || slot.confidence > 1 || !Number.isFinite(slot.confidence)) {
        issues.push({
          path: `categoryPreferences.${intentId}.${dimensionId}.confidence`,
          message: 'confidence out of range',
        });
      }
      if (typeof slot.value === 'number' && !Number.isFinite(slot.value)) {
        issues.push({
          path: `categoryPreferences.${intentId}.${dimensionId}.value`,
          message: 'non-finite numeric value',
        });
      }
    }
  }

  for (const [dimensionId, slot] of Object.entries(normalized.universal.dimensions)) {
    if (slot.confidence < 0 || slot.confidence > 1 || !Number.isFinite(slot.confidence)) {
      issues.push({
        path: `universal.${dimensionId}.confidence`,
        message: 'confidence out of range',
      });
    }
  }

  return { ok: issues.length === 0, issues };
}

function getDimensionSlot(
  profile: PreferenceProfile,
  scope: TravelIntentId | 'universal',
  dimensionId: string,
): PreferenceValue | undefined {
  if (scope === 'universal') return profile.universal.dimensions[dimensionId];
  return profile.categoryPreferences[scope]?.dimensions[dimensionId];
}

function setDimensionSlot(
  profile: PreferenceProfile,
  scope: TravelIntentId | 'universal',
  dimensionId: string,
  slot: PreferenceValue,
): void {
  if (scope === 'universal') {
    profile.universal.dimensions[dimensionId] = slot;
    return;
  }
  const existing = profile.categoryPreferences[scope] ?? {
    intentId: scope,
    dimensions: {},
  };
  existing.dimensions[dimensionId] = slot;
  profile.categoryPreferences[scope] = existing;
}

function mergePreferenceValue(params: {
  previous: PreferenceValue | undefined;
  nextValue: PreferenceDimensionValue;
  source: PreferenceSignalSource;
  strength: number;
  updatedAt: string;
}): PreferenceValue {
  const { previous, nextValue, source, strength, updatedAt } = params;
  const evidenceCount = (previous?.evidenceCount ?? 0) + 1;

  // Explicit answers replace value immediately but still blend confidence upward safely.
  if (isExplicitSource(source)) {
    const previousConfidence = previous ? clampConfidence(previous.confidence) : 0;
    const confidence = clampConfidence(
      Math.max(previousConfidence, strength) * 0.35 + strength * 0.65,
    );
    return {
      value: nextValue,
      confidence,
      source,
      updatedAt,
      evidenceCount,
    };
  }

  // Soft signals: do not overwrite a strong explicit value with a weak guess.
  if (
    previous &&
    isExplicitSource(previous.source) &&
    previous.confidence >= 0.6 &&
    !isExplicitSource(source)
  ) {
    return {
      ...clonePreferenceValue(previous),
      confidence: clampConfidence(previous.confidence),
      evidenceCount,
      updatedAt,
    };
  }

  // Soft EMA toward a capped ceiling for this source — never jumps to explicit-level certainty.
  const previousConfidence = previous ? clampConfidence(previous.confidence) : 0;
  const softCeiling = Math.min(0.45, Math.max(strength * 2.5, strength + 0.12));
  const step = Math.min(0.12, 0.035 + strength * 0.5);
  const confidence = clampConfidence(Math.min(softCeiling, previousConfidence + step));

  // Soft signals never adopt a value on the first hits — wait until evidence accumulates.
  // This keeps "opened Maps once" from looking like a strong preference assertion.
  const softReady = evidenceCount >= 3 && confidence >= 0.12;
  const shouldAdoptValue = softReady;

  return {
    value: shouldAdoptValue ? nextValue : previous?.value,
    confidence,
    source: shouldAdoptValue ? source : previous?.source ?? source,
    updatedAt,
    evidenceCount,
  };
}

/**
 * Apply one preference signal immutably.
 * Duplicate `signal.id` is ignored. Incomplete signals no-op without throwing.
 */
export function applyPreferenceSignal(
  profile: PreferenceProfile,
  signal: PreferenceSignal,
): PreferenceProfile {
  const base = normalizePreferenceProfile(profile);

  try {
    if (!signal || typeof signal !== 'object') return base;
    const signalId = typeof signal.id === 'string' ? signal.id.trim() : '';
    if (!signalId) return base;
    if (base.appliedSignalIds.includes(signalId)) return base;

    const dimensionId =
      typeof signal.dimensionId === 'string' ? signal.dimensionId.trim() : '';
    if (!dimensionId) {
      // Still record the id so retries do not re-process a malformed event forever.
      return {
        ...base,
        appliedSignalIds: [...base.appliedSignalIds, signalId],
        updatedAt: signal.createdAt?.trim() || nowIso(),
      };
    }

    const scope: TravelIntentId | 'universal' =
      signal.scope === 'universal' || typeof signal.scope === 'string'
        ? (signal.scope as TravelIntentId | 'universal')
        : 'universal';

    const source = (typeof signal.source === 'string' && signal.source.trim()
      ? signal.source.trim()
      : 'inferred_behavior') as PreferenceSignalSource;

    const strength = resolveSourceStrength(source, signal.strength);
    const nextValue = sanitizeDimensionValue(signal.value);
    const updatedAt = signal.createdAt?.trim() || nowIso();

    const next = cloneProfile(base);
    const previous = getDimensionSlot(next, scope, dimensionId);

    // Signals without a value only nudge confidence/evidence (very weakly).
    const valueForMerge =
      nextValue !== undefined
        ? nextValue
        : previous?.value !== undefined
          ? previous.value
          : undefined;

    if (valueForMerge === undefined && nextValue === undefined) {
      const nudged: PreferenceValue = {
        value: previous?.value,
        confidence: clampConfidence(
          (previous?.confidence ?? 0) + Math.min(0.03, strength * 0.2),
        ),
        source: previous?.source ?? source,
        updatedAt,
        evidenceCount: (previous?.evidenceCount ?? 0) + 1,
      };
      setDimensionSlot(next, scope, dimensionId, nudged);
    } else {
      const merged = mergePreferenceValue({
        previous,
        nextValue: valueForMerge,
        source,
        strength,
        updatedAt,
      });
      setDimensionSlot(next, scope, dimensionId, merged);
    }

    next.appliedSignalIds = [...next.appliedSignalIds, signalId];
    next.updatedAt = updatedAt;
    return next;
  } catch {
    return base;
  }
}

function dimensionConfidence(
  profile: PreferenceProfile,
  scope: TravelIntentId | 'universal',
  dimensionId: string,
): number {
  return clampConfidence(getDimensionSlot(profile, scope, dimensionId)?.confidence ?? 0);
}

function questionMatchesPurposes(
  question: PreferenceQuestion,
  selectedPurposes: readonly string[],
): boolean {
  if (question.intentIds.includes('universal')) {
    // Universal questions are eligible whenever any purpose is selected (or none yet).
    return selectedPurposes.length === 0 || selectedPurposes.length > 0;
  }
  if (selectedPurposes.length === 0) return false;
  return question.intentIds.some((intentId) => selectedPurposes.includes(intentId));
}

/**
 * Pick the next onboarding questions (max 2–4).
 * Priority: related to selected purposes → low confidence → high planImpact / information value.
 */
export function selectNextPreferenceQuestions(
  profile: PreferenceProfile,
  selectedPurposes: readonly string[],
  limit: number = DEFAULT_QUESTION_LIMIT_MAX,
  registry: readonly PreferenceQuestion[] = PREFERENCE_QUESTION_REGISTRY,
): PreferenceQuestion[] {
  const safeLimit = Math.max(
    0,
    Math.min(
      DEFAULT_QUESTION_LIMIT_MAX,
      Math.floor(isFiniteNumber(limit) ? limit : DEFAULT_QUESTION_LIMIT_MAX),
    ),
  );
  if (safeLimit === 0) return [];

  const normalized = normalizePreferenceProfile(profile);
  const purposes = selectedPurposes
    .map((purpose) => purpose?.trim())
    .filter((purpose): purpose is string => Boolean(purpose));

  const scored = registry
    .filter((question) => question.sensitivity !== 'high')
    .filter((question) => questionMatchesPurposes(question, purposes))
    .map((question) => {
      const confidence = dimensionConfidence(normalized, question.scope, question.dimensionId);
      const uncertainty = 1 - confidence;
      // Prefer purpose-scoped questions over universal when purposes are known.
      const purposeBoost =
        purposes.length > 0 && question.intentIds.some((id) => purposes.includes(id as string))
          ? 1.25
          : question.intentIds.includes('universal')
            ? 0.55
            : 0.2;
      const score =
        purposeBoost *
        uncertainty *
        (0.55 * question.informationValueBase + 0.45 * question.planImpact);
      return { question, score, confidence };
    })
    // Skip dimensions that are already fairly certain.
    .filter((entry) => entry.confidence < 0.7)
    .sort((left, right) => right.score - left.score);

  const picked = scored.slice(0, safeLimit).map((entry) => entry.question);

  // If caller asked for "at least 2" feel but only 1 exists, still return what we have.
  if (picked.length >= DEFAULT_QUESTION_LIMIT_MIN || picked.length > 0) {
    return picked.slice(0, Math.min(safeLimit, DEFAULT_QUESTION_LIMIT_MAX));
  }
  return picked;
}

export { PREFERENCE_QUESTION_REGISTRY, SOURCE_BASE_STRENGTH };
