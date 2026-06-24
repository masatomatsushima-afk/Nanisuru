export const APP_MESSAGES = {
  locationPermissionDenied:
    '現在地の取得が許可されていません。設定から位置情報を許可するか、エリアを手入力してください。',
  placesApiFailed:
    '実在スポットを取得できませんでした。代わりに主要スポットをもとにプランを作成します。',
  noPlacesFound:
    'このエリアではスポットが見つかりませんでした。エリア名をもう少し具体的に入力してください。',
  openAiFailed: 'AIプランの生成に失敗しました。少し時間をおいてもう一度お試しください。',
  networkError: '通信に失敗しました。インターネット接続を確認してください。',
  locationFetchFailed: '現在地を取得できませんでした',
  mapsOpenFailed: 'Google Mapsを開けませんでした',
  openAiNotConfigured:
    'OpenAI APIキーが設定されていません。.env に EXPO_PUBLIC_OPENAI_API_KEY を追加して Expo を再起動してください。',
  locationRequired: '場所を入力してください',
  retry: 'もう一度試す',
  loadingSearchingPlaces: '実在スポットを探しています…',
  loadingAiPlanning: 'AIが最高の1日を設計しています…',
  loadingPreparingRoute: 'ルート情報を準備しています…',
  googleMapsNotConfigured:
    'Google Maps APIキーが設定されていません。.env に EXPO_PUBLIC_GOOGLE_MAPS_API_KEY を追加して Expo を再起動してください。',
  nearbySearchFailed: '周辺スポットの検索に失敗しました。もう一度お試しください。',
  noNearbyPlaces: '近くにスポットが見つかりませんでした。別の場所でお試しください。',
  secretaryFailed: 'メッセージの送信に失敗しました。少し時間をおいてもう一度お試しください。',
} as const;

export type AppErrorCode =
  | 'LOCATION_PERMISSION_DENIED'
  | 'PLACES_API_FAILED'
  | 'NO_PLACES_FOUND'
  | 'OPENAI_FAILED'
  | 'NETWORK_ERROR'
  | 'UNKNOWN';

export class AppError extends Error {
  readonly code: AppErrorCode;

  constructor(message: string, code: AppErrorCode = 'UNKNOWN') {
    super(message);
    this.name = 'AppError';
    this.code = code;
  }
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

export function isNetworkError(error: unknown): boolean {
  if (error instanceof AppError && error.code === 'NETWORK_ERROR') return true;
  const message = error instanceof Error ? error.message : String(error);
  return NETWORK_PATTERNS.some((pattern) => pattern.test(message));
}

export function classifyError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  const message = error instanceof Error ? error.message : String(error);

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
  if (OPENAI_PATTERNS.some((pattern) => pattern.test(message))) {
    return new AppError(APP_MESSAGES.openAiFailed, 'OPENAI_FAILED');
  }

  return new AppError(message, 'UNKNOWN');
}

export function getErrorMessage(error: unknown): string {
  return classifyError(error).message;
}

export function isRetryableError(error: unknown): boolean {
  const code = classifyError(error).code;
  return (
    code === 'NETWORK_ERROR' ||
    code === 'OPENAI_FAILED' ||
    code === 'NO_PLACES_FOUND' ||
    code === 'UNKNOWN'
  );
}
