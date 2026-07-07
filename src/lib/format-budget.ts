/** Shared budget formatting helpers so MVP AI responses and dev fallback plans read consistently. */

export function formatBudgetAmount(raw: string | number | undefined | null): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  const numeric = Number.parseInt(String(raw ?? '').replace(/[^\d]/g, ''), 10);
  return Number.isFinite(numeric) ? numeric : 0;
}

/** e.g. formatBudgetDisplay(200000, 'KRW') -> "200,000 KRW" */
export function formatBudgetDisplay(amount: number, currency: string | undefined | null): string {
  const trimmedCurrency = currency?.trim();
  if (!amount) {
    return trimmedCurrency ? `予算未定（${trimmedCurrency}）` : '予算未定';
  }
  const formatted = amount.toLocaleString('en-US');
  return trimmedCurrency ? `${formatted} ${trimmedCurrency}` : formatted;
}
