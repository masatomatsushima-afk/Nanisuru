import type { CurrencyCode } from '@/constants/currency';
import type {
  CompanionOption,
  ItineraryDay,
  ItineraryItem,
  PersonalityOption,
  PlanDetails,
  TripDurationOption,
} from '@/types/plan';

export const PLAN_FEEDBACK_TAGS = [
  '行きたい',
  '微妙',
  '高すぎる',
  '移動が多い',
  'もっとグルメ多め',
  'もっとゆっくりしたい',
  'デート向きで良い',
  '一人向きで良い',
] as const;

export type PlanFeedbackTag = (typeof PLAN_FEEDBACK_TAGS)[number];

export type PlanRatingSource = 'home' | 'imafima' | 'best-day';

export type PlanRatingContext = {
  source: PlanRatingSource;
  location: string;
  budget: string;
  currency: CurrencyCode;
  people: string;
  mood: string;
  companion: CompanionOption;
  personality: PersonalityOption;
  tripDuration: TripDurationOption;
  days: ItineraryDay[];
  items: ItineraryItem[];
  details: PlanDetails;
};

export type PlanRating = {
  id: string;
  userId: string;
  tripId: string | null;
  stars: number;
  feedbackTags: PlanFeedbackTag[];
  planSource: PlanRatingSource;
  planSnapshot: PlanRatingContext;
  createdAt: string;
};

export type SavePlanRatingInput = {
  stars: number;
  feedbackTags: PlanFeedbackTag[];
  context: PlanRatingContext;
  tripId?: string | null;
};

export type RatingTendencies = {
  totalRatings: number;
  averageStars: number | null;
  topFeedbackTags: Array<{ tag: PlanFeedbackTag; count: number }>;
  insights: string[];
};
