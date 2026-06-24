import type { CompanionOption, PersonalityOption, TripDurationOption } from '@/types/plan';

export const BEST_DAY_TIME_OPTIONS = ['2時間', '3時間', '半日', '1日'] as const;
export type BestDayTimeOption = (typeof BEST_DAY_TIME_OPTIONS)[number];

export const BEST_DAY_MOOD_OPTIONS = [
  '癒されたい',
  '冒険したい',
  '美味しいものを食べたい',
  '恋人と過ごしたい',
  '一人で過ごしたい',
  '学びたい',
  'AIに任せる',
] as const;
export type BestDayMoodOption = (typeof BEST_DAY_MOOD_OPTIONS)[number];

export const BEST_DAY_PEOPLE_OPTIONS = [
  { value: '1', label: '1人' },
  { value: '2', label: '2人' },
  { value: '3', label: '3人' },
  { value: '4', label: '4人以上' },
] as const;

export type BestDayTimeConfig = {
  tripDuration: TripDurationOption;
  itemsMin: number;
  itemsMax: number;
  guide: string;
  dayLabel: string;
};

export type BestDayContext = {
  mood: BestDayMoodOption;
  availableTime: BestDayTimeOption;
  people: string;
  itemsMin: number;
  itemsMax: number;
  timeGuide: string;
  dayLabel: string;
  moodDescription: string;
};

export const BEST_DAY_TIME_EMOJI: Record<BestDayTimeOption, string> = {
  '2時間': '⏰',
  '3時間': '🕐',
  半日: '🌤',
  '1日': '☀️',
};

export const BEST_DAY_MOOD_EMOJI: Record<BestDayMoodOption, string> = {
  癒されたい: '🌿',
  冒険したい: '⚡',
  美味しいものを食べたい: '🍜',
  恋人と過ごしたい: '💕',
  一人で過ごしたい: '🧘',
  学びたい: '📚',
  AIに任せる: '✨',
};

export type BestDayMoodPreferences = {
  personality: PersonalityOption;
  companion: CompanionOption;
  moodDescription: string;
  effectivePeople: string;
};
