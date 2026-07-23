/**
 * Multi-select travel purposes (1–3) with priority + normalized weights.
 * Config-driven — no purpose-combination if-trees.
 */

export const MAX_SELECTED_PURPOSES = 3;

/** Form chip id → canonical purpose id used in selectedPurposes / DNA / preferences. */
export const TRAVEL_SHEET_PURPOSE_TO_CANONICAL: Readonly<Record<string, string>> = {
  food: 'gourmet',
  shopping: 'shopping',
  photo: 'sightseeing',
  nature: 'nature',
  night: 'nightlife',
  ai: 'ai',
};

/** Canonical purpose → Purpose Profile id (PURPOSE_PROFILES). */
export const PURPOSE_TO_PURPOSE_PROFILE_ID: Readonly<Record<string, string>> = {
  gourmet: 'gourmet',
  shopping: 'shopping',
  sightseeing: 'sightseeing',
  nature: 'nature',
  nightlife: 'nightlife',
  ai: 'ai',
};

/** Canonical purpose → Trip DNA id (TRIP_DNA_PROFILES). Missing ids use nearest alias. */
export const PURPOSE_TO_TRIP_DNA_ID: Readonly<Record<string, string>> = {
  gourmet: 'gourmet',
  shopping: 'shopping',
  sightseeing: 'sightseeing',
  nature: 'adventure',
  nightlife: 'nightlife',
  ai: 'default',
};

/**
 * Base weight schedules by selection count (before final normalize).
 * 1 → 1 / 2 → 0.65+0.35 / 3 → 0.55+0.30+0.15
 */
export const PURPOSE_WEIGHT_SCHEDULE: Readonly<Record<1 | 2 | 3, readonly number[]>> = {
  1: [1],
  2: [0.65, 0.35],
  3: [0.55, 0.3, 0.15],
};

/**
 * Soft question quotas by selection count (primary / secondary / tertiary).
 * Total always ≤ 4; leftovers filled by global score.
 */
export const PREFERENCE_QUESTION_SLOT_QUOTAS: Readonly<Record<1 | 2 | 3, readonly number[]>> = {
  1: [4],
  2: [2, 2],
  3: [2, 1, 1],
};

export type SelectedPurpose = {
  purpose: string;
  priority: 1 | 2 | 3;
  weight: number;
};

export type ToggleSelectedPurposeResult = {
  selected: SelectedPurpose[];
  /** True when a 4th purpose was rejected. */
  rejectedMax: boolean;
};

function clampCount(n: number): 1 | 2 | 3 {
  if (n <= 1) return 1;
  if (n === 2) return 2;
  return 3;
}

/** Ensure weights are finite, non-negative, and sum to 1. */
export function normalizePurposeWeights(weights: readonly number[]): number[] {
  const cleaned = weights.map((value) =>
    typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0,
  );
  const sum = cleaned.reduce((acc, value) => acc + value, 0);
  if (sum <= 0) {
    const n = cleaned.length || 1;
    return Array.from({ length: n }, () => 1 / n);
  }
  return cleaned.map((value) => value / sum);
}

/** Build selectedPurposes from ordered canonical purpose ids (selection order = priority). */
export function buildSelectedPurposes(
  purposeIdsInOrder: readonly string[],
): SelectedPurpose[] {
  const ordered = purposeIdsInOrder
    .map((id) => (typeof id === 'string' ? id.trim() : ''))
    .filter(Boolean)
    .slice(0, MAX_SELECTED_PURPOSES);

  if (ordered.length === 0) return [];

  const count = clampCount(ordered.length);
  const schedule = PURPOSE_WEIGHT_SCHEDULE[count];
  const rawWeights = ordered.map((_, index) => schedule[index] ?? 0);
  const weights = normalizePurposeWeights(rawWeights);

  return ordered.map((purpose, index) => ({
    purpose,
    priority: (index + 1) as 1 | 2 | 3,
    weight: weights[index] ?? 0,
  }));
}

export function resolveCanonicalPurposeFromSheetId(
  sheetPurposeId: string | null | undefined,
): string | null {
  if (!sheetPurposeId?.trim()) return null;
  return TRAVEL_SHEET_PURPOSE_TO_CANONICAL[sheetPurposeId.trim()] ?? sheetPurposeId.trim();
}

export function buildSelectedPurposesFromSheetIds(
  sheetPurposeIds: readonly string[],
): SelectedPurpose[] {
  const canonical: string[] = [];
  for (const sheetId of sheetPurposeIds) {
    const purpose = resolveCanonicalPurposeFromSheetId(sheetId);
    if (!purpose || purpose === 'ai') {
      // `ai` is exclusive empty-intent sentinel — represented alone without DNA blend.
      if (purpose === 'ai') return buildSelectedPurposes(['ai']);
      continue;
    }
    if (!canonical.includes(purpose)) canonical.push(purpose);
  }
  return buildSelectedPurposes(canonical);
}

/**
 * Toggle a form sheet purpose id in selection order.
 * - Deselect if already selected (then recalc priority/weight)
 * - Reject 4th selection (rejectedMax)
 * - `ai` is exclusive vs other purposes
 */
export function toggleSheetPurposeSelection(
  currentSheetIds: readonly string[],
  sheetPurposeId: string,
): ToggleSelectedPurposeResult & { sheetIds: string[] } {
  const id = sheetPurposeId.trim();
  if (!id) {
    return { sheetIds: [...currentSheetIds], selected: buildSelectedPurposesFromSheetIds(currentSheetIds), rejectedMax: false };
  }

  const current = currentSheetIds.map((item) => item.trim()).filter(Boolean);

  if (current.includes(id)) {
    const sheetIds = current.filter((item) => item !== id);
    return {
      sheetIds,
      selected: buildSelectedPurposesFromSheetIds(sheetIds),
      rejectedMax: false,
    };
  }

  if (id === 'ai') {
    const sheetIds = ['ai'];
    return {
      sheetIds,
      selected: buildSelectedPurposesFromSheetIds(sheetIds),
      rejectedMax: false,
    };
  }

  const withoutAi = current.filter((item) => item !== 'ai');
  if (withoutAi.length >= MAX_SELECTED_PURPOSES) {
    return {
      sheetIds: withoutAi,
      selected: buildSelectedPurposesFromSheetIds(withoutAi),
      rejectedMax: true,
    };
  }

  const sheetIds = [...withoutAi, id];
  return {
    sheetIds,
    selected: buildSelectedPurposesFromSheetIds(sheetIds),
    rejectedMax: false,
  };
}

export function getPrimarySheetPurposeId(
  sheetPurposeIds: readonly string[],
): string | null {
  const first = sheetPurposeIds.find((id) => id?.trim());
  return first?.trim() || null;
}

export function getPurposePriorityLabel(priority: 1 | 2 | 3): string {
  if (priority === 1) return '1 一番重視';
  return String(priority);
}

/** Sum of weights ≈ 1 (floating tolerance). */
export function selectedPurposeWeightsSumToOne(
  selected: readonly SelectedPurpose[],
  epsilon = 1e-6,
): boolean {
  if (selected.length === 0) return true;
  const sum = selected.reduce((acc, item) => acc + (item.weight || 0), 0);
  return Math.abs(sum - 1) <= epsilon;
}
