import AsyncStorage from '@react-native-async-storage/async-storage';

import { PREFERENCES_TEMPORARILY_DISABLED } from '@/lib/preferences-disabled';

const KEY = 'nanisuru_preference_onboarding_completed';

export async function getPreferenceOnboardingCompleted(): Promise<boolean> {
  if (PREFERENCES_TEMPORARILY_DISABLED) {
    return true;
  }

  const value = await AsyncStorage.getItem(KEY);
  return value === 'true';
}

export async function setPreferenceOnboardingCompleted(completed = true): Promise<void> {
  if (PREFERENCES_TEMPORARILY_DISABLED) {
    return;
  }

  await AsyncStorage.setItem(KEY, completed ? 'true' : 'false');
}
