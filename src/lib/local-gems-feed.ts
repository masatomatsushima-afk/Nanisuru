import { LOCAL_GEMS_SAMPLE_DATA } from '@/data/local-gems-sample';
import { fetchLocalHiddenSpots } from '@/lib/local-hidden-spots';
import { isSupabaseConfigured } from '@/lib/supabase';
import type { LocalGemsFeedSection, LocalHiddenSpot } from '@/types/local-hidden-spot';

export type LocalGemsFeedResult = {
  spots: LocalHiddenSpot[];
  sections: LocalGemsFeedSection[];
  fromMock: boolean;
};

function getMockGems(): LocalHiddenSpot[] {
  console.warn('[LocalGems] using local sample fallback');
  return LOCAL_GEMS_SAMPLE_DATA;
}

function matchesTag(spot: LocalHiddenSpot, ...keywords: string[]): boolean {
  const haystack = [spot.category, spot.description, ...spot.tags].join(' ');
  return keywords.some((keyword) => haystack.includes(keyword));
}

export function buildLocalGemsSections(
  spots: LocalHiddenSpot[],
  areaHint?: string,
): LocalGemsFeedSection[] {
  const normalizedArea = areaHint?.trim().toLowerCase() ?? '';
  const nearby = normalizedArea
    ? spots.filter((spot) => spot.area.toLowerCase().includes(normalizedArea))
    : spots.slice(0, 4);

  const sections: LocalGemsFeedSection[] = [
    {
      id: 'nearby',
      title: '近くの穴場',
      spots: (nearby.length ? nearby : spots.slice(0, 4)).slice(0, 6),
    },
    {
      id: 'popular',
      title: '人気の穴場',
      spots: [...spots].sort((a, b) => b.saveCount - a.saveCount).slice(0, 6),
    },
    {
      id: 'gourmet',
      title: 'グルメ穴場',
      spots: spots
        .filter((spot) => spot.category === 'グルメ' || matchesTag(spot, 'グルメ', 'レストラン', 'そば', '食'))
        .slice(0, 6),
    },
    {
      id: 'date',
      title: 'デート向き',
      spots: spots
        .filter((spot) => spot.category === 'デート' || matchesTag(spot, 'デート'))
        .slice(0, 6),
    },
    {
      id: 'rainy',
      title: '雨の日OK',
      spots: spots
        .filter((spot) => spot.category === '雨の日' || matchesTag(spot, '雨'))
        .slice(0, 6),
    },
    {
      id: 'night',
      title: '夜も行ける',
      spots: spots
        .filter((spot) =>
          ['夜景', '夜遊び'].includes(spot.category) || matchesTag(spot, '夜', '夜景'),
        )
        .slice(0, 6),
    },
  ];

  return sections.filter((section) => section.spots.length > 0);
}

export async function loadLocalGemsFeed(areaHint?: string): Promise<LocalGemsFeedResult> {
  console.log('[LocalGems] loading gems');

  if (!isSupabaseConfigured()) {
    const spots = getMockGems();
    const sections = buildLocalGemsSections(spots, areaHint);
    console.log('[LocalGems] feed items', { count: spots.length, fromMock: true, sections });
    return { spots, sections, fromMock: true };
  }

  try {
    const spots = await fetchLocalHiddenSpots({ area: areaHint, limit: 48 });
    if (!spots.length) {
      const mockSpots = getMockGems();
      const sections = buildLocalGemsSections(mockSpots, areaHint);
      console.log('[LocalGems] feed items', { count: mockSpots.length, fromMock: true, sections });
      return { spots: mockSpots, sections, fromMock: true };
    }

    const sections = buildLocalGemsSections(spots, areaHint);
    console.log('[LocalGems] feed items', { count: spots.length, fromMock: false, sections });
    return { spots, sections, fromMock: false };
  } catch (error) {
    console.warn('[LocalGems] feed load failed, using fallback', error);
    const spots = getMockGems();
    const sections = buildLocalGemsSections(spots, areaHint);
    console.log('[LocalGems] feed items', { count: spots.length, fromMock: true, sections });
    return { spots, sections, fromMock: true };
  }
}
