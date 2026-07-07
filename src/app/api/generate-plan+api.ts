/**
 * Server-side OpenAI proxy for web / mobile Safari.
 * API key stays on the server — never sent to the browser.
 */

import {
  DEV_FALLBACK_API_MARKER,
  DEV_FALLBACK_PLAN_NOTICE,
  isDevelopmentRuntime,
  isRetryableOpenAiProxyFailure,
} from '@/lib/openai-dev-fallback';
import {
  getPromptLengthFromRequestPayload,
  type PlanGenerationDevMeta,
} from '@/lib/plan-generation-dev-meta';

const PLACEHOLDER_KEYS = new Set(['', 'sk-your-key-here', 'your-api-key-here']);

const OPENAI_PROXY_TIMEOUT_MS = isDevelopmentRuntime() ? 45_000 : 90_000;
const OPENAI_PROXY_RETRY_DELAYS_MS = [1_500, 3_000];
const OPENAI_PROXY_MAX_ATTEMPTS = 3;

function getServerOpenAiApiKey(): string | undefined {
  const key = (process.env.OPENAI_API_KEY ?? process.env.EXPO_PUBLIC_OPENAI_API_KEY)?.trim();
  if (!key || PLACEHOLDER_KEYS.has(key)) return undefined;
  return key;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type ForwardResult =
  | { kind: 'response'; response: Response; body: string }
  | { kind: 'network_error'; message: string; code?: string };

async function forwardToOpenAi(
  apiKey: string,
  requestPayload: unknown,
  attempt: number,
): Promise<ForwardResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OPENAI_PROXY_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestPayload),
      signal: controller.signal,
    });
    const body = await response.text();
    return { kind: 'response', response, body };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'OpenAI fetch failed';
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: unknown }).code ?? '')
        : undefined;
    console.error('[api/generate-plan] OpenAI fetch failed', { attempt, error, code });
    return { kind: 'network_error', message, code };
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildDevFallbackApiResponse(): Response {
  console.warn('[api/generate-plan] returning dev fallback plan marker');
  return Response.json(
    {
      [DEV_FALLBACK_API_MARKER]: true,
      devFallbackNotice: DEV_FALLBACK_PLAN_NOTICE,
    },
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

export async function POST(request: Request): Promise<Response> {
  const apiKey = getServerOpenAiApiKey();
  if (!apiKey) {
    console.error('[api/generate-plan] missing OPENAI_API_KEY');
    return Response.json(
      { error: { message: 'OpenAI API key is not configured on the server.' } },
      { status: 503 },
    );
  }

  let body: { requestPayload?: unknown; devMeta?: PlanGenerationDevMeta };
  try {
    body = (await request.json()) as { requestPayload?: unknown; devMeta?: PlanGenerationDevMeta };
  } catch (error) {
    console.error('[api/generate-plan] invalid JSON body', error);
    return Response.json({ error: { message: 'Invalid request body' } }, { status: 400 });
  }

  const requestPayload = body.requestPayload;
  if (!requestPayload || typeof requestPayload !== 'object') {
    return Response.json({ error: { message: 'requestPayload is required' } }, { status: 400 });
  }

  const devMeta = body.devMeta;
  const promptLength = getPromptLengthFromRequestPayload(requestPayload);
  console.log('[api/generate-plan] prompt length', promptLength);
  console.log('[api/generate-plan] payload summary', {
    destination: devMeta?.destination ?? 'unknown',
    durationLabel: devMeta?.durationLabel ?? 'unknown',
    companion: devMeta?.companion ?? 'unknown',
    travelPurpose: devMeta?.travelPurpose ?? 'unknown',
    budget: devMeta?.budget ?? 'unknown',
    currency: devMeta?.currency ?? 'unknown',
  });

  console.log('[api/generate-plan] forwarding to OpenAI');

  let lastFailureMessage = 'OpenAI request failed';

  for (let attempt = 1; attempt <= OPENAI_PROXY_MAX_ATTEMPTS; attempt++) {
    const result = await forwardToOpenAi(apiKey, requestPayload, attempt);

    if (result.kind === 'network_error') {
      lastFailureMessage = [result.code, result.message].filter(Boolean).join(' | ');
      if (
        attempt >= OPENAI_PROXY_MAX_ATTEMPTS ||
        !isRetryableOpenAiProxyFailure(502, lastFailureMessage)
      ) {
        if (isDevelopmentRuntime() && isRetryableOpenAiProxyFailure(502, lastFailureMessage)) {
          return buildDevFallbackApiResponse();
        }
        return Response.json({ error: { message: lastFailureMessage, code: result.code } }, { status: 502 });
      }

      console.warn('[api/generate-plan] retrying OpenAI', {
        attempt,
        error: lastFailureMessage,
      });
      await sleep(OPENAI_PROXY_RETRY_DELAYS_MS[attempt - 1] ?? 3_000);
      continue;
    }

    const { response: openAiResponse, body: responseText } = result;
    lastFailureMessage = responseText;

    console.log('[api/generate-plan] OpenAI status', openAiResponse.status, { attempt });

    if (openAiResponse.ok) {
      return new Response(responseText, {
        status: openAiResponse.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (
      attempt >= OPENAI_PROXY_MAX_ATTEMPTS ||
      !isRetryableOpenAiProxyFailure(openAiResponse.status, responseText)
    ) {
      if (isDevelopmentRuntime() && isRetryableOpenAiProxyFailure(openAiResponse.status, responseText)) {
        return buildDevFallbackApiResponse();
      }
      return new Response(responseText, {
        status: openAiResponse.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.warn('[api/generate-plan] retrying OpenAI', {
      attempt,
      error: `${openAiResponse.status} ${responseText.slice(0, 200)}`,
    });
    await sleep(OPENAI_PROXY_RETRY_DELAYS_MS[attempt - 1] ?? 3_000);
  }

  if (isDevelopmentRuntime() && isRetryableOpenAiProxyFailure(502, lastFailureMessage)) {
    return buildDevFallbackApiResponse();
  }

  return Response.json({ error: { message: lastFailureMessage } }, { status: 502 });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204 });
}
