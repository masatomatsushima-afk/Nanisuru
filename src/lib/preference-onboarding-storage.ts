import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'nanisuru_preference_onboarding_completed';

export async function getPreferenceOnboardingCompleted(): Promise<boolean> {
  const value = await AsyncStorage.getItem(KEY);
  return value === 'true';
}

export async function setPreferenceOnboardingCompleted(completed = true): Promise<void> {
  await AsyncStorage.setItem(KEY, completed ? 'true' : 'false');
}
