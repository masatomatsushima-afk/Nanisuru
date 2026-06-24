export const MODERATION_STATUSES = ['active', 'pending', 'hidden', 'removed'] as const;

export type ModerationStatus = (typeof MODERATION_STATUSES)[number];

export const REPORT_TARGET_TYPES = ['public_plan', 'comment', 'user'] as const;

export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

export const PLAN_REPORT_REASONS = [
  { id: 'inappropriate', label: '不適切な内容' },
  { id: 'spam', label: 'スパム' },
  { id: 'misinformation', label: '誤情報' },
  { id: 'media', label: '画像・動画が不適切' },
  { id: 'harassment', label: '嫌がらせ' },
  { id: 'other', label: 'その他' },
] as const;

export type PlanReportReasonId = (typeof PLAN_REPORT_REASONS)[number]['id'];

export const COMMENT_REPORT_REASONS = [
  { id: 'inappropriate', label: '不適切な内容' },
  { id: 'spam', label: 'スパム' },
  { id: 'harassment', label: '嫌がらせ' },
  { id: 'other', label: 'その他' },
] as const;

export type CommentReportReasonId = (typeof COMMENT_REPORT_REASONS)[number]['id'];

export const MODERATION_STATUS_LABELS: Record<ModerationStatus, string> = {
  active: '公開中',
  pending: '確認中',
  hidden: '非表示',
  removed: '削除済み',
};
