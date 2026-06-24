import {
  createTravelMemory,
  deleteTravelMemory,
  getTravelMemories,
} from '@/lib/travel-memory';
import type { TravelMemory, TravelMemoryCategory } from '@/types/travel-memory';
import {
  categoryHasSelection,
  createEmptyTravelPreferencesState,
  parseStoredPreferenceContent,
  serializeCategoryPreference,
  TRAVEL_PREFERENCE_CATEGORIES,
  type CategoryPreferenceState,
  type TravelPreferencesState,
} from '@/types/travel-preferences';

const MANAGED_CATEGORIES = TRAVEL_PREFERENCE_CATEGORIES.map((item) => item.value);

function mergeCategoryMemories(memories: TravelMemory[]): CategoryPreferenceState {
  const chips = new Set<string>();
  const legacyParts: string[] = [];
  let custom = '';
  let showCustom = false;

  for (const memory of memories) {
    const parsed = parseStoredPreferenceContent(memory.content);
    if (parsed) {
      parsed.chips.forEach((chip) => chips.add(chip));
      if (parsed.custom) {
        custom = parsed.custom;
        showCustom = true;
      }
      continue;
    }

    legacyParts.push(memory.content.trim());
  }

  if (legacyParts.length > 0) {
    const legacyText = legacyParts.join('、');
    custom = custom ? `${custom}、${legacyText}` : legacyText;
    showCustom = true;
  }

  return {
    chips: [...chips],
    custom,
    showCustom,
    expanded: false,
  };
}

export async function loadTravelPreferencesState(): Promise<TravelPreferencesState> {
  const memories = await getTravelMemories();
  const state = createEmptyTravelPreferencesState();

  for (const category of MANAGED_CATEGORIES) {
    const categoryMemories = memories.filter((memory) => memory.category === category);
    if (categoryMemories.length > 0) {
      state[category] = mergeCategoryMemories(categoryMemories);
    }
  }

  return state;
}

export async function saveTravelPreferencesState(
  state: TravelPreferencesState,
): Promise<void> {
  const existing = await getTravelMemories();

  for (const category of MANAGED_CATEGORIES) {
    const categoryMemories = existing.filter((memory) => memory.category === category);
    for (const memory of categoryMemories) {
      await deleteTravelMemory(memory.id);
    }

    const preference = state[category];
    if (!categoryHasSelection(preference)) continue;

    await createTravelMemory({
      category,
      content: serializeCategoryPreference(preference),
    });
  }
}

export function isManagedTravelMemoryCategory(
  category: string,
): category is TravelMemoryCategory {
  return MANAGED_CATEGORIES.includes(category as TravelMemoryCategory);
}
