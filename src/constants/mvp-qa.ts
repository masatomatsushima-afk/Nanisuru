/** MVP QA / tester-facing copy and version label. */

export const MVP_VERSION_LABEL = 'Nanisuru MVP v0.1';

export const FEATURE_COMING_SOON = {
  title: 'この機能は現在準備中です',
  message: 'もう少しで使えるようになります',
} as const;

export const QA_USER_MESSAGES = {
  networkError: '通信に失敗しました。もう一度お試しください',
  saveFailed: '保存に失敗しました',
  planGenerationFailed: 'プラン作成に失敗しました',
  loginRequired: 'ログインが必要です',
  loadFailed: 'データを読み込めませんでした',
  feedbackThanks: 'フィードバックありがとうございます',
} as const;
