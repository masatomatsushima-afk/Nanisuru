/**
 * Nanisuru app theme — bright, pop, lifestyle companion.
 */

import '@/global.css';

import { Platform } from 'react-native';

import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/spacing';

/** @deprecated Use NS.colors directly. Kept for gradual migration. */
export const Colors = {
  light: {
    text: NS.colors.text,
    background: NS.colors.bg,
    backgroundElement: NS.colors.bgInput,
    backgroundSelected: NS.colors.accentSoft,
    textSecondary: NS.colors.textSecondary,
  },
  dark: {
    text: NS.colors.text,
    background: NS.colors.bg,
    backgroundElement: NS.colors.bgInput,
    backgroundSelected: NS.colors.accentSoft,
    textSecondary: NS.colors.textSecondary,
  },
  app: {
    text: NS.colors.text,
    background: NS.colors.bg,
    backgroundElement: NS.colors.bgInput,
    backgroundSelected: NS.colors.accentSoft,
    textSecondary: NS.colors.textSecondary,
  },
} as const;

export type ThemeColor = keyof typeof Colors.app;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export { Spacing };

export const BottomTabInset = Platform.select({ ios: 50, android: 80, web: 72 }) ?? 72;
export const MaxContentWidth = 800;
