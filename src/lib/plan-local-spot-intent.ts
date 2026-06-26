import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'nanisuru_pending_local_spot';

export type PendingLocalSpotForPlan = {
  name: string;
  area: string;
  spotId: string;
};

export async function setPendingLocalSpotForPlan(
  spot: PendingLocalSpotForPlan,
): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(spot));
}

export async function consumePendingLocalSpotForPlan(): Promise<PendingLocalSpotForPlan | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  await AsyncStorage.removeItem(STORAGE_KEY);
  try {
    const parsed = JSON.parse(raw) as PendingLocalSpotForPlan;
    if (!parsed.name?.trim()) return null;
    return parsed;
  } catch {
    return null;
  }
}
