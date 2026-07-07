import { Platform } from 'react-native';

import { APP_MESSAGES } from './app-errors';

/** Web browsers (incl. iPhone Safari) must use same-origin API proxy — not direct OpenAI. */
export function shouldUsePlanGenerationApiProxy(): boolean {
  return Platform.OS === 'web';
}

const GENERATE_PLAN_PATH = '/api/generate-plan';
const HEALTH_PATH = '/api/health';

const INVALID_ORIGIN_PATTERNS = [/localhost/i, /127\.0\.0\.1/, /^exp:\/\//];

/** Relative URL — resolves against current origin (LAN IP, localhost, production). */
export function getGeneratePlanApiUrl(): string {
  return GENERATE_PLAN_PATH;
}

export function getHealthCheckApiUrl(): string {
  return HEALTH_PATH;
}

export function getWindowOriginForLog(): string {
  if (typeof window === 'undefined') return 'no-window';
  return window.location?.origin ?? 'no-origin';
}

/** Full URL for logs only (never hardcode localhost). */
export function getGeneratePlanApiUrlForLog(): string {
  return resolvePlanApiUrlForLog(GENERATE_PLAN_PATH);
}

export function getHealthCheckApiUrlForLog(): string {
  return resolvePlanApiUrlForLog(HEALTH_PATH);
}

export function resolvePlanApiUrlForLog(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const origin = getWindowOriginForLog();
  if (origin === 'no-window' || origin === 'no-origin') {
    return normalizedPath;
  }
  return `${origin}${normalizedPath}`;
}

export type PlanApiUrlValidation = {
  ok: boolean;
  fetchUrl: string;
  logUrl: string;
  origin: string;
  issues: string[];
  userMessage?: string;
};

export function validatePlanApiRequestConfig(path: string = GENERATE_PLAN_PATH): PlanApiUrlValidation {
  const fetchUrl = path.startsWith('/') ? path : `/${path}`;
  const origin = getWindowOriginForLog();
  const logUrl = resolvePlanApiUrlForLog(fetchUrl);
  const issues: string[] = [];

  if (!fetchUrl || fetchUrl === '/api/undefined' || fetchUrl.includes('undefined')) {
    issues.push(`invalid fetch path: ${fetchUrl}`);
  }
  if (fetchUrl.startsWith('exp://')) {
    issues.push('fetch URL uses exp:// scheme');
  }
  if (/^https?:\/\/(localhost|127\.0\.0\.1)/i.test(fetchUrl)) {
    issues.push('fetch URL points to localhost/127.0.0.1');
  }
  if (origin !== 'no-window' && origin !== 'no-origin') {
    if (INVALID_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin))) {
      issues.push(`window origin is not reachable from mobile Safari: ${origin}`);
    }
    if (origin.startsWith('exp://')) {
      issues.push(`window origin uses exp://: ${origin}`);
    }
  }

  let userMessage: string | undefined;
  if (issues.some((issue) => /localhost|127\.0\.0\.1|exp:\/\//i.test(issue))) {
    userMessage = APP_MESSAGES.planApiBadOrigin;
  } else if (issues.length > 0) {
    userMessage = APP_MESSAGES.planApiUnreachable;
  }

  return {
    ok: issues.length === 0,
    fetchUrl,
    logUrl,
    origin,
    issues,
    userMessage,
  };
}
