import type { Href } from 'expo-router';

import type { PlanCreationType } from '@/types/plan-creation';

/** Verified app routes (see src/app). */
export const HOME_ROUTES = {
  explore: '/(tabs)/explore' as Href,
  profile: '/(tabs)/profile' as Href,
  memories: '/memories' as Href,
  afterPlan: '/after-plan' as Href,
  myTrips: '/my-trips' as Href,
} as const;

export type HomePlanMode = 'now' | 'travel' | 'night';

export const PLAN_MODE_LABELS: Record<HomePlanMode, string> = {
  now: '今すぐ出かける',
  travel: '旅行プラン',
  night: '夜のおでかけ',
};

export const PLAN_MODE_TO_TYPE: Record<HomePlanMode, PlanCreationType> = {
  now: '今日のお出かけ',
  travel: '旅行プラン',
  night: '今日のお出かけ',
};

export type HomeActionTarget =
  | { kind: 'openForm'; mode: HomePlanMode; planType?: PlanCreationType; routeLabel: string }
  | { kind: 'href'; href: Href; routeLabel: string };

export type HomeFeatureIconName =
  | 'clock.fill'
  | 'suitcase.fill'
  | 'flame.fill'
  | 'moon.stars.fill'
  | 'mappin.and.ellipse'
  | 'photo.on.rectangle';

export type HomeActionConfig = {
  id: string;
  title: string;
  subtitle: string;
  icon: HomeFeatureIconName;
  fallbackEmoji: string;
  bg: string;
  border: string;
  accent: string;
  target: HomeActionTarget;
};

export const HOME_FEATURE_ACTIONS: HomeActionConfig[] = [
  {
    id: 'now',
    title: '今すぐ出かける',
    subtitle: '今日行けるスポットを探す',
    icon: 'clock.fill',
    fallbackEmoji: '🕐',
    bg: '#FFDCC2',
    border: '#FDBA74',
    accent: '#C2410C',
    target: { kind: 'openForm', mode: 'now', routeLabel: 'openForm:now' },
  },
  {
    id: 'travel',
    title: '旅行プラン',
    subtitle: '週末旅行を計画する',
    icon: 'suitcase.fill',
    fallbackEmoji: '🧳',
    bg: '#BFDBFE',
    border: '#93C5FD',
    accent: '#1D4ED8',
    target: { kind: 'openForm', mode: 'travel', routeLabel: 'openForm:travel' },
  },
  {
    id: 'popular',
    title: '人気プラン',
    subtitle: 'みんなの定番プランを見る',
    icon: 'flame.fill',
    fallbackEmoji: '🔥',
    bg: '#DDD6FE',
    border: '#C4B5FD',
    accent: '#6D28D9',
    target: { kind: 'href', href: HOME_ROUTES.explore, routeLabel: '/(tabs)/explore' },
  },
  {
    id: 'night',
    title: '夜のおでかけ',
    subtitle: '夜をもっと楽しもう',
    icon: 'moon.stars.fill',
    fallbackEmoji: '🌙',
    bg: '#C7D2FE',
    border: '#A5B4FC',
    accent: '#4338CA',
    target: { kind: 'openForm', mode: 'night', routeLabel: 'openForm:night' },
  },
  {
    id: 'local',
    title: 'ローカルの穴場',
    subtitle: '地元の人おすすめスポット',
    icon: 'mappin.and.ellipse',
    fallbackEmoji: '📍',
    bg: '#A7F3D0',
    border: '#6EE7B7',
    accent: '#047857',
    target: { kind: 'href', href: HOME_ROUTES.explore, routeLabel: '/(tabs)/explore?category=hidden' },
  },
  {
    id: 'memory',
    title: '思い出アルバム',
    subtitle: '行った場所を記録する',
    icon: 'photo.on.rectangle',
    fallbackEmoji: '🖼',
    bg: '#FDE68A',
    border: '#FCD34D',
    accent: '#B45309',
    target: { kind: 'href', href: HOME_ROUTES.memories, routeLabel: '/memories' },
  },
];

export type HomeCategoryConfig = {
  id: string;
  label: string;
  ring: string;
  image?: string;
  fallback: string;
  emoji: string;
  kind: 'recommended' | 'photo' | 'all';
  target: HomeActionTarget;
};
