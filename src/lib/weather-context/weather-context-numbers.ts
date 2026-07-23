/**
 * Safe numeric helpers for Weather Context — never emit NaN / Infinity.
 */

export function finiteNumber(value: unknown): number | null {
  if (typeof value !== 'number') return null;
  if (!Number.isFinite(value)) return null;
  return value;
}

export function finiteInt(value: unknown): number | null {
  const n = finiteNumber(value);
  if (n === null) return null;
  return Math.trunc(n);
}

export function isValidLatitude(value: number): boolean {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

export function isValidLongitude(value: number): boolean {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

export function parseIsoDateOnly(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const [y, m, d] = trimmed.split('-').map((part) => Number(part));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    return null;
  }
  return trimmed;
}

/** Inclusive YYYY-MM-DD range as sorted unique date strings. */
export function enumerateDateRange(startDate: string, endDate: string): string[] {
  const start = parseIsoDateOnly(startDate);
  const end = parseIsoDateOnly(endDate);
  if (!start || !end || start > end) return [];

  const out: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    out.push(cursor);
    const [y, m, d] = cursor.split('-').map((part) => Number(part));
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    const yy = next.getUTCFullYear();
    const mm = String(next.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(next.getUTCDate()).padStart(2, '0');
    cursor = `${yy}-${mm}-${dd}`;
    if (out.length > 366) break;
  }
  return out;
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatDisplayDate(parts: {
  year?: number;
  month?: number;
  day?: number;
}): string | null {
  const y = finiteInt(parts.year);
  const m = finiteInt(parts.month);
  const d = finiteInt(parts.day);
  if (y === null || m === null || d === null) return null;
  if (y < 1 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/** Extract YYYY-MM-DD from RFC3339 / ISO datetime (UTC calendar date — used only as fallback). */
export function dateFromIsoTimestamp(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? parseIsoDateOnly(match[1]) : null;
}
