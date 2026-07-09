/** Shared dev fallback helpers for client + /api/generate-plan. */

export const DEV_FALLBACK_PLAN_NOTICE =
  'AIの応答に時間がかかったため、テスト用プランを表示しています';

export const DEV_FALLBACK_API_MARKER = 'nanisuru_dev_fallback';

const DEV_FALLBACK_ERROR_PATTERNS = [
  /etimedout/i,
  /request timed out/i,
  /timed out/i,
  /timeout/i,
  /bad gateway/i,
  /service unavailable/i,
  /gateway timeout/i,
  /502/i,
  /503/i,
  /504/i,
];

/** Generic network failures (Wi-Fi drop, wrong LAN IP, offline, etc.) — also expected in dev. */
const DEV_FALLBACK_NETWORK_PATTERNS = [
  /network request failed/i,
  /failed to fetch/i,
  /load failed/i,
  /network error/i,
  /econnrefused/i,
  /econnreset/i,
  /internet connection/i,
  /offline/i,
];

/** AI response came back malformed/empty — also expected in dev, use the fallback plan instead. */
const DEV_FALLBACK_PARSE_ERROR_PATTERNS = [
  /プランの形式が正しくありません/,
  /json parse error/i,
  /unexpected token/i,
  /is not valid json/i,
  /unexpected end of json input/i,
  /aiからの応答が空でした/,
];

export function isDevFallbackEligibleError(error: unknown): boolean {
  if (!__DEV__) return false;

  if (error instanceof Error && error.name === 'AiGenerationTimeoutError') {
    return true;
  }

  if (error instanceof Error && error.name === 'OpenAiRequestError') {
    const openAiError = error as Error & { status?: number; body?: string };
    if (openAiError.status != null && [502, 503, 504].includes(openAiError.status)) {
      return true;
    }
  }

  // Generic network / connection failures (e.g. PlanGenerationRequestError with code
  // 'NETWORK_ERROR') are just as expected in dev as a timeout — never a red-screen crash.
  if (
    error instanceof Error &&
    (error.name === 'PlanGenerationRequestError' || error.name === 'AppError') &&
    (error as Error & { code?: string }).code === 'NETWORK_ERROR'
  ) {
    return true;
  }

  const record =
    error && typeof error === 'object'
      ? (error as { status?: number; statusText?: string; body?: string; message?: string; code?: string })
      : null;

  const status = record?.status;
  if (status != null && [502, 503, 504].includes(status)) {
    return true;
  }

  const combined = [
    record?.code,
    record?.message,
    record?.body,
    record?.statusText,
    error instanceof Error ? error.message : String(error),
  ]
    .filter(Boolean)
    .join(' ');

  return (
    DEV_FALLBACK_ERROR_PATTERNS.some((pattern) => pattern.test(combined)) ||
    DEV_FALLBACK_NETWORK_PATTERNS.some((pattern) => pattern.test(combined)) ||
    DEV_FALLBACK_PARSE_ERROR_PATTERNS.some((pattern) => pattern.test(combined))
  );
}

export function isDevFallbackApiResponse(data: unknown): data is {
  nanisuru_dev_fallback: true;
  devFallbackNotice?: string;
} {
  return Boolean(
    data &&
      typeof data === 'object' &&
      (data as { nanisuru_dev_fallback?: boolean }).nanisuru_dev_fallback === true,
  );
}

export function isRetryableOpenAiProxyFailure(status: number, bodyOrMessage: string): boolean {
  if ([502, 503, 504].includes(status)) return true;
  return DEV_FALLBACK_ERROR_PATTERNS.some((pattern) => pattern.test(bodyOrMessage));
}

export function isDevelopmentRuntime(): boolean {
  return process.env.NODE_ENV !== 'production';
}
