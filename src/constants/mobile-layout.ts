import { Platform } from 'react-native';

import { Spacing } from '@/constants/spacing';
import { BottomTabInset } from '@/constants/theme';

/** Minimum comfortable tap target (Apple HIG ~44pt). */
export const MIN_TOUCH_TARGET = 48;

/** Extra scroll padding so tab bar does not cover CTAs on tab screens. */
export const TAB_SCROLL_CLEARANCE = BottomTabInset + Spacing.five;

/** Bottom padding inside modal bottom sheets (above home indicator). */
export const SHEET_SCROLL_EXTRA = Spacing.six + Spacing.four;

export function getTabScreenPaddingBottom(insetsBottom: number): number {
  return insetsBottom + TAB_SCROLL_CLEARANCE;
}

export function getSheetScrollPaddingBottom(insetsBottom: number): number {
  return insetsBottom + SHEET_SCROLL_EXTRA;
}

export function getStackScreenPaddingBottom(insetsBottom: number): number {
  return insetsBottom + Spacing.six;
}

/** Offset for KeyboardAvoidingView below fixed chat headers. */
export function getChatKeyboardOffset(insetsTop: number, headerHeight = 76): number {
  return Platform.OS === 'ios' ? insetsTop + headerHeight : 0;
}
