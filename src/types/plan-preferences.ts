export type PlanCustomPreferences = {
  customMood?: string;
  desiredPlaces?: string;
  avoidPreferences?: string;
};

export const HOME_MOOD_OPTIONS = [
  '癒されたい',
  'ワクワクしたい',
  'グルメを楽しみたい',
  'のんびりしたい',
  '刺激が欲しい',
  '映えを狙いたい',
] as const;

export type HomeMoodOption = (typeof HOME_MOOD_OPTIONS)[number];
