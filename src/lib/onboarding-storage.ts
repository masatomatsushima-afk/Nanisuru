import AsyncStorage from '@react-native-async-storage/async-storage';

import type { PersonalityOption } from '@/types/plan';
import { PERSONALITY_OPTIONS } from '@/types/plan';
import { seedTravelStylePreference } from '@/lib/user-memory';

const KEYS = {
  completed: 'nanisuru_onboarding_completed',
  personality: 'nanisuru_preferred_personality',
} as const;

export async function getOnboardingCompleted(): Promise<boolean> {
  const value = await AsyncStorage.getItem(KEYS.completed);
  return value === 'true';
}

export async function getPreferredPersonality(): Promise<PersonalityOption | null> {
  const value = await AsyncStorage.getItem(KEYS.personality);
  if (value && PERSONALITY_OPTIONS.includes(value as PersonalityOption)) {
    return value as PersonalityOption;
  }
  return null;
}

export async function completeOnboarding(personality: PersonalityOption): Promise<void> {
  await AsyncStorage.multiSet([
    [KEYS.completed, 'true'],
    [KEYS.personality, personality],
  ]);
  await seedTravelStylePreference(personality);
}
