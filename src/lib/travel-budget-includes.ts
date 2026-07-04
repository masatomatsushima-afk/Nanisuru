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
  includes: TravelBudgetIncludeOption[],
): TravelBudgetIncludeCategory[] {
  const hasLocalOnly = includes.includes('現地費用のみ');
  let resolved = includes.filter(
    (item): item is TravelBudgetIncludeCategory => item !== '現地費用のみ',
  );

  if (hasLocalOnly) {
    resolved = resolved.filter((item) => item !== '航空券' && item !== 'ホテル');
  }

  if (resolved.length === 0) {
    return [...DEFAULT_TRAVEL_BUDGET_INCLUDES];
  }

  return resolved;
}

export function travelBudgetIncludesToBudgetScope(
  includes: TravelBudgetIncludeOption[],
): BudgetScopeSettings {
  const resolved = resolveTravelBudgetIncludes(includes);
  const hasLocalOnly = includes.includes('現地費用のみ');
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
  const includes = settings.includedItems
    .map((item) => SCOPE_TO_TRAVEL_INCLUDE[item])
    .filter(Boolean) as TravelBudgetIncludeOption[];

  if (settings.localOnly) {
    return [...resolveTravelBudgetIncludes(includes), '現地費用のみ'];
  }

  return resolveTravelBudgetIncludes(includes);
}

export function toggleTravelBudgetInclude(
  includes: TravelBudgetIncludeOption[],
  option: TravelBudgetIncludeOption,
): TravelBudgetIncludeOption[] {
  if (option === '現地費用のみ') {
    if (includes.includes('現地費用のみ')) {
      return includes.filter((item) => item !== '現地費用のみ');
    }
    return [
      ...includes.filter((item) => item !== '航空券' && item !== 'ホテル'),
      '現地費用のみ',
    ];
  }

  let next = includes.includes(option)
    ? includes.filter((item) => item !== option)
    : [...includes, option];

  if (option === '航空券' || option === 'ホテル') {
    next = next.filter((item) => item !== '現地費用のみ');
  }

  return next;
}

export function travelBudgetIncludesIncludeFlightsOrHotels(
  includes: TravelBudgetIncludeOption[],
): boolean {
  const resolved = resolveTravelBudgetIncludes(includes);
  return resolved.includes('航空券') || resolved.includes('ホテル');
}

export function createDefaultTravelBudgetIncludes(): TravelBudgetIncludeOption[] {
  return [...DEFAULT_TRAVEL_BUDGET_INCLUDES];
}