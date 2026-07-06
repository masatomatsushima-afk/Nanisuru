import AsyncStorage from '@react-native-async-storage/async-storage';

import { clearLocalDiscoverSaves } from '@/lib/discover-local-saves';
import { clearLocalGemSaves } from '@/lib/local-gems-local-saves';
import { devLog } from '@/lib/dev-log';

const LOCAL_KEY_PREFIXES = ['nanisuru', 'nanisuru:', 'nanisuru_'] as const;

function isLocalTestKey(key: string): boolean {
  return LOCAL_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

/**
 * Clears AsyncStorage keys and in-memory caches used for local / mock fallback.
 * Does NOT call Supabase — production cloud data is untouched.
 */
export async function resetLocalTestData(): Promise<string[]> {
  const allKeys = await AsyncStorage.getAllKeys();
  const keysToRemove = allKeys.filter(isLocalTestKey);

  if (keysToRemove.length > 0) {
    await AsyncStorage.multiRemove(keysToRemove);
  }

  clearLocalDiscoverSaves();
  clearLocalGemSaves();

  devLog('[DevReset] cleared local test keys', keysToRemove);
  return keysToRemove;
}
