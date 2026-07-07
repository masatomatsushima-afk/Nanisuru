import {
  getHealthCheckApiUrl,
  getHealthCheckApiUrlForLog,
  getWindowOriginForLog,
  validatePlanApiRequestConfig,
} from './plan-api-url';

export async function runPlanApiHealthCheck(): Promise<void> {
  const validation = validatePlanApiRequestConfig('/api/health');
  const requestUrl = getHealthCheckApiUrl();
  const logUrl = getHealthCheckApiUrlForLog();

  console.log('[HealthCheck] starting', {
    requestUrl,
    logUrl,
    origin: getWindowOriginForLog(),
    validation,
  });

  if (!validation.ok) {
    // Not fatal — just informational (e.g. Mac Safari on localhost can't be reached from iPhone).
    // Never console.error here: Expo's web dev tooling turns console.error into a red LogBox screen.
    console.warn('[HealthCheck] invalid API config', validation.issues);
  }

  try {
    const response = await fetch(requestUrl);
    const text = await response.text();
    console.log('[HealthCheck]', {
      ok: response.ok,
      status: response.status,
      text,
      requestUrl: logUrl,
    });
    if (!response.ok) {
      console.warn('[HealthCheck] response not ok', {
        status: response.status,
        statusText: response.statusText,
        text,
      });
    }
  } catch (error) {
    console.warn('[HealthCheck] failed', {
      name: error instanceof Error ? error.name : undefined,
      message: error instanceof Error ? error.message : String(error),
      requestUrl: logUrl,
      origin: getWindowOriginForLog(),
    });
  }
}

/** Dev-only: call from Safari console as `globalThis.__nanisuruHealthCheck()`. */
export function installPlanApiHealthCheckDevHook(options: { autoRun?: boolean } = {}): void {
  if (!__DEV__ || typeof globalThis === 'undefined') return;

  (globalThis as Record<string, unknown>).__nanisuruHealthCheck = () => runPlanApiHealthCheck();

  if (options.autoRun ?? true) {
    void runPlanApiHealthCheck();
  }
}
