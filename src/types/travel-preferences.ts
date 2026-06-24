import type { TravelMemoryCategory } from '@/types/travel-memory';

export const PREFERENCE_OTHER_CHIP = 'その他';

export type CategoryPreferenceState = {
  chips: string[];
  custom: string;
  showCustom: boolean;
  expanded: boolean;
};

export type TravelPreferencesState = Record<TravelMemoryCategory, CategoryPreferenceState>;

export type PreferenceCategoryConfig = {
  value: TravelMemoryCategory;
  label: string;
  icon: string;
  chips: readonly string[];
  customPlaceholder: string;
};

export const TRAVEL_PREFERENCE_CATEGORIES: readonly PreferenceCategoryConfig[] = [
  {
    value: 'food',
    label: '食の好み',
    icon: '🍽',
    chips: [
      'カフェ',
      '焼肉',
      'ラーメン',
      'スイーツ',
      '和食',
      '韓国料理',
      'イタリアン',
      'ローカルフード',
    ],
    customPlaceholder:
      '例：古着屋巡り、静かなバー、海が見えるカフェ、辛い料理は苦手',
  },
  {
    value: 'travel_style',
    label: '旅行スタイル',
    icon: '🧭',
    chips: [
      'ゆっくり',
      'アクティブ',
      '映え重視',
      '穴場重視',
      'グルメ重視',
      '自然',
      '買い物',
      '文化体験',
    ],
    customPlaceholder:
      '例：朝は弱いので午後から、移動は少なめ、写真映えより雰囲気重視',
  },
  {
    value: 'budget',
    label: '予算感',
    icon: '💰',
    chips: [
      'リーズナブル',
      'コスパ重視',
      '体験重視',
      'ランチ控えめ',
      'ディナーは贅沢',
      '予算内厳守',
      'お土産多め',
      '交通費節約',
    ],
    customPlaceholder: '例：1人1万円前後、体験にはお金をかけたい',
  },
  {
    value: 'activities',
    label: '好きな活動',
    icon: '📍',
    chips: [
      'カフェ巡り',
      '美術館',
      '温泉',
      '散歩',
      'ショッピング',
      '夜景',
      '写真スポット',
      'ライブ・音楽',
    ],
    customPlaceholder: '例：古着屋、サウナ、早朝の散歩',
  },
  {
    value: 'dislikes',
    label: '苦手なこと',
    icon: '🚫',
    chips: [
      '人混み',
      '歩きすぎ',
      '高い店',
      '早起き',
      '騒がしい場所',
      '列待ち',
      '移動多め',
      '観光地の定番',
    ],
    customPlaceholder: '例：辛いものは苦手、長時間の列に並びたくない',
  },
  {
    value: 'companion',
    label: '同行者タイプ',
    icon: '👥',
    chips: ['一人', 'カップル', '友達', '家族', '子供連れ', '初デート', 'グループ', 'ビジネス'],
    customPlaceholder: '例：パートナーとのんびり、子供連れで動きやすい場所',
  },
  {
    value: 'destinations',
    label: '行きたい場所の傾向',
    icon: '🗺',
    chips: [
      '海',
      '山',
      '都市',
      '温泉地',
      '路地裏',
      'ローカルエリア',
      '歴史ある街',
      '最新スポット',
    ],
    customPlaceholder: '例：Brick Lane Melbourne、海が見えるカフェ、古着屋',
  },
];

export function createEmptyCategoryPreference(): CategoryPreferenceState {
  return {
    chips: [],
    custom: '',
    showCustom: false,
    expanded: false,
  };
}

export function createEmptyTravelPreferencesState(): TravelPreferencesState {
  return TRAVEL_PREFERENCE_CATEGORIES.reduce(
    (acc, category) => {
      acc[category.value] = createEmptyCategoryPreference();
      return acc;
    },
    {} as TravelPreferencesState,
  );
}

export function getPreferenceCategoryConfig(
  category: TravelMemoryCategory,
): PreferenceCategoryConfig | undefined {
  return TRAVEL_PREFERENCE_CATEGORIES.find((item) => item.value === category);
}

export function categoryHasSelection(state: CategoryPreferenceState): boolean {
  return state.chips.length > 0 || Boolean(state.custom.trim());
}

export function summarizeCategoryPreference(state: CategoryPreferenceState): string {
  const parts: string[] = [...state.chips];
  if (state.custom.trim()) parts.push('自由入力あり');
  if (parts.length === 0) return '未設定';
  return parts.slice(0, 3).join('、') + (parts.length > 3 ? '…' : '');
}

type StoredPreferencePayload = {
  v: 1;
  chips: string[];
  custom?: string;
};

export function serializeCategoryPreference(state: CategoryPreferenceState): string {
  const payload: StoredPreferencePayload = {
    v: 1,
    chips: state.chips,
    custom: state.custom.trim() || undefined,
  };
  return JSON.stringify(payload);
}

export function parseStoredPreferenceContent(
  content: string,
): { chips: string[]; custom: string } | null {
  const trimmed = content.trim();
  if (!trimmed.startsWith('{')) return null;

  try {
    const parsed = JSON.parse(trimmed) as StoredPreferencePayload;
    if (parsed.v !== 1 || !Array.isArray(parsed.chips)) return null;
    return {
      chips: parsed.chips.filter((chip) => typeof chip === 'string' && chip.trim()),
      custom: typeof parsed.custom === 'string' ? parsed.custom.trim() : '',
    };
  } catch {
    return null;
  }
}

export function formatPreferenceForPrompt(
  label: string,
  chips: string[],
  custom: string,
): string {
  const chipText = chips.length > 0 ? chips.join('、') : '';
  if (chipText && custom) {
    return `- ${label}: ${chipText}（★自由入力・最優先: ${custom}）`;
  }
  if (custom) {
    return `- ${label}: ★自由入力・最優先: ${custom}`;
  }
  if (chipText) {
    return `- ${label}: ${chipText}`;
  }
  return '';
}
