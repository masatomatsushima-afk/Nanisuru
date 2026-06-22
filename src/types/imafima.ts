import type { CompanionOption, PersonalityOption, TripDurationOption } from '@/types/plan';

export const IMA_HIMA_TIME_OPTIONS = ['1時間', '2時間', '3時間', '半日', '1日'] as const;
export type ImaHimaTimeOption = (typeof IMA_HIMA_TIME_OPTIONS)[number];

export const IMA_HIMA_MOOD_OPTIONS = [
  '癒されたい',
  '刺激が欲しい',
  '美味しいものを食べたい',
  '映えたい',
  '恋愛したい',
  '一人で考えたい',
] as const;
export type ImaHimaMoodOption = (typeof IMA_HIMA_MOOD_OPTIONS)[number];

export type ImaHimaTimeConfig = {
  tripDuration: TripDurationOption;
  itemsMin: number;
  itemsMax: number;
  guide: string;
  dayLabel: string;
};

export type SpontaneousContext = {
  availableTime: ImaHimaTimeOption;
  moodLabel: ImaHimaMoodOption;
  itemsMin: number;
  itemsMax: number;
  timeGuide: string;
  dayLabel: string;
};

export type MoodPreferences = {
  personality: PersonalityOption;
  companion: CompanionOption;
  moodDescription: string;
};
