import type { PlanCreationType } from '@/types/plan-creation';
import type {
  BudgetBreakdownKey,
  BudgetScopeItem,
  BudgetScopeSettings,
} from '@/types/budget-scope';
import { BUDGET_SCOPE_META } from '@/types/budget-scope';
import type { BudgetBreakdown } from '@/types/plan';

export function createDefaultBudgetScope(planType: PlanCreationType): BudgetScopeSettings {
  const isTravel =
    planType === '旅行プラン' || planType === '週末プラン';

  return {
    includedItems: isTravel
      ? ['食事', 'アクティビティ', '交通費', '宿泊費']
      : ['食事', 'カフェ', 'アクティビティ', '交通費'],
    excludeAlreadyPaid: false,
    alreadyPaidItems: [],
    customItems: [],
    flightsBooked: false,
    hotelsBooked: false,
  };
}

export function getBudgetItemsForCalculation(settings: BudgetScopeSettings): BudgetScopeItem[] {
  let items = [...settings.includedItems];

  if (settings.excludeAlreadyPaid && settings.alreadyPaidItems.length > 0) {
    items = items.filter((item) => !settings.alreadyPaidItems.includes(item));
  }

  if (settings.flightsBooked) {
    items = items.filter((item) => item !== '飛行機代');
  }

  if (settings.hotelsBooked) {
    items = items.filter((item) => item !== '宿泊費');
  }

  return items;
}

export function getBreakdownKeysForScope(settings: BudgetScopeSettings): BudgetBreakdownKey[] {
  const items = getBudgetItemsForCalculation(settings);
  const keys = items.map((item) => BUDGET_SCOPE_META[item].breakdownKey);
  return [...new Set(keys)];
}

export function toggleBudgetScopeItem(
  settings: BudgetScopeSettings,
  item: BudgetScopeItem,
): BudgetScopeSettings {
  const included = settings.includedItems.includes(item)
    ? settings.includedItems.filter((value) => value !== item)
    : [...settings.includedItems, item];

  return {
    ...settings,
    includedItems: included,
    alreadyPaidItems: settings.alreadyPaidItems.filter((value) => included.includes(value)),
  };
}

export function toggleAlreadyPaidItem(
  settings: BudgetScopeSettings,
  item: BudgetScopeItem,
): BudgetScopeSettings {
  if (!settings.includedItems.includes(item)) return settings;

  const alreadyPaid = settings.alreadyPaidItems.includes(item)
    ? settings.alreadyPaidItems.filter((value) => value !== item)
    : [...settings.alreadyPaidItems, item];

  return { ...settings, alreadyPaidItems: alreadyPaid };
}

export function parseCustomBudgetItemsText(text: string): string[] {
  return text
    .split(/[,、，\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function formatCustomBudgetItemsText(items: string[]): string {
  return items.join('、');
}

export type BudgetDisplayRow = {
  key: string;
  label: string;
  icon: string;
  amount: string;
};

export function getBudgetDisplayRows(
  breakdown: BudgetBreakdown,
  settings?: BudgetScopeSettings,
): BudgetDisplayRow[] {
  const rows: BudgetDisplayRow[] = [];
  const activeKeys = settings ? getBreakdownKeysForScope(settings) : null;

  const keyOrder: BudgetBreakdownKey[] = [
    'flight',
    'accommodation',
    'rail',
    'rentalCar',
    'transportation',
    'food',
    'cafe',
    'activity',
    'shopping',
    'souvenirs',
    'contingency',
  ];

  for (const key of keyOrder) {
    if (activeKeys && !activeKeys.includes(key)) continue;
    const amount = breakdown[key];
    if (!amount?.trim()) continue;

    const scopeItem = Object.entries(BUDGET_SCOPE_META).find(
      ([, meta]) => meta.breakdownKey === key,
    );
    rows.push({
      key,
      label: scopeItem?.[0] ?? key,
      icon: scopeItem?.[1].icon ?? '💴',
      amount,
    });
  }

  if (!settings || settings.customItems.length > 0) {
    for (const custom of breakdown.customItems ?? []) {
      if (!custom.amount?.trim()) continue;
      if (
        settings &&
        settings.customItems.length > 0 &&
        !settings.customItems.includes(custom.label)
      ) {
        continue;
      }
      rows.push({
        key: `custom:${custom.label}`,
        label: custom.label,
        icon: '📝',
        amount: custom.amount,
      });
    }
  }

  if (rows.length === 0) {
    const legacyRows: Array<{ key: BudgetBreakdownKey; label: string; icon: string }> = [
      { key: 'accommodation', label: '宿泊費', icon: '🏨' },
      { key: 'food', label: '食事', icon: '🍽' },
      { key: 'transportation', label: '交通費', icon: '🚃' },
      { key: 'activity', label: 'アクティビティ', icon: '🎯' },
    ];
    for (const row of legacyRows) {
      const amount = breakdown[row.key];
      if (amount?.trim()) {
        rows.push({ ...row, amount });
      }
    }
  }

  return rows;
}

export function buildBudgetScopePromptSection(
  settings: BudgetScopeSettings,
  budget: string,
  currency: string,
  people: string,
  durationLabel: string,
): string {
  const calculationItems = getBudgetItemsForCalculation(settings);
  const excludedPaid = settings.includedItems.filter(
    (item) => !calculationItems.includes(item),
  );

  const lines = [
    `- **予算に含める項目**: ${settings.includedItems.join('、') || '未指定'}`,
    `- **予算計算に使う項目**: ${calculationItems.join('、') || '未指定'}`,
  ];

  if (settings.excludeAlreadyPaid && excludedPaid.length > 0) {
    lines.push(`- **支払い済みのため予算から除外**: ${excludedPaid.join('、')}`);
  }

  if (settings.flightsBooked) {
    lines.push('- **飛行機**: すでに予約済み（budgetBreakdown.flight は「支払い済み」または省略）');
  }

  if (settings.hotelsBooked) {
    lines.push('- **宿泊**: すでに予約済み（budgetBreakdown.accommodation は「支払い済み」または省略）');
  }

  if (settings.customItems.length > 0) {
    lines.push(
      `- **その他の予算項目**: ${settings.customItems.join('、')}（customItems に個別行を追加）`,
    );
  }

  lines.push(
    `- 入力予算: ${budget.trim() || '未指定'} ${currency} / ${people.trim() || '1'}人 / ${durationLabel}`,
    '- **budgetBreakdown には選択された項目だけ**を含めること（未選択のカテゴリは出力しない）',
    '- total は選択項目の合計概算。支払い済み項目は合計に含めない',
  );

  return `

## 予算スコープ（★必ず反映★）
${lines.join('\n')}`;
}

export const BUDGET_KEY_DESCRIPTIONS: Record<BudgetBreakdownKey, string> = {
  food: '食事費概算',
  cafe: 'カフェ・軽食費概算',
  activity: 'アクティビティ・入場料等の概算',
  transportation: '現地交通費概算（タクシー・バス等）',
  accommodation: '宿泊費概算',
  flight: '飛行機代概算',
  rail: '電車・新幹線等の鉄道費概算',
  rentalCar: 'レンタカー費概算',
  shopping: '買い物費概算',
  souvenirs: 'お土産費概算',
  contingency: '予備費概算',
};
