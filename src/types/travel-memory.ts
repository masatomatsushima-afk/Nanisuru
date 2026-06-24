export type TravelMemoryCategory =
  | 'food'
  | 'travel_style'
  | 'budget'
  | 'activities'
  | 'companion';

export type TravelMemory = {
  id: string;
  userId: string;
  category: TravelMemoryCategory;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateTravelMemoryInput = {
  category: TravelMemoryCategory;
  content: string;
};

export type UpdateTravelMemoryInput = {
  category?: TravelMemoryCategory;
  content?: string;
};

export const TRAVEL_MEMORY_CATEGORIES: ReadonlyArray<{
  value: TravelMemoryCategory;
  label: string;
  icon: string;
  placeholder: string;
}> = [
  {
    value: 'food',
    label: '食の好み',
    icon: '🍽',
    placeholder: '例: 和食・地元の食堂が好き、辛いものは苦手',
  },
  {
    value: 'travel_style',
    label: '旅行スタイル',
    icon: '🧭',
    placeholder: '例: のんびり派、定番より穴場を探したい',
  },
  {
    value: 'budget',
    label: '予算感',
    icon: '💰',
    placeholder: '例: 1人1万円前後、体験にはお金をかけたい',
  },
  {
    value: 'activities',
    label: '好きなアクティビティ',
    icon: '📍',
    placeholder: '例: カフェ巡り、美術館、温泉',
  },
  {
    value: 'companion',
    label: '同行者の傾向',
    icon: '👥',
    placeholder: '例: 子供連れ、カップル、友人との旅行が多い',
  },
];

export function getTravelMemoryCategoryLabel(category: TravelMemoryCategory): string {
  return TRAVEL_MEMORY_CATEGORIES.find((item) => item.value === category)?.label ?? category;
}

export function getTravelMemoryCategoryIcon(category: TravelMemoryCategory): string {
  return TRAVEL_MEMORY_CATEGORIES.find((item) => item.value === category)?.icon ?? '📝';
}
