import type { ItineraryDay, ItineraryItem, PlanDetails } from '@/types/plan';

export type ItineraryEditAction =
  | 'change_place'
  | 'add_before'
  | 'add_after'
  | 'delete'
  | 'change_time'
  | 'reorder'
  | 'ai_consult';

export const ITINERARY_EDIT_ACTIONS: Array<{ id: ItineraryEditAction; label: string }> = [
  { id: 'change_place', label: '別の場所に変更' },
  { id: 'add_before', label: '前に予定を追加' },
  { id: 'add_after', label: '後に予定を追加' },
  { id: 'delete', label: '削除する' },
  { id: 'change_time', label: '時間を変更' },
  { id: 'reorder', label: '順番を変更' },
  { id: 'ai_consult', label: 'AIに相談して変更' },
];

export const ITINERARY_EDIT_QUICK_CHIPS = [
  'カフェに変える',
  'ビーチを追加',
  '夜景を追加',
  '近い場所に変える',
  '雨の日向けにする',
  '予算を下げる',
  'デート向けにする',
  '移動を減らす',
] as const;

export type ItineraryEditQuickChip = (typeof ITINERARY_EDIT_QUICK_CHIPS)[number];

export type ItineraryEditTarget = {
  dayIndex: number;
  itemIndex: number;
  dayNumber: number;
  item: ItineraryItem;
};

export type ItineraryEditPreview = {
  beforeDay: ItineraryDay;
  afterDay: ItineraryDay;
  beforeItem: ItineraryItem | null;
  afterItem: ItineraryItem | null;
  summary: string;
};

export type PartialItineraryEditResult = {
  days: ItineraryDay[];
  details: PlanDetails;
  preview: ItineraryEditPreview;
};

export type ItineraryEditRecord = {
  id: string;
  userId: string;
  tripId: string | null;
  planId: string | null;
  dayIndex: number;
  itemId: string;
  editRequest: string;
  beforeData: Record<string, unknown>;
  afterData: Record<string, unknown>;
  createdAt: string;
};

export type ItineraryEditProposal = PartialItineraryEditResult & {
  target: ItineraryEditTarget;
  editRequest: string;
  action: ItineraryEditAction;
};

export function buildItineraryItemId(target: ItineraryEditTarget): string {
  return `${target.dayNumber}:${target.itemIndex}:${target.item.time}:${target.item.activity}`;
}
