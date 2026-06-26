import type { UserPreferences } from '@/types/user-memory';
import type { TravelMemory, TravelMemoryCategory } from '@/types/travel-memory';
import { getTravelMemoryCategoryIcon } from '@/types/travel-memory';
import { parseStoredPreferenceContent } from '@/types/travel-preferences';

export type MemoryDisplayChip = {
  id: string;
  label: string;
  icon: string;
  kind: 'preference' | 'place';
};

export type TravelMemoryDisplayData = {
  hasMemory: boolean;
  preferenceChips: MemoryDisplayChip[];
  placeChips: MemoryDisplayChip[];
  totalPlaceCount: number;
};

const MAX_PREFERENCE_CHIPS = 8;
const MAX_PLACE_CHIPS = 3;
const MAX_CHIP_LENGTH = 14;
const MAX_PLACE_LENGTH = 18;

const LEGACY_PHRASE_CHIPS: Array<{ pattern: RegExp; label: string; icon: string }> = [
  { pattern: /コスパ|予算.*抑|リーズナブル/i, label: '予算を抑えたい', icon: '💰' },
  { pattern: /ゆっくり|のんびり/i, label: 'ゆっくり派', icon: '🌿' },
  { pattern: /移動.*少|徒歩圏|歩き/i, label: '歩きすぎない', icon: '🚶' },
  { pattern: /グルメ|食事/i, label: 'グルメ重視', icon: '🍽' },
  { pattern: /カフェ|コーヒー/i, label: 'カフェも好き', icon: '☕' },
  { pattern: /自然|公園|ビーチ/i, label: '自然が好き', icon: '🌳' },
  { pattern: /美術館|文化/i, label: '文化体験', icon: '🎨' },
  { pattern: /夜景|フォト|映え/i, label: '夜景が好き', icon: '🌃' },
  { pattern: /デート|カップル/i, label: 'カップル', icon: '💑' },
  { pattern: /一人/i, label: '一人旅', icon: '🧳' },
  { pattern: /人混み|列/i, label: '人混みは苦手', icon: '🚫' },
  { pattern: /雨|屋内/i, label: '雨の日は屋内多め', icon: '☔' },
  { pattern: /穴場/i, label: '穴場重視', icon: '🗺' },
];

const CATEGORY_CHIP_ICONS: Partial<Record<TravelMemoryCategory, string>> = {
  food: '🍽',
  travel_style: '🧭',
  budget: '💰',
  activities: '📍',
  dislikes: '🚫',
  companion: '👥',
  destinations: '🗺',
};

function truncateLabel(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function isLikelyPlaceName(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > MAX_PLACE_LENGTH) return false;
  if (/。|！|？|好む|重視|派|したい|苦手|プラン/.test(trimmed)) return false;
  return true;
}

function splitPlaceCandidates(text: string): string[] {
  return text
    .split(/[,、/／|・]+/)
    .map((part) => part.trim())
    .filter((part) => isLikelyPlaceName(part));
}

function legacyTextToChip(content: string, category: TravelMemoryCategory): MemoryDisplayChip | null {
  const trimmed = content.trim();
  if (!trimmed) return null;

  for (const entry of LEGACY_PHRASE_CHIPS) {
    if (entry.pattern.test(trimmed)) {
      return {
        id: `legacy-${entry.label}`,
        label: entry.label,
        icon: entry.icon,
        kind: 'preference',
      };
    }
  }

  if (trimmed.length <= MAX_CHIP_LENGTH) {
    return {
      id: `legacy-${category}-${trimmed}`,
      label: trimmed,
      icon: CATEGORY_CHIP_ICONS[category] ?? '✨',
      kind: 'preference',
    };
  }

  return null;
}

function memoryToChips(memory: TravelMemory): {
  preferences: MemoryDisplayChip[];
  places: MemoryDisplayChip[];
} {
  const parsed = parseStoredPreferenceContent(memory.content);
  const categoryIcon = getTravelMemoryCategoryIcon(memory.category);

  if (parsed) {
    const preferences = parsed.chips.map((chip, index) => ({
      id: `${memory.id}-chip-${index}`,
      label: truncateLabel(chip, MAX_CHIP_LENGTH),
      icon: categoryIcon,
      kind: 'preference' as const,
    }));

    const places: MemoryDisplayChip[] = [];

    if (memory.category === 'destinations' && parsed.custom.trim()) {
      for (const [index, place] of splitPlaceCandidates(parsed.custom).entries()) {
        places.push({
          id: `${memory.id}-place-${index}`,
          label: truncateLabel(place, MAX_PLACE_LENGTH),
          icon: '📍',
          kind: 'place',
        });
      }
    } else if (parsed.custom.trim()) {
      const customChip = legacyTextToChip(parsed.custom, memory.category);
      if (customChip?.kind === 'preference') {
        preferences.push({
          id: `${memory.id}-custom`,
          label: customChip.label,
          icon: customChip.icon,
          kind: 'preference',
        });
      }
    }

    return { preferences, places };
  }

  const legacyChip = legacyTextToChip(memory.content, memory.category);
  if (legacyChip?.kind === 'preference') {
    return {
      preferences: [
        {
          id: memory.id,
          label: legacyChip.label,
          icon: legacyChip.icon,
          kind: 'preference',
        },
      ],
      places: [],
    };
  }

  return { preferences: [], places: [] };
}

function preferencesToChips(preferences: UserPreferences): MemoryDisplayChip[] {
  const chips: MemoryDisplayChip[] = [];

  if (preferences.favoriteTravelStyle) {
    chips.push({
      id: `style-${preferences.favoriteTravelStyle}`,
      label: preferences.favoriteTravelStyle,
      icon: '🧭',
      kind: 'preference',
    });
  }

  if (preferences.budgetPreference) {
    chips.push({
      id: 'budget-pref',
      label: truncateLabel(preferences.budgetPreference, MAX_CHIP_LENGTH),
      icon: '💰',
      kind: 'preference',
    });
  }

  return chips;
}

function activitiesToPlaceChips(activities: string[]): MemoryDisplayChip[] {
  return activities
    .filter(isLikelyPlaceName)
    .slice(0, MAX_PLACE_CHIPS)
    .map((activity, index) => ({
      id: `activity-place-${index}-${activity}`,
      label: truncateLabel(activity, MAX_PLACE_LENGTH),
      icon: '📍',
      kind: 'place' as const,
    }));
}

function dedupeChips(chips: MemoryDisplayChip[]): MemoryDisplayChip[] {
  const seen = new Set<string>();
  const result: MemoryDisplayChip[] = [];

  for (const chip of chips) {
    const key = chip.label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(chip);
  }

  return result;
}

export function buildTravelMemoryDisplayData(input: {
  preferences: UserPreferences;
  memories: TravelMemory[];
}): TravelMemoryDisplayData {
  const preferenceCandidates: MemoryDisplayChip[] = [...preferencesToChips(input.preferences)];
  const placeCandidates: MemoryDisplayChip[] = [];

  for (const memory of input.memories) {
    const { preferences, places } = memoryToChips(memory);
    preferenceCandidates.push(...preferences);
    placeCandidates.push(...places);
  }

  const activityPlaces = activitiesToPlaceChips(input.preferences.favoriteActivities);
  placeCandidates.push(...activityPlaces);

  const preferenceChips = dedupeChips(preferenceCandidates)
    .filter((chip) => chip.kind === 'preference')
    .slice(0, MAX_PREFERENCE_CHIPS);

  const allPlaces = dedupeChips(placeCandidates).filter((chip) => chip.kind === 'place');
  const placeChips = allPlaces.slice(0, MAX_PLACE_CHIPS);
  const totalPlaceCount = allPlaces.length;

  const hasMemory = preferenceChips.length > 0 || placeChips.length > 0;

  return {
    hasMemory,
    preferenceChips,
    placeChips,
    totalPlaceCount,
  };
}
