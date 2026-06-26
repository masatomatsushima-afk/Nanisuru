/** Home screen layout tokens — dense, image-rich reference density. */

export const HOME_LAYOUT = {
  horizontalPadding: 8,
  sectionGap: 5,
  heroHeight: 158,
  heroPaddingH: 12,
  heroPaddingV: 9,
  heroImageWidth: 94,
  heroImageHeight: 128,
  categoryOuter: 58,
  categoryPhoto: 46,
  storyRing: 2,
  actionGap: 8,
  actionMinHeight: 84,
  actionThumbSize: 38,
} as const;

export const HOME_PASTEL = {
  cream: '#FFF9F5',
  creamPanel: 'rgba(255,255,255,0.78)',
  creamBorder: 'rgba(251, 146, 60, 0.14)',
  peach: '#FFF1EB',
  sky: '#EFF6FF',
  lavender: '#F5F3FF',
  mint: '#ECFDF5',
  lemon: '#FFFBEB',
  night: '#EEF2FF',
} as const;

export function homeContentWidth(screenWidth: number): number {
  return screenWidth - HOME_LAYOUT.horizontalPadding * 2;
}

export function homeActionCardWidth(screenWidth: number): number {
  const content = homeContentWidth(screenWidth);
  return (content - HOME_LAYOUT.actionGap) / 2;
}
