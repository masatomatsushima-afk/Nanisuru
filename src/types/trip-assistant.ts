import type { ItineraryItem } from '@/types/plan';
import type { ItineraryEditTarget, PartialItineraryEditResult } from '@/types/itinerary-edit';
import type { SavedTrip, SavedTripPayload } from '@/types/trip';
import type { TripFolder } from '@/types/trip-folder';
import type { ActiveTripContext } from '@/types/travel-secretary';

export const TRIP_ASSISTANT_WELCOME_MESSAGE =
  '旅行秘書です。保存したプランをもとに、持ち物・天気・予算・予定変更など何でも相談できます。';

export const TRIP_ASSISTANT_QUICK_PROMPTS = [
  '何持っていけばいい？',
  '雨が降ったらどうする？',
  '予算足りる？',
  '夜だけ別プランにしたい',
  '服装を教えて',
  'ホテルはどのエリアがいい？',
] as const;

export type TripAssistantQuickPrompt = (typeof TRIP_ASSISTANT_QUICK_PROMPTS)[number];

export type TripAssistantAction = {
  type: 'itinerary_update';
  title: string;
  targetDayIndex: number;
  targetItemIndex: number;
  beforeItem: ItineraryItem;
  afterItem: ItineraryItem;
  reason: string;
  budgetImpact?: string;
  movementNote?: string;
  editProposal: PartialItineraryEditResult;
  target: ItineraryEditTarget;
  editRequest: string;
};

export type TripAssistantContext = {
  folder: TripFolder;
  savedPlans: SavedTripPayload[];
  latestPlan: SavedTripPayload | null;
  linkedTrip: SavedTrip | null;
  itinerary: ItineraryItem[];
  budget: string;
  budgetIncludes?: string[];
  travelPurpose?: string;
  companion: string;
  weatherContext: string | null;
  userPreferences: string;
  tripContext: ActiveTripContext | null;
  extendedBrief: string;
  editHistorySummary: string | null;
};

export type TripAssistantChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  assistantAction?: TripAssistantAction;
  applied?: boolean;
};
