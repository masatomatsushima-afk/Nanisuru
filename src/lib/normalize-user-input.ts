/** Normalize general user text: width, spaces, trim. */
export function normalizeUserInput(input: string): string {
  return input
    .normalize('NFKC')
    .replace(/\u3000/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Strip currency symbols, commas, spaces; return digits only. */
export function normalizeNumberInput(input: string): string {
  return normalizeBudgetInput(input);
}

/** Strip currency symbols, commas, spaces; return digits only. */
export function normalizeBudgetInput(input: string): string {
  return normalizeUserInput(input)
    .replace(/[¥$€₩£]/g, '')
    .replace(/[,，]/g, '')
    .replace(/[^\d]/g, '');
}

export function parseBudgetAmount(input: string): number | null {
  const digits = normalizeBudgetInput(input);
  if (!digits) return null;
  const amount = Number.parseInt(digits, 10);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return amount;
}

/** Accept 2, ２, 2人, ２人 → digits only. */
export function normalizePeopleCount(input: string): string {
  return normalizePeopleCountInput(input);
}

/** Accept 2, ２, 2人, ２人 → digits only. */
export function normalizePeopleCountInput(input: string): string {
  return normalizeUserInput(input)
    .replace(/人/g, '')
    .replace(/[^\d]/g, '');
}

export function parsePeopleCount(input: string): number | null {
  const digits = normalizePeopleCountInput(input);
  if (!digits) return null;
  const count = Number.parseInt(digits, 10);
  if (!Number.isFinite(count) || count <= 0) return null;
  return count;
}

const HH_MM_PATTERN = /^([01]?\d|2[0-4]):([0-5]\d)$/;

function formatTimeParts(hours: number, minutes: number): string | null {
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 24 || minutes < 0 || minutes > 59) return null;
  if (hours === 24 && minutes !== 0) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Normalize free-form time input to HH:mm, or '' for 未定 / empty.
 * Returns null when input is non-empty but invalid.
 */
export function normalizeTimeInput(input: string): string | null {
  const raw = normalizeUserInput(input)
    .replace(/[Ｐｐ][Ｍｍ]/gi, '')
    .trim();

  if (!raw || raw === '未定') {
    return '';
  }

  if (HH_MM_PATTERN.test(raw)) {
    const [, h, m] = raw.match(HH_MM_PATTERN) ?? [];
    return formatTimeParts(Number.parseInt(h!, 10), Number.parseInt(m!, 10));
  }

  const jpTime = raw.match(/^(\d{1,2})\s*時\s*(\d{1,2})?\s*分?$/);
  if (jpTime) {
    const hours = Number.parseInt(jpTime[1]!, 10);
    const minutes = jpTime[2] ? Number.parseInt(jpTime[2], 10) : 0;
    return formatTimeParts(hours, minutes);
  }

  const colonForm = raw.replace(/：/g, ':');
  const colonMatch = colonForm.match(/^(\d{1,2}):(\d{1,2})$/);
  if (colonMatch) {
    return formatTimeParts(
      Number.parseInt(colonMatch[1]!, 10),
      Number.parseInt(colonMatch[2]!, 10),
    );
  }

  const compact = raw.replace(/[:：]/g, '');
  if (/^\d{3,4}$/.test(compact)) {
    const padded = compact.padStart(4, '0');
    return formatTimeParts(
      Number.parseInt(padded.slice(0, 2), 10),
      Number.parseInt(padded.slice(2), 10),
    );
  }

  if (/^\d{1,2}$/.test(compact)) {
    return formatTimeParts(Number.parseInt(compact, 10), 0);
  }

  return null;
}

export function isValidNormalizedTime(value: string | undefined | null): boolean {
  if (!value?.trim()) return true;
  return normalizeTimeInput(value) !== null;
}

export const TIME_PERIOD_PRESETS = [
  { id: 'unset', label: '未定', value: '' },
  { id: 'early', label: '早朝', value: '06:00' },
  { id: 'morning', label: '午前', value: '09:00' },
  { id: 'noon', label: '昼ごろ', value: '12:00' },
  { id: 'afternoon', label: '午後', value: '14:00' },
  { id: 'evening', label: '夕方', value: '17:00' },
  { id: 'night', label: '夜', value: '19:00' },
] as const;

export function buildHalfHourTimeSlots(): string[] {
  const slots: string[] = [];
  for (let hour = 6; hour <= 24; hour += 1) {
    for (const minute of [0, 30]) {
      if (hour === 24 && minute > 0) break;
      slots.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
    }
  }
  return slots;
}

export function formatTimeDisplay(value: string | undefined): string {
  if (!value?.trim()) return '未定';
  const preset = TIME_PERIOD_PRESETS.find((item) => item.value === value && item.value);
  if (preset && preset.id !== 'unset') {
    return `${preset.label} (${value})`;
  }
  return value;
}
