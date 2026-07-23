import type { BudgetScopeItem, BudgetScopeSettings } from '@/types/budget-scope';

export const TRAVEL_BUDGET_INCLUDE_OPTIONS = [
  '航空券',
  'ホテル',
  '食事',
  '交通費',
  'アクティビティ',
  '買い物',
  'お土産',
  '現地費用のみ',
] as const;

export type TravelBudgetIncludeOption = (typeof TRAVEL_BUDGET_INCLUDE_OPTIONS)[number];

export type TravelBudgetIncludeCategory = Exclude<
  TravelBudgetIncludeOption,
  '現地費用のみ'
>;

/**
 * Fallback categories used only when converting an empty selection for
 * legacy budgetScope / plan payload compatibility — not UI defaults.
 */
export const DEFAULT_TRAVEL_BUDGET_INCLUDES: TravelBudgetIncludeCategory[] = [
  '食事',
  '交通費',
  'アクティビティ',
];

const TRAVEL_INCLUDE_TO_SCOPE: Record<TravelBudgetIncludeCategory, BudgetScopeItem> = {
  航空券: '飛行機代',
  ホテル: '宿泊費',
  食事: '食事',
  交通費: '交通費',
  アクティビティ: 'アクティビティ',
  買い物: '買い物',
  お土産: 'お土産',
};

const SCOPE_TO_TRAVEL_INCLUDE: Partial<Record<BudgetScopeItem, TravelBudgetIncludeOption>> = {
  飛行機代: '航空券',
  宿泊費: 'ホテル',
  食事: '食事',
  交通費: '交通費',
  アクティビティ: 'アクティビティ',
  買い物: '買い物',
  お土産: 'お土産',
};

export function resolveTravelBudgetIncludes(
  includes: TravelBudgetIncludeOption[] | null | undefined,
): TravelBudgetIncludeCategory[] {
  const safe = Array.isArray(includes) ? includes : [];
  const hasLocalOnly = safe.includes('現地費用のみ');
  let resolved = safe.filter(
    (item): item is TravelBudgetIncludeCategory => item !== '現地費用のみ',
  );

  if (hasLocalOnly) {
    resolved = resolved.filter((item) => item !== '航空券' && item !== 'ホテル');
  }

  // Empty selection → legacy fallback for plan/budgetScope payload only (not UI defaults).
  if (resolved.length === 0) {
    return [...DEFAULT_TRAVEL_BUDGET_INCLUDES];
  }

  return resolved;
}

export function travelBudgetIncludesToBudgetScope(
  includes: TravelBudgetIncludeOption[] | null | undefined,
): BudgetScopeSettings {
  const safe = Array.isArray(includes) ? includes : [];
  const resolved = resolveTravelBudgetIncludes(safe);
  const hasLocalOnly = safe.includes('現地費用のみ');
  const includedItems = [
    ...new Set(
      resolved.map((item) => TRAVEL_INCLUDE_TO_SCOPE[item]).filter(Boolean),
    ),
  ] as BudgetScopeItem[];

  if (hasLocalOnly && !includedItems.includes('予備費')) {
    includedItems.push('予備費');
  }

  return {
    includedItems:
      includedItems.length > 0 ? includedItems : ['食事', '交通費', 'アクティビティ'],
    excludeAlreadyPaid: false,
    alreadyPaidItems: [],
    customItems: [],
    flightsBooked: false,
    hotelsBooked: false,
    localOnly: hasLocalOnly,
  };
}

export function budgetScopeToTravelBudgetIncludes(
  settings: BudgetScopeSettings,
): TravelBudgetIncludeOption[] {
  if (settings?.localOnly) {
    return ['現地費用のみ'];
  }

  const includedItems = Array.isArray(settings?.includedItems) ? settings.includedItems : [];
  const includes = includedItems
    .map((item) => SCOPE_TO_TRAVEL_INCLUDE[item])
    .filter(Boolean) as TravelBudgetIncludeOption[];

  // Preserve explicit category selections from saved scope; do not invent UI defaults here.
  return [...new Set(includes)];
}

export function toggleTravelBudgetInclude(
  includes: TravelBudgetIncludeOption[],
  option: TravelBudgetIncludeOption,
): TravelBudgetIncludeOption[] {
  const current = Array.isArray(includes) ? includes : [];

  // 「現地費用のみ」は個別項目と排他。選ぶと他をすべて解除。
  if (option === '現地費用のみ') {
    if (current.includes('現地費用のみ')) {
      return current.filter((item) => item !== '現地費用のみ');
    }
    return ['現地費用のみ'];
  }

  // 個別項目を選んだら「現地費用のみ」を解除。
  const withoutLocalOnly = current.filter((item) => item !== '現地費用のみ');
  if (withoutLocalOnly.includes(option)) {
    return withoutLocalOnly.filter((item) => item !== option);
  }
  return [...withoutLocalOnly, option];
}

export function travelBudgetIncludesIncludeFlightsOrHotels(
  includes: TravelBudgetIncludeOption[],
): boolean {
  const safe = Array.isArray(includes) ? includes : [];
  // UI hint: use raw selection (do not invent defaults the user never picked).
  return safe.includes('航空券') || safe.includes('ホテル');
}

/** Form initial state: nothing pre-selected. */
export function createDefaultTravelBudgetIncludes(): TravelBudgetIncludeOption[] {
  return [];
}