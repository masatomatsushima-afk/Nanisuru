import { APP_MESSAGES } from './app-errors';
import { OpenAiRequestError } from './app-errors';

/** Client-side timeout for a single generation attempt (dev uses 90s per requirements). */
export const OPENAI_GENERATION_TIMEOUT_MS = __DEV__ ? 90_000 : 120_000;

export const OPENAI_RETRY_DELAYS_MS = [1_500, 3_000] as const;

export const OPENAI_MAX_GENERATION_ATTEMPTS = 3;

const RETRYABLE_HTTP_STATUSES = new Set([502, 503, 504]);

const RETRYABLE_MESSAGE_PATTERNS = [
  /502/i,
  /503/i,
  /504/i,
  /bad gateway/i,
  /service unavailable/i,
  /gateway timeout/i,
  /request timed out/i,
  /timed out/i,
  /timeout/i,
  /network timeout/i,
  /etimedout/i,
  /econnreset/i,
];

export class AiGenerationTimeoutError extends Error {
  constructor(message: string = APP_MESSAGES.aiGenerationTimeout) {
    super(message);
    this.name = 'AiGenerationTimeoutError';
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isRetryableOpenAiError(error: unknown): boolean {
  if (error instanceof AiGenerationTimeoutError) return true;

  if (error instanceof OpenAiRequestError) {
    if (RETRYABLE_HTTP_STATUSES.has(error.status)) return true;
    const combined = `${error.status} ${error.statusText} ${error.message} ${error.body}`;
    return RETRYABLE_MESSAGE_PATTERNS.some((pattern) => pattern.test(combined));
  }

  const message = error instanceof Error ? error.message : String(error);
  if (RETRYABLE_MESSAGE_PATTERNS.some((pattern) => pattern.test(message))) {
    return true;
  }

  if (error instanceof DOMException && error.name === 'AbortError') {
    return /timed out|timeout/i.test(message);
  }

  return false;
}

export function getOpenAiRetryDelayMs(attempt: number): number {
  return OPENAI_RETRY_DELAYS_MS[Math.min(attempt - 1, OPENAI_RETRY_DELAYS_MS.length - 1)] ?? 3_000;
}

export function createGenerationAbortSignal(userSignal?: AbortSignal): {
  signal: AbortSignal;
  cleanup: () => void;
  didTimeout: () => boolean;
} {
  const controller = new AbortController();
  let timedOut = false;

  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, OPENAI_GENERATION_TIMEOUT_MS);

  const onUserAbort = () => {
    controller.abort();
  };

  if (userSignal) {
    if (userSignal.aborted) {
      controller.abort();
    } else {
      userSignal.addEventListener('abort', onUserAbort);
    }
  }

  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    cleanup: () => {
      clearTimeout(timeoutId);
      userSignal?.removeEventListener('abort', onUserAbort);
    },
  };
}

export function resolveGenerationFetchError(
  error: unknown,
  userSignal: AbortSignal | undefined,
  didTimeout: () => boolean,
): never {
  if (userSignal?.aborted) {
    throw error instanceof Error ? error : new Error(String(error));
  }

  if (didTimeout() || error instanceof AiGenerationTimeoutError) {
    throw new AiGenerationTimeoutError();
  }

  if (error instanceof DOMException && error.name === 'AbortError') {
    throw new AiGenerationTimeoutError();
  }

  throw error instanceof Error ? error : new Error(String(error));
}
