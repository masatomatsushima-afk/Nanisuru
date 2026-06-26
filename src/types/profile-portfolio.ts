import type { LocalHiddenSpot } from '@/types/local-hidden-spot';
import type { PublicPlan } from '@/types/public-plan';
import type { TripMemory } from '@/types/trip-memory';

export type ProfileTabId = 'plans' | 'memories' | 'spots' | 'saved';

export const PROFILE_TABS: Array<{ id: ProfileTabId; label: string; ownerOnly?: boolean }> = [
  { id: 'plans', label: 'プラン' },
  { id: 'memories', label: '思い出' },
  { id: 'spots', label: '穴場' },
  { id: 'saved', label: '保存', ownerOnly: true },
];

export type ProfileSavedItem =
  | { type: 'plan'; plan: PublicPlan; savedAt: string }
  | { type: 'memory'; memory: TripMemory; savedAt: string }
  | { type: 'spot'; spot: LocalHiddenSpot; savedAt: string };
