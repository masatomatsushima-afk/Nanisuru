import type { TextStyle, ViewStyle } from 'react-native';

import { Spacing } from '@/constants/theme';

export const NS = {
  colors: {
    bg: '#0A0A0B',
    bgElevated: '#121214',
    bgCard: '#1A1A1D',
    bgInput: '#161618',
    accent: '#818CF8',
    accentSoft: 'rgba(129, 140, 248, 0.12)',
    accentBorder: 'rgba(129, 140, 248, 0.25)',
    accentGlow: 'rgba(129, 140, 248, 0.08)',
    success: '#34D399',
    successSoft: 'rgba(52, 211, 153, 0.12)',
    danger: '#F87171',
    dangerSoft: 'rgba(248, 113, 113, 0.08)',
    border: 'rgba(255, 255, 255, 0.06)',
    borderStrong: 'rgba(255, 255, 255, 0.1)',
    text: '#FFFFFF',
    textSecondary: '#B0B4BA',
    textMuted: '#6B7280',
    overlay: 'rgba(0, 0, 0, 0.82)',
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
      fontWeight: '700',
      letterSpacing: 1.2,
    } satisfies TextStyle,
    display: {
      fontSize: 48,
      fontWeight: '800',
      letterSpacing: -1.5,
      lineHeight: 52,
    } satisfies TextStyle,
    title: {
      fontSize: 28,
      fontWeight: '800',
      letterSpacing: -0.8,
      lineHeight: 36,
    } satisfies TextStyle,
    titleSm: {
      fontSize: 20,
      fontWeight: '700',
      letterSpacing: -0.3,
      lineHeight: 28,
    } satisfies TextStyle,
    headline: {
      fontSize: 18,
      fontWeight: '700',
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
      fontWeight: '600',
    } satisfies TextStyle,
  },
  shadow: {
    card: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.32,
      shadowRadius: 16,
      elevation: 6,
    } satisfies ViewStyle,
    cardLg: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.38,
      shadowRadius: 24,
      elevation: 10,
    } satisfies ViewStyle,
    accent: {
      shadowColor: '#818CF8',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.35,
      shadowRadius: 20,
      elevation: 8,
    } satisfies ViewStyle,
  },
} as const;

export const cardStyle: ViewStyle = {
  backgroundColor: NS.colors.bgElevated,
  borderRadius: NS.radius.lg,
  borderWidth: 1,
  borderColor: NS.colors.border,
  ...NS.shadow.card,
};

export const inputStyle: ViewStyle = {
  backgroundColor: NS.colors.bgInput,
  borderColor: NS.colors.borderStrong,
  borderWidth: 1,
  borderRadius: NS.radius.sm + 2,
};
