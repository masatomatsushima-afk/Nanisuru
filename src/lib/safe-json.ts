import { safeText } from '@/lib/safe-text';

export function safeJsonParse<T>(value: unknown, fallback: T): T {
  try {
    if (value == null) return fallback;
    if (typeof value === 'object') return value as T;
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    return JSON.parse(trimmed) as T;
  } catch (error) {
    console.error('[JSON] parse failed', {
      value: typeof value === 'string' ? value.slice(0, 500) : value,
      error,
    });
    return fallback;
  }
}

/** Remove non-JSON-safe values (Symbols, functions, Dates → ISO strings, etc.). */
export function cleanSerializable<T>(value: T): T {
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch (error) {
    console.error('[JSON] clean serialize failed', error);
    return value;
  }
}

export function stripJsonCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenceMatch) return fenceMatch[1].trim();
  return trimmed;
}

export function serializeRouteParamJson(value: unknown): string {
  const clean = cleanSerializable(value);
  const json = JSON.stringify(clean);
  return encodeURIComponent(json);
}

export function readRouteParam(value: string | string[] | undefined): string {
  return safeText(Array.isArray(value) ? value[0] : value);
}

export function deserializeRouteParamJson<T>(value: string | string[] | undefined, fallback: T): T {
  const raw = readRouteParam(value);
  if (!raw) return fallback;

  const direct = safeJsonParse<T | null>(raw, null);
  if (direct != null) return direct;

  try {
    const decoded = decodeURIComponent(raw);
    if (decoded !== raw) {
      const parsed = safeJsonParse<T | null>(decoded, null);
      if (parsed != null) return parsed;
    }
  } catch {
    // Not URI-encoded — fall through to fallback.
  }

  return fallback;
}

export function isJsonParseError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return (
    /JSON Parse error/i.test(message) ||
    /Unexpected token/i.test(message) ||
    /is not valid JSON/i.test(message) ||
    /Unexpected end of JSON input/i.test(message)
  );
}
