/** Safely coerce unknown values to display strings (avoids Symbol→string throws on web). */
export function safeText(value: unknown): string {
  if (typeof value === 'symbol') return '';
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

/** Safely coerce unknown values to React keys. */
export function safeKey(value: unknown, fallback: string): string {
  const text = safeText(value);
  return text || fallback;
}

/** Expo Router params must be plain strings — never Symbols or objects. */
export function safeRouteParams(params: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'symbol') continue;
    if (value == null) continue;
    if (typeof value === 'string') {
      out[key] = value;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      out[key] = String(value);
    }
  }
  return out;
}

/** Build a stable chip/list key from section name + option fields. */
export function safeChipKey(
  sectionName: string,
  option: { id?: unknown; label?: unknown },
  index: number,
): string {
  const idPart = safeKey(option.id, '');
  const labelPart = safeKey(option.label, '');
  const base = idPart || labelPart || `item-${index}`;
  return `${safeKey(sectionName, 'section')}-${base}-${index}`;
}
