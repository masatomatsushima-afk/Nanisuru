import type { DiscoverTopCategoryId } from '@/components/discover/discover-category-chips';
import {
  DEFAULT_DISCOVER_FILTERS,
  type DiscoverFilterChipId,
  type DiscoverFilterState,
  type DiscoverSortOption,
} from '@/types/discover-filters';

export function filtersForDiscoverCategory(
  categoryId: DiscoverTopCategoryId,
): DiscoverFilterState {
  const base = { ...DEFAULT_DISCOVER_FILTERS };

  switch (categoryId) {
    case 'recommend':
      return { ...base, sort: 'popular' as DiscoverSortOption };
    case 'popular':
      return { ...base, sort: 'likes' };
    case 'date':
      return { ...base, selectedChips: ['date'] as DiscoverFilterChipId[] };
    case 'cafe':
      return { ...base, selectedChips: ['cafe'] };
    case 'night':
      return { ...base, selectedChips: ['night_date'] };
    case 'travel':
      return { ...base, selectedChips: ['one_day'] };
    case 'hidden':
      return { ...base, selectedChips: ['hidden_gem'] };
    case 'memory':
      return base;
    default:
      return base;
  }
}

export function isMemoryCategory(categoryId: DiscoverTopCategoryId): boolean {
  return categoryId === 'memory';
}
