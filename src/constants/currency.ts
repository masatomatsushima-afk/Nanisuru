export const CURRENCY_OPTIONS = [
  { code: 'JPY', symbol: '¥', label: '日本円' },
  { code: 'AUD', symbol: 'A$', label: '豪ドル' },
  { code: 'USD', symbol: '$', label: '米ドル' },
  { code: 'KRW', symbol: '₩', label: '韓国ウォン' },
  { code: 'EUR', symbol: '€', label: 'ユーロ' },
] as const;

export type CurrencyCode = (typeof CURRENCY_OPTIONS)[number]['code'];

export function getCurrency(code: CurrencyCode) {
  return CURRENCY_OPTIONS.find((c) => c.code === code) ?? CURRENCY_OPTIONS[0];
}

export function parseCurrencyCode(value: string | undefined): CurrencyCode {
  const found = CURRENCY_OPTIONS.find((c) => c.code === value);
  return found?.code ?? 'JPY';
}

export function formatAmount(amount: number, currency: CurrencyCode): string {
  const { symbol } = getCurrency(currency);
  const locale = currency === 'JPY' || currency === 'KRW' ? 'ja-JP' : 'en-US';
  const formatted = amount.toLocaleString(locale, { maximumFractionDigits: 0 });
  return `${symbol}${formatted}`;
}

export function formatBudgetDisplay(
  budget: string,
  people: string,
  currency: CurrencyCode,
): string {
  const amount = parseInt(budget.replace(/[^\d]/g, ''), 10);
  const count = parseInt(people, 10) || 1;

  if (amount > 0) {
    const perPerson = Math.round(amount / count);
    return count > 1
      ? `約 ${formatAmount(amount, currency)}（1人あたり ${formatAmount(perPerson, currency)}）`
      : `約 ${formatAmount(amount, currency)}`;
  }

  return '';
}

export function getBudgetPlaceholder(currency: CurrencyCode): string {
  const examples: Record<CurrencyCode, string> = {
    JPY: '10000',
    AUD: '150',
    USD: '100',
    KRW: '100000',
    EUR: '80',
  };
  return `例）${examples[currency]}`;
}

export const BUDGET_PRESETS: Record<CurrencyCode, readonly number[]> = {
  JPY: [3000, 5000, 10000, 20000, 50000],
  AUD: [30, 50, 100, 150, 300],
  USD: [25, 50, 100, 150, 250],
  KRW: [30000, 50000, 100000, 200000, 500000],
  EUR: [25, 50, 80, 120, 200],
};

export function getBudgetPresets(currency: CurrencyCode): readonly number[] {
  return BUDGET_PRESETS[currency];
}
