/** Shared Home screen visual tokens — one coherent design system. */

export const HOME_UI = {
  radius: {
    card: 16,
    hero: 20,
    thumb: 10,
    pill: 999,
    discover: 16,
  },
  border: {
    width: 1,
    color: 'rgba(251, 146, 60, 0.12)',
    colorSoft: 'rgba(15, 23, 42, 0.06)',
  },
  shadow: {
    card: {
      shadowColor: '#FB923C',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },
    hero: {
      shadowColor: '#FB923C',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 3,
    },
    photo: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
  },
  type: {
    heroTitle: { fontSize: 19, fontWeight: '900' as const, letterSpacing: -0.5, lineHeight: 23 },
    heroSubtitle: { fontSize: 10, fontWeight: '600' as const, lineHeight: 14 },
    sectionTitle: { fontSize: 15, fontWeight: '900' as const, letterSpacing: -0.3 },
    cardTitle: { fontSize: 12, fontWeight: '900' as const, letterSpacing: -0.25 },
    cardSubtitle: { fontSize: 9, fontWeight: '500' as const, lineHeight: 12 },
    chip: { fontSize: 9, fontWeight: '800' as const },
    storyLabel: { fontSize: 9, fontWeight: '700' as const },
  },
  spacing: {
    cardPad: 8,
    sectionGap: 5,
  },
} as const;
