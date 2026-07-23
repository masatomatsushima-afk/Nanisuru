import type { ItineraryDay, ItineraryItem, PlanDetails } from '@/types/plan';

export type ItineraryEditAction =
  | 'change_place'
  | 'add_before'
  | 'add_after'
  | 'delete'
  | 'change_time'
  | 'reorder'
  | 'ai_consult';

/** Preset options for 「ここだけ変更」 single-item edit. */
export type ItinerarySingleEditPresetId =
  | 'similar_vibe'
  | 'gourmet'
  | 'cafe'
  | 'indoor'
  | 'photo_spot'
  | 'shopping'
  | 'budget_friendly'
  | 'easy_move'
  | 'custom';

export type ItinerarySingleEditPreset = {
  id: ItinerarySingleEditPresetId;
  label: string;
  request: string;
};

export const ITINERARY_SINGLE_EDIT_PRESETS: ItinerarySingleEditPreset[] = [
  {
    id: 'similar_vibe',
    label: '似た雰囲気で別の場所に変更',
    request: '似た雰囲気の別の場所に差し替えてください。周辺ルートと時間帯は維持してください。',
  },
  {
    id: 'gourmet',
    label: 'グルメスポットに変更',
    request: 'グルメスポット（食事）に差し替えてください。ルートと予算感に合わせてください。',
  },
  {
    id: 'cafe',
    label: 'カフェに変更',
    request: 'カフェに差し替えてください。前後の移動と時間帯に合う場所にしてください。',
  },
  {
    id: 'indoor',
    label: '屋内スポットに変更',
    request: '屋内で楽しめるスポットに差し替えてください。天候に左右されにくい候補にしてください。',
  },
  {
    id: 'photo_spot',
    label: '映えスポットに変更',
    request: '写真映えするスポットに差し替えてください。移動負担は増やさないでください。',
  },
  {
    id: 'shopping',
    label: '買い物に変更',
    request: '買い物ができるスポットに差し替えてください。ルート上で自然な場所にしてください。',
  },
  {
    id: 'budget_friendly',
    label: '予算を抑える',
    request: '予算を抑えた代替スポットに差し替えてください。体験の質はできるだけ維持してください。',
  },
  {
    id: 'easy_move',
    label: '移動を楽にする',
    request: '移動負担が少ない代替スポットに差し替えてください。前後の予定との距離を短くしてください。',
  },
  {
    id: 'custom',
    label: '自由に希望を書く',
    request: '',
  },
];

export const ITINERARY_EDIT_FREE_TEXT_PLACEHOLDER =
  '例：海が見えるカフェにしたい、もっとローカルな店がいい';

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
  reason?: string;
  movementFromPrev?: string;
  movementToNext?: string;
  budgetImpact?: string;
};

export type PartialItineraryEditResult = {
  days: ItineraryDay[];
  details: PlanDetails;
  preview: ItineraryEditPreview;
  /** Google Places replacement options (up to ~3). Empty when none found. */
  replacementCandidates?: import('@/lib/itinerary-replacement-search').ItineraryReplacementCandidateView[];
  /** Soft user-facing empty state — not a technical failure banner. */
  emptyCandidatesMessage?: string | null;
  /** Dev-safe diagnostics (no secrets / raw placeIds). */
  replacementDiagnostics?: import('@/lib/itinerary-replacement-search').ReplacementSearchDiagnostics;
  /** Future PreferenceSignal drafts — not persisted yet. */
  preferenceSignalDrafts?: import('@/lib/itinerary-replacement-search').ReplacementPreferenceSignalDraft[];
};

export type ItineraryEditRecord = {
  id: string;
  userId: string;
  tripId: string | null;
  planId: string | null;
  folderId?: string | null;
  source?: string | null;
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
