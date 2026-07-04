import { formatCombinedTravelIntent } from '@/lib/plan-creation';
import type { PersonalityOption } from '@/types/plan';
import type { TravelIntentOption } from '@/types/plan-creation';

export const TRAVEL_PURPOSE_LABELS = [
  '映え',
  '自然',
  'グルメ',
  '買い物',
  '夜遊び',
  'AIに任せる',
] as const;

export type TravelPurposeLabel = (typeof TRAVEL_PURPOSE_LABELS)[number];

export const TRAVEL_PURPOSE_TO_PERSONALITY: Record<TravelPurposeLabel, PersonalityOption> = {
  映え: '映え重視',
  自然: '冒険家',
  グルメ: 'グルメ',
  買い物: '映え重視',
  夜遊び: '冒険家',
  'AIに任せる': 'のんびり',
};

export const TRAVEL_PURPOSE_TO_INTENT: Record<
  TravelPurposeLabel,
  TravelIntentOption | ''
> = {
  映え: '王道スポットを回りたい',
  自然: '自然を楽しみたい',
  グルメ: 'グルメを楽しみたい',
  買い物: '買い物したい',
  夜遊び: '',
  'AIに任せる': '',
};

export function isTravelPurposeLabel(value: string): value is TravelPurposeLabel {
  return TRAVEL_PURPOSE_LABELS.includes(value as TravelPurposeLabel);
}

export function resolveTravelPurposePersonality(
  travelPurpose: string | null | undefined,
): PersonalityOption | null {
  const trimmed = travelPurpose?.trim();
  if (!trimmed || !isTravelPurposeLabel(trimmed)) return null;
  return TRAVEL_PURPOSE_TO_PERSONALITY[trimmed];
}

export function resolveTravelPurposeValue(input: {
  travelPurpose?: string | null;
  travelIntent?: TravelIntentOption | '';
  customTravelIntent?: string;
}): string {
  if (input.travelPurpose?.trim()) {
    return input.travelPurpose.trim();
  }

  const combined = formatCombinedTravelIntent(
    input.travelIntent ?? '',
    input.customTravelIntent,
  );

  return combined.trim() || 'AIに任せる';
}
