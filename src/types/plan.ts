export type ItineraryItem = { time: string; activity: string };

export const COMPANION_OPTIONS = ['一人', '友達', 'カップル', '初デート', '家族'] as const;
export type CompanionOption = (typeof COMPANION_OPTIONS)[number];

export type PlanDetails = {
  totalBudget: string;
  duration: string;
  highlights: string[];
  rainyDayAlternatives: string[];
};

export type PlanParams = {
  location: string;
  budget: string;
  people: string;
  mood: string;
  companion: CompanionOption;
  items: ItineraryItem[];
  details?: PlanDetails;
};
