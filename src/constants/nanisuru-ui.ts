import { Platform, type TextStyle, type ViewStyle } from 'react-native';

import { Spacing } from '@/constants/spacing';

const gradient = (css: string): ViewStyle =>
  Platform.OS === 'web'
    ? ({ experimental_backgroundImage: css } as ViewStyle)
    : {};

export const NS = {
  colors: {
    bg: '#FFF9F3',
    bgGradientTop: '#BAE6FD',
    bgGradientMid: '#FEF3C7',
    bgGradientBottom: '#FFF9F3',
    bgElevated: '#FFFFFF',
    bgCard: '#FFFFFF',
    bgInput: '#F8FAFC',
    accent: '#2563EB',
    accentSoft: 'rgba(37, 99, 235, 0.12)',
    accentBorder: 'rgba(37, 99, 235, 0.2)',
    accentGlow: 'rgba(56, 189, 248, 0.22)',
    sky: '#38BDF8',
    skySoft: 'rgba(56, 189, 248, 0.18)',
    coral: '#FB7185',
    coralSoft: 'rgba(251, 113, 133, 0.16)',
    orange: '#FB923C',
    orangeSoft: 'rgba(251, 146, 60, 0.18)',
    yellow: '#FBBF24',
    yellowSoft: 'rgba(251, 191, 36, 0.2)',
    mint: '#34D399',
    mintSoft: 'rgba(52, 211, 153, 0.18)',
    purple: '#A78BFA',
    purpleSoft: 'rgba(167, 139, 250, 0.18)',
    success: '#10B981',
    successSoft: 'rgba(16, 185, 129, 0.14)',
    danger: '#EF4444',
    dangerSoft: 'rgba(239, 68, 68, 0.1)',
    border: 'rgba(15, 23, 42, 0.06)',
    borderStrong: 'rgba(15, 23, 42, 0.1)',
    text: '#0F172A',
    textSecondary: '#475569',
    textMuted: '#94A3B8',
    textOnAccent: '#FFFFFF',
    overlay: 'rgba(15, 23, 42, 0.4)',
    navBg: '#FFFFFF',
    navBorder: 'rgba(15, 23, 42, 0.08)',
    tabActive: '#2563EB',
    tabActiveSoft: 'rgba(37, 99, 235, 0.12)',
  },
  gradient: {
    screen: 'linear-gradient(180deg, #BAE6FD 0%, #FFF9F3 38%, #FEF3C7 100%)',
    hero: 'linear-gradient(145deg, #E0F2FE 0%, #FFF9F3 55%, #FCE7F3 100%)',
    primaryButton: 'linear-gradient(135deg, #FB7185 0%, #2563EB 100%)',
    skyButton: 'linear-gradient(135deg, #38BDF8 0%, #2563EB 100%)',
    warmButton: 'linear-gradient(135deg, #FB923C 0%, #FB7185 100%)',
    mintButton: 'linear-gradient(135deg, #34D399 0%, #38BDF8 100%)',
    navBar: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(255,249,243,0.98) 100%)',
  },
  pop: {
    imafima: { bg: '#FFF7ED', border: '#FDBA74', accent: '#EA580C', emoji: '⚡' },
    bestDay: { bg: '#FEF3C7', border: '#FCD34D', accent: '#D97706', emoji: '🔥' },
    travel: { bg: '#EFF6FF', border: '#93C5FD', accent: '#2563EB', emoji: '🧳' },
    discover: { bg: '#F5F3FF', border: '#C4B5FD', accent: '#7C3AED', emoji: '✨' },
    afterPlan: { bg: '#EEF2FF', border: '#A5B4FC', accent: '#4338CA', emoji: '🌙' },
  },
  chipPalette: [
    { bg: '#EFF6FF', border: '#93C5FD', text: '#1D4ED8', dot: '#2563EB' },
    { bg: '#FFF1F2', border: '#FECDD3', text: '#E11D48', dot: '#FB7185' },
    { bg: '#FFF7ED', border: '#FED7AA', text: '#C2410C', dot: '#FB923C' },
    { bg: '#ECFDF5', border: '#A7F3D0', text: '#047857', dot: '#34D399' },
    { bg: '#F5F3FF', border: '#DDD6FE', text: '#6D28D9', dot: '#A78BFA' },
    { bg: '#FEF9C3', border: '#FDE047', text: '#A16207', dot: '#FBBF24' },
  ],
  category: {
    食事: { bg: '#FFF1F2', text: '#E11D48', border: '#FECDD3' },
    カフェ: { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA' },
    散歩: { bg: '#ECFDF5', text: '#047857', border: '#A7F3D0' },
    体験: { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
    景色: { bg: '#F0F9FF', text: '#0369A1', border: '#BAE6FD' },
    買い物: { bg: '#FAF5FF', text: '#7E22CE', border: '#E9D5FF' },
    文化: { bg: '#F5F3FF', text: '#6D28D9', border: '#DDD6FE' },
    休憩: { bg: '#F8FAFC', text: '#475569', border: '#E2E8F0' },
    夜景: { bg: '#EEF2FF', text: '#4338CA', border: '#C7D2FE' },
    移動: { bg: '#F1F5F9', text: '#334155', border: '#CBD5E1' },
    default: { bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' },
  },
  concierge: {
    weather: { bg: '#F0F9FF', border: '#BAE6FD', accent: '#0284C7' },
    outfit: { bg: '#FDF2F8', border: '#FBCFE8', accent: '#DB2777' },
    budget: { bg: '#ECFDF5', border: '#A7F3D0', accent: '#059669' },
    transport: { bg: '#EFF6FF', border: '#BFDBFE', accent: '#2563EB' },
  },
  radius: {
    xs: 10,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 28,
    pill: 999,
  },
  layout: {
    maxWidth: 480,
    screenPadding: Spacing.four,
    sectionGap: Spacing.four,
  },
  typography: {
    eyebrow: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.4,
    } satisfies TextStyle,
    display: {
      fontSize: 38,
      fontWeight: '800',
      letterSpacing: -1.2,
      lineHeight: 44,
    } satisfies TextStyle,
    title: {
      fontSize: 28,
      fontWeight: '800',
      letterSpacing: -0.6,
      lineHeight: 34,
    } satisfies TextStyle,
    titleSm: {
      fontSize: 20,
      fontWeight: '800',
      letterSpacing: -0.3,
      lineHeight: 28,
    } satisfies TextStyle,
    headline: {
      fontSize: 18,
      fontWeight: '800',
      letterSpacing: -0.2,
      lineHeight: 26,
    } satisfies TextStyle,
    body: {
      fontSize: 16,
      lineHeight: 26,
    } satisfies TextStyle,
    bodySm: {
      fontSize: 14,
      lineHeight: 22,
    } satisfies TextStyle,
    caption: {
      fontSize: 12,
      lineHeight: 18,
      fontWeight: '600',
    } satisfies TextStyle,
    label: {
      fontSize: 14,
      fontWeight: '700',
    } satisfies TextStyle,
  },
  shadow: {
    card: {
      shadowColor: '#64748B',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 14,
      elevation: 3,
    } satisfies ViewStyle,
    cardLg: {
      shadowColor: '#64748B',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 20,
      elevation: 6,
    } satisfies ViewStyle,
    accent: {
      shadowColor: '#2563EB',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.28,
      shadowRadius: 14,
      elevation: 5,
    } satisfies ViewStyle,
    pop: {
      shadowColor: '#FB7185',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.18,
      shadowRadius: 12,
      elevation: 3,
    } satisfies ViewStyle,
    nav: {
      shadowColor: '#64748B',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 8,
    } satisfies ViewStyle,
  },
} as const;

export function getCategoryStyle(category?: string) {
  const key = category as keyof typeof NS.category;
  return NS.category[key] ?? NS.category.default;
}

export function getChipPalette(index: number) {
  return NS.chipPalette[index % NS.chipPalette.length];
}

export function gradientStyle(kind: keyof typeof NS.gradient): ViewStyle {
  return gradient(NS.gradient[kind]);
}

export const cardStyle: ViewStyle = {
  backgroundColor: NS.colors.bgElevated,
  borderRadius: NS.radius.lg,
  borderWidth: 1,
  borderColor: NS.colors.border,
  ...NS.shadow.card,
};

export const inputStyle: ViewStyle = {
  backgroundColor: NS.colors.bgInput,
  borderColor: NS.colors.border,
  borderWidth: 1,
  borderRadius: NS.radius.sm + 2,
};
