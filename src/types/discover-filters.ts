export type DiscoverSortOption = 'popular' | 'newest' | 'saves' | 'likes';

export const DISCOVER_SORT_OPTIONS: ReadonlyArray<{
  value: DiscoverSortOption;
  label: string;
}> = [
  { value: 'popular', label: '人気順' },
  { value: 'newest', label: '新着順' },
  { value: 'saves', label: '保存数順' },
  { value: 'likes', label: 'いいね順' },
];

export type DiscoverFilterChipId =
  | 'date'
  | 'friends'
  | 'solo'
  | 'family'
  | 'gourmet'
  | 'cafe'
  | 'rainy'
  | 'low_budget'
  | 'half_day'
  | 'one_day'
  | 'night_date'
  | 'hidden_gem'
  | 'insta';

export const DISCOVER_FILTER_CHIPS: ReadonlyArray<{
  id: DiscoverFilterChipId;
  label: string;
}> = [
  { id: 'date', label: 'デート' },
  { id: 'friends', label: '友達' },
  { id: 'solo', label: '一人' },
  { id: 'family', label: '家族' },
  { id: 'gourmet', label: 'グルメ' },
  { id: 'cafe', label: 'カフェ' },
  { id: 'rainy', label: '雨の日' },
  { id: 'low_budget', label: '低予算' },
  { id: 'half_day', label: '半日' },
  { id: 'one_day', label: '1日' },
  { id: 'night_date', label: '夜デート' },
  { id: 'hidden_gem', label: '穴場' },
  { id: 'insta', label: '映え' },
];

export type DiscoverBudgetFilterId =
  | 'under_3000'
  | 'under_5000'
  | 'under_10000'
  | 'over_10000';

export type DiscoverFilterState = {
  searchQuery: string;
  selectedChips: DiscoverFilterChipId[];
  budgetFilter: DiscoverBudgetFilterId | null;
  areaQuery: string;
  sort: DiscoverSortOption;
};

export const DEFAULT_DISCOVER_FILTERS: DiscoverFilterState = {
  searchQuery: '',
  selectedChips: [],
  budgetFilter: null,
  areaQuery: '',
  sort: 'popular',
};
