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
    console.error('[HealthCheck] invalid API config', validation.issues);
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
      console.error('[HealthCheck] response not ok', {
        status: response.status,
        statusText: response.statusText,
        text,
      });
    }
  } catch (error) {
    console.error('[HealthCheck] failed raw', error);
    console.error('[HealthCheck] failed details', {
      name: error instanceof Error ? error.name : undefined,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      requestUrl: logUrl,
      origin: getWindowOriginForLog(),
    });
  }
}

/** Dev-only: call from Safari console as `globalThis.__nanisuruHealthCheck()` */
export function installPlanApiHealthCheckDevHook(): void {
  if (!__DEV__ || typeof globalThis === 'undefined') return;

  (globalThis as Record<string, unknown>).__nanisuruHealthCheck = () => runPlanApiHealthCheck();

  void runPlanApiHealthCheck();
}
