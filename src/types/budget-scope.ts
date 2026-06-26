export const BUDGET_SCOPE_OPTIONS = [
  '食事',
  'カフェ',
  'アクティビティ',
  '交通費',
  '宿泊費',
  '飛行機代',
  '電車・新幹線',
  'レンタカー',
  '買い物',
  'お土産',
  '予備費',
] as const;

export type BudgetScopeItem = (typeof BUDGET_SCOPE_OPTIONS)[number];

export type BudgetBreakdownKey =
  | 'food'
  | 'cafe'
  | 'activity'
  | 'transportation'
  | 'accommodation'
  | 'flight'
  | 'rail'
  | 'rentalCar'
  | 'shopping'
  | 'souvenirs'
  | 'contingency';

export type BudgetCustomLineItem = {
  label: string;
  amount: string;
};

export type BudgetScopeSettings = {
  includedItems: BudgetScopeItem[];
  excludeAlreadyPaid: boolean;
  alreadyPaidItems: BudgetScopeItem[];
  customItems: string[];
  flightsBooked?: boolean;
  hotelsBooked?: boolean;
};

export const BUDGET_SCOPE_META: Record<
  BudgetScopeItem,
  { breakdownKey: BudgetBreakdownKey; icon: string }
> = {
  食事: { breakdownKey: 'food', icon: '🍽' },
  カフェ: { breakdownKey: 'cafe', icon: '☕' },
  アクティビティ: { breakdownKey: 'activity', icon: '🎯' },
  交通費: { breakdownKey: 'transportation', icon: '🚃' },
  宿泊費: { breakdownKey: 'accommodation', icon: '🏨' },
  飛行機代: { breakdownKey: 'flight', icon: '✈️' },
  '電車・新幹線': { breakdownKey: 'rail', icon: '🚄' },
  レンタカー: { breakdownKey: 'rentalCar', icon: '🚗' },
  買い物: { breakdownKey: 'shopping', icon: '🛍' },
  お土産: { breakdownKey: 'souvenirs', icon: '🎁' },
  予備費: { breakdownKey: 'contingency', icon: '💰' },
};

export const BUDGET_BREAKDOWN_KEY_LABELS: Record<BudgetBreakdownKey, string> = {
  food: '食事',
  cafe: 'カフェ',
  activity: 'アクティビティ',
  transportation: '交通費',
  accommodation: '宿泊費',
  flight: '飛行機代',
  rail: '電車・新幹線',
  rentalCar: 'レンタカー',
  shopping: '買い物',
  souvenirs: 'お土産',
  contingency: '予備費',
};
