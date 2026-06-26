export type VisualTheme =
  | 'hero'
  | 'travel'
  | 'cafe'
  | 'date'
  | 'night'
  | 'scenery'
  | 'food'
  | 'local'
  | 'memory'
  | 'popular'
  | 'now'
  | 'outing';

export type VisualPreset = {
  theme: VisualTheme;
  gradientStart: string;
  gradientEnd: string;
  accentGlow: string;
  emoji: string;
  imageUrl: string;
};

const unsplash = (id: string, width = 640) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=80&fm=jpg`;

export const VISUAL_PRESETS: Record<VisualTheme, VisualPreset> = {
  hero: {
    theme: 'hero',
    gradientStart: '#FB7185',
    gradientEnd: '#FBBF24',
    accentGlow: 'rgba(255,255,255,0.28)',
    emoji: '🌸',
    imageUrl: unsplash('photo-1469854523086-cc02fe5d8800'),
  },
  travel: {
    theme: 'travel',
    gradientStart: '#2563EB',
    gradientEnd: '#38BDF8',
    accentGlow: 'rgba(255,255,255,0.22)',
    emoji: '🧳',
    imageUrl: unsplash('photo-1488646953014-85cb44e25828'),
  },
  cafe: {
    theme: 'cafe',
    gradientStart: '#FB923C',
    gradientEnd: '#FBBF24',
    accentGlow: 'rgba(255,255,255,0.24)',
    emoji: '☕',
    imageUrl: unsplash('photo-1495474472284-4d71bcdd2085'),
  },
  date: {
    theme: 'date',
    gradientStart: '#FB7185',
    gradientEnd: '#F472B6',
    accentGlow: 'rgba(255,255,255,0.22)',
    emoji: '💕',
    imageUrl: unsplash('photo-1516589178581-6cd7833ae3b2'),
  },
  night: {
    theme: 'night',
    gradientStart: '#4338CA',
    gradientEnd: '#6366F1',
    accentGlow: 'rgba(255,255,255,0.18)',
    emoji: '🌙',
    imageUrl: unsplash('photo-1514565131-fce0801cff61'),
  },
  scenery: {
    theme: 'scenery',
    gradientStart: '#059669',
    gradientEnd: '#34D399',
    accentGlow: 'rgba(255,255,255,0.2)',
    emoji: '🏔️',
    imageUrl: unsplash('photo-1506905925346-21bda4d32df4'),
  },
  food: {
    theme: 'food',
    gradientStart: '#EA580C',
    gradientEnd: '#FB7185',
    accentGlow: 'rgba(255,255,255,0.2)',
    emoji: '🍽',
    imageUrl: unsplash('photo-1504674900247-0877df9cc836'),
  },
  local: {
    theme: 'local',
    gradientStart: '#059669',
    gradientEnd: '#6EE7B7',
    accentGlow: 'rgba(255,255,255,0.2)',
    emoji: '🌿',
    imageUrl: unsplash('photo-1449824913935-59a10b8d2000'),
  },
  memory: {
    theme: 'memory',
    gradientStart: '#E11D48',
    gradientEnd: '#FB7185',
    accentGlow: 'rgba(255,255,255,0.22)',
    emoji: '📸',
    imageUrl: unsplash('photo-1527634205880-02aa3fa0778c'),
  },
  popular: {
    theme: 'popular',
    gradientStart: '#7C3AED',
    gradientEnd: '#A78BFA',
    accentGlow: 'rgba(255,255,255,0.22)',
    emoji: '✨',
    imageUrl: unsplash('photo-1476514525535-07fb3d4fd671'),
  },
  now: {
    theme: 'now',
    gradientStart: '#EA580C',
    gradientEnd: '#FBBF24',
    accentGlow: 'rgba(255,255,255,0.24)',
    emoji: '⚡',
    imageUrl: unsplash('photo-1500534314209-a25ddb2bd429'),
  },
  outing: {
    theme: 'outing',
    gradientStart: '#0284C7',
    gradientEnd: '#38BDF8',
    accentGlow: 'rgba(255,255,255,0.22)',
    emoji: '🚶',
    imageUrl: unsplash('photo-1470071459604-3b5ec3a7fe05'),
  },
};

const THEME_KEYWORDS: Array<{ keywords: string[]; theme: VisualTheme }> = [
  { keywords: ['カフェ', 'cafe', 'coffee'], theme: 'cafe' },
  { keywords: ['デート', 'date', 'カップル'], theme: 'date' },
  { keywords: ['夜', 'night', '夜景', 'バー'], theme: 'night' },
  { keywords: ['グルメ', '食事', 'food', 'ランチ', 'ディナー'], theme: 'food' },
  { keywords: ['穴場', 'ローカル', 'hidden', 'local'], theme: 'local' },
  { keywords: ['思い出', 'memory', 'album', '写真'], theme: 'memory' },
  { keywords: ['旅行', 'travel', 'trip', '週末'], theme: 'travel' },
  { keywords: ['散歩', '景色', 'scenery', '自然', '海'], theme: 'scenery' },
  { keywords: ['人気', 'popular', 'trending'], theme: 'popular' },
  { keywords: ['おでかけ', 'outing', '今すぐ'], theme: 'now' },
];

const ROTATING_THEMES: VisualTheme[] = [
  'travel',
  'cafe',
  'date',
  'scenery',
  'food',
  'night',
  'popular',
  'local',
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function resolveVisualTheme(input?: string | null): VisualTheme {
  if (!input?.trim()) return 'travel';
  const normalized = input.toLowerCase();

  for (const entry of THEME_KEYWORDS) {
    if (entry.keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))) {
      return entry.theme;
    }
  }

  return 'travel';
}

export function getVisualPreset(
  themeOrSeed?: VisualTheme | string | number | null,
  fallbackTheme: VisualTheme = 'travel',
): VisualPreset {
  if (typeof themeOrSeed === 'string' && themeOrSeed in VISUAL_PRESETS) {
    return VISUAL_PRESETS[themeOrSeed as VisualTheme];
  }

  if (typeof themeOrSeed === 'string' && themeOrSeed.trim()) {
    return VISUAL_PRESETS[resolveVisualTheme(themeOrSeed)];
  }

  if (typeof themeOrSeed === 'number') {
    return VISUAL_PRESETS[ROTATING_THEMES[themeOrSeed % ROTATING_THEMES.length] ?? fallbackTheme];
  }

  return VISUAL_PRESETS[fallbackTheme];
}

export function getVisualPresetFromSeed(seed: string | number, fallbackTheme: VisualTheme = 'travel') {
  if (typeof seed === 'number') {
    return getVisualPreset(seed, fallbackTheme);
  }
  return getVisualPreset(hashString(seed), fallbackTheme);
}
