export const OUTFIT_STYLE_MODE_OPTIONS = [
  'カジュアル',
  'きれいめ',
  'デート向け',
  '写真映え',
  '動きやすさ重視',
  '防寒重視',
  '雨対策重視',
  'AIに任せる',
] as const;

export type OutfitStyleMode = (typeof OUTFIT_STYLE_MODE_OPTIONS)[number];

export type OutfitPackingAdvice = {
  title: string;
  outfit: string[];
  footwear: string[];
  items: string[];
  cautions: string[];
  dateOutfitTips?: string[];
  travelPackingAdvice?: string[];
  styleMode?: OutfitStyleMode;
};

export function isOutfitStyleMode(value: string): value is OutfitStyleMode {
  return OUTFIT_STYLE_MODE_OPTIONS.includes(value as OutfitStyleMode);
}

export function resolveOutfitStyleMode(
  mode?: OutfitStyleMode | null,
  planType?: string,
  companion?: string,
): OutfitStyleMode {
  if (mode && mode !== 'AIに任せる') return mode;
  if (planType === 'デートプラン' || companion === 'カップル' || companion === '初デート') {
    return 'デート向け';
  }
  if (planType === '旅行プラン' || planType === '週末プラン') {
    return '動きやすさ重視';
  }
  return 'カジュアル';
}
