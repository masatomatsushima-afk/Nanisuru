export const APP_MESSAGES = {
  locationPermissionDenied:
    '現在地の取得が許可されていません。設定から位置情報を許可するか、エリアを手入力してください。',
  placesApiFailed:
    '実在スポットを取得できませんでした。代わりに主要スポットをもとにプランを作成します。',
  noPlacesFound:
    'このエリアではスポットが見つかりませんでした。エリア名をもう少し具体的に入力してください。',
  openAiFailed: 'プラン作成に失敗しました。少し時間をおいてもう一度お試しください。',
  inputIncomplete: '入力が不足しています。必須項目を確認してください。',
  openAiApiFailed: 'プラン作成に失敗しました。しばらくしてからもう一度お試しください。',
  placesFetchWarning: '実在スポットの取得に失敗しました。代替データでプランを作成します。',
  planSaveWarning: '保存に失敗しました',
  networkError: '通信に失敗しました。もう一度お試しください',
  locationFetchFailed: '現在地を取得できませんでした',
  mapsOpenFailed: 'マップを開けませんでした',
  openAiNotConfigured: 'プラン作成に失敗しました。しばらくしてからもう一度お試しください。',
  locationRequired: '場所を入力してください',
  retry: 'もう一度試す',
  loadingSearchingPlaces: '実在スポットを探しています…',
  loadingAiPlanning: 'AIが最高の1日を設計しています…',
  loadingPreparingRoute: 'ルート情報を準備しています…',
  googleMapsNotConfigured: 'マップを開けませんでした',
  nearbySearchFailed: '周辺スポットの検索に失敗しました。もう一度お試しください。',
  noNearbyPlaces: '近くにスポットが見つかりませんでした。別の場所でお試しください。',
  secretaryFailed: 'メッセージの送信に失敗しました。少し時間をおいてもう一度お試しください。',
  supabaseFailed: 'データを読み込めませんでした',
  supabaseNotConfigured: 'データを読み込めませんでした',
  loadFailed: 'データを読み込めませんでした',
  imageUploadFailed: '画像のアップロードに失敗しました。もう一度お試しください。',
  dataNotFound: 'データを読み込めませんでした',
  authRequired: 'ログインが必要です',
  genericActionFailed: '操作に失敗しました。もう一度お試しください。',
  featureComingSoon: 'この機能は現在準備中です',
} as const;

export type AppErrorCode =
  | 'LOCATION_PERMISSION_DENIED'
  | 'PLACES_API_FAILED'
  | 'NO_PLACES_FOUND'
  | 'INPUT_INCOMPLETE'
  | 'OPENAI_FAILED'
  | 'NETWORK_ERROR'
  | 'SUPABASE_FAILED'
  | 'AUTH_REQUIRED'
  | 'NOT_FOUND'
  | 'UNKNOWN';

export class AppError extends Error {
  readonly code: AppErrorCode;

  constructor(message: string, code: AppErrorCode = 'UNKNOWN') {
    super(message);
    this.name = 'AppError';
    this.code = code;
  }
}

export class OpenAiRequestError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly body: string;

  constructor(status: number, statusText: string, body: string) {
    super(formatOpenAiHttpErrorMessage(status, statusText, body));
    this.name = 'OpenAiRequestError';
    this.status = status;
    this.statusText = statusText;
    this.body = body;
  }
}

export function formatOpenAiHttpErrorMessage(
  status: number,
  statusText: string,
  errorBody: string,
): string {
  if (!errorBody.trim()) {
    return `OpenAI request failed: ${status} ${statusText}`;
  }

  try {
    const parsed = JSON.parse(errorBody) as {
      error?: { message?: string; type?: string; code?: string };
    };
    const apiError = parsed.error;
    if (apiError?.message) {
      return [
        `OpenAI ${status} ${statusText}`,
        apiError.type ? `type=${apiError.type}` : null,
        apiError.code ? `code=${apiError.code}` : null,
        apiError.message,
      ]
        .filter(Boolean)
        .join(' | ');
    }
  } catch {
    // Not JSON — return raw body below.
  }

  return errorBody;
}

export function extractPlanGenerationErrorDetail(error: unknown): string {
  if (error instanceof OpenAiRequestError) {
    return `[HTTP ${error.status} ${error.statusText}] ${error.message}\n\n${error.body}`;
  }

  if (error instanceof AppError) {
    return error.message;
  }

  if (error instanceof Error) {
    const message = error.message;
    try {
      const parsed = JSON.parse(message) as {
        error?: { message?: string; type?: string; code?: string };
      };
      if (parsed.error?.message) {
        const apiError = parsed.error;
        return [
          apiError.type ? `type=${apiError.type}` : null,
          apiError.code ? `code=${apiError.code}` : null,
          apiError.message,
        ]
          .filter(Boolean)
          .join(' | ');
      }
    } catch {
      // Not JSON.
    }
    return message;
  }

  return String(error);
}

const NETWORK_PATTERNS = [
  /network request failed/i,
  /failed to fetch/i,
  /network error/i,
  /internet connection/i,
  /offline/i,
  /timeout/i,
  /timed out/i,
];

const OPENAI_PATTERNS = [/openai/i, /aiからの応答/i, /aiプラン/i];

const SUPABASE_PATTERNS = [/supabase/i, /ログインが必要/i, /テーブル/i, /row level security/i];

export function isNetworkError(error: unknown): boolean {
  if (error instanceof AppError && error.code === 'NETWORK_ERROR') return true;
  const message = error instanceof Error ? error.message : String(error);
  return NETWORK_PATTERNS.some((pattern) => pattern.test(message));
}

export function classifyError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  const message = error instanceof Error ? error.message : String(error);

  if (message === APP_MESSAGES.locationRequired) {
    return new AppError(message, 'NO_PLACES_FOUND');
  }
  if (message === APP_MESSAGES.inputIncomplete || /入力が不足|選んでから|記入してください/.test(message)) {
    return new AppError(message, 'INPUT_INCOMPLETE');
  }
  if (message === APP_MESSAGES.locationPermissionDenied) {
    return new AppError(message, 'LOCATION_PERMISSION_DENIED');
  }
  if (message === APP_MESSAGES.noPlacesFound) {
    return new AppError(message, 'NO_PLACES_FOUND');
  }
  if (message === APP_MESSAGES.placesApiFailed) {
    return new AppError(message, 'PLACES_API_FAILED');
  }
  if (isNetworkError(error)) {
    return new AppError(APP_MESSAGES.networkError, 'NETWORK_ERROR');
  }
  if (message === APP_MESSAGES.authRequired || /ログインが必要/.test(message)) {
    return new AppError(APP_MESSAGES.authRequired, 'AUTH_REQUIRED');
  }
  if (message === APP_MESSAGES.dataNotFound) {
    return new AppError(message, 'NOT_FOUND');
  }
  if (/見つかりません/.test(message) && !/天気情報|天気予報/.test(message)) {
    return new AppError(message, 'NOT_FOUND');
  }
  if (SUPABASE_PATTERNS.some((pattern) => pattern.test(message))) {
    return new AppError(APP_MESSAGES.supabaseFailed, 'SUPABASE_FAILED');
  }
  if (error instanceof OpenAiRequestError || OPENAI_PATTERNS.some((pattern) => pattern.test(message))) {
    return new AppError(message, 'OPENAI_FAILED');
  }

  return new AppError(message, 'UNKNOWN');
}

export function formatPlanGenerationDevError(userMessage: string, error: unknown): string {
  if (!__DEV__) return userMessage;
  const detail = extractPlanGenerationErrorDetail(error);
  console.warn('[PlanGeneration]', detail);
  return userMessage;
}

export function getErrorMessage(error: unknown): string {
  return getPlanGenerationErrorMessage(error);
}

export function getPlanGenerationErrorMessage(error: unknown): string {
  const classified = classifyError(error);

  switch (classified.code) {
    case 'INPUT_INCOMPLETE':
      return classified.message || APP_MESSAGES.inputIncomplete;
    case 'OPENAI_FAILED':
      return APP_MESSAGES.openAiApiFailed;
    case 'PLACES_API_FAILED':
      return APP_MESSAGES.placesApiFailed;
    case 'NO_PLACES_FOUND':
      return classified.message || APP_MESSAGES.noPlacesFound;
    case 'SUPABASE_FAILED':
      return APP_MESSAGES.supabaseFailed;
    case 'NETWORK_ERROR':
      return APP_MESSAGES.networkError;
    default:
      return classified.message || APP_MESSAGES.genericActionFailed;
  }
}

export function isSupabaseError(error: unknown): boolean {
  return classifyError(error).code === 'SUPABASE_FAILED';
}

export function isRetryableError(error: unknown): boolean {
  const code = classifyError(error).code;
  return (
    code === 'NETWORK_ERROR' ||
    code === 'OPENAI_FAILED' ||
    code === 'SUPABASE_FAILED' ||
    code === 'NO_PLACES_FOUND' ||
    code === 'UNKNOWN'
  );
}

export function getActionErrorMessage(
  error: unknown,
  fallback: string = APP_MESSAGES.genericActionFailed,
): string {
  const classified = classifyError(error);
  if (classified.code === 'UNKNOWN') {
    const raw = error instanceof Error ? error.message : String(error);
    return sanitizeUserFacingMessage(raw || fallback);
  }
  return classified.message;
}

const TECHNICAL_USER_MESSAGE_PATTERN =
  /supabase|openai|\.env|EXPO_PUBLIC|APIキー|テーブル|row level|gotrue|anon key|service role/i;

/** Strip developer-facing details before showing errors to testers. */
export function sanitizeUserFacingMessage(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) return APP_MESSAGES.genericActionFailed;

  if (TECHNICAL_USER_MESSAGE_PATTERN.test(trimmed)) {
    if (/保存|save|insert|update|upload/i.test(trimmed)) {
      return APP_MESSAGES.planSaveWarning;
    }
    if (/upload|画像|storage|bucket|photo/i.test(trimmed)) {
      return APP_MESSAGES.imageUploadFailed;
    }
    if (/ログイン|auth|session|sign in/i.test(trimmed)) {
      return APP_MESSAGES.authRequired;
    }
    return APP_MESSAGES.loadFailed;
  }

  if (OPENAI_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return APP_MESSAGES.openAiApiFailed;
  }
  if (NETWORK_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return APP_MESSAGES.networkError;
  }
  if (/開発用|debug|stack trace/i.test(trimmed)) {
    return APP_MESSAGES.genericActionFailed;
  }
  if (trimmed.length > 120) {
    return APP_MESSAGES.genericActionFailed;
  }

  return trimmed;
}

export function sanitizeUserFacingError(
  error: unknown,
  fallback: string = APP_MESSAGES.genericActionFailed,
): string {
  if (error instanceof AppError) {
    return error.message;
  }
  const message = error instanceof Error ? error.message : String(error);
  return sanitizeUserFacingMessage(message || fallback);
}
