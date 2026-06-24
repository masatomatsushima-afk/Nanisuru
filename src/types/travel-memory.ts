export type TravelMemoryCategory =
  | 'food'
  | 'travel_style'
  | 'budget'
  | 'activities'
  | 'dislikes'
  | 'companion'
  | 'destinations';

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

/** @deprecated Use TRAVEL_PREFERENCE_CATEGORIES from travel-preferences.ts for editor UI */
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
    label: '好きな活動',
    icon: '📍',
    placeholder: '例: カフェ巡り、美術館、温泉',
  },
  {
    value: 'dislikes',
    label: '苦手なこと',
    icon: '🚫',
    placeholder: '例: 人混み、歩きすぎ、高い店',
  },
  {
    value: 'companion',
    label: '同行者タイプ',
    icon: '👥',
    placeholder: '例: 子供連れ、カップル、友人との旅行が多い',
  },
  {
    value: 'destinations',
    label: '行きたい場所の傾向',
    icon: '🗺',
    placeholder: '例: 海、路地裏、ローカルエリア',
  },
];

export function getTravelMemoryCategoryLabel(category: TravelMemoryCategory): string {
  return TRAVEL_MEMORY_CATEGORIES.find((item) => item.value === category)?.label ?? category;
}

export function getTravelMemoryCategoryIcon(category: TravelMemoryCategory): string {
  return TRAVEL_MEMORY_CATEGORIES.find((item) => item.value === category)?.icon ?? '📝';
}
