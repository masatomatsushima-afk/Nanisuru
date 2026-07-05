import { DISCOVER_SAMPLE_PLANS } from '@/data/discover-sample-plans';
import { buildTrendingPlans } from '@/lib/discover-ranking';
import { fetchPublicPlans } from '@/lib/public-plans';
import { isSupabaseConfigured } from '@/lib/supabase';
import type { RankedPublicPlan } from '@/types/discover-ranking';
import type { PublicPlan } from '@/types/public-plan';
import type { DiscoverSamplePlan } from '@/data/discover-sample-plans';
import { hasTravelUserPreferences, type TravelUserPreferences } from '@/types/travel-user-preferences';

export type DiscoverFeedSection = {
  id: string;
  title: string;
  plans: PublicPlan[];
};

export type DiscoverFeedResult = {
  plans: PublicPlan[];
  trending: RankedPublicPlan[];
  sections: DiscoverFeedSection[];
  fromMock: boolean;
};

function sampleToPublicPlan(sample: DiscoverSamplePlan): PublicPlan {
  const now = new Date().toISOString();
  return {
    id: `sample:${sample.id}`,
    userId: 'sample',
    sourceTripId: null,
    title: sample.title,
    description: sample.description,
    category: sample.category,
    tags: sample.tags,
    visibility: 'public',
    isPublic: true,
    isRemoved: false,
    moderationStatus: 'active',
    creatorDisplayName: sample.creatorDisplayName,
    payload: sample.payload,
    likeCount: sample.previewLikeCount,
    saveCount: sample.previewSaveCount,
    createdAt: now,
    updatedAt: now,
  };
}

function getMockDiscoverPlans(): PublicPlan[] {
  console.warn('[Discover] using local sample fallback');
  return DISCOVER_SAMPLE_PLANS.map(sampleToPublicPlan);
}

function matchesWeekend(plan: PublicPlan): boolean {
  const duration = plan.payload.tripDuration ?? '';
  const tags = plan.tags.join(' ');
  return (
    duration.includes('半日') ||
    duration === '1日' ||
    tags.includes('週末') ||
    tags.includes('半日')
  );
}

function matchesGourmet(plan: PublicPlan): boolean {
  return plan.category === 'グルメ' || plan.tags.some((tag) => tag.includes('グルメ'));
}

function matchesDate(plan: PublicPlan): boolean {
  return plan.category === 'デート' || plan.tags.some((tag) => tag.includes('デート'));
}

export function buildDiscoverFeedSections(plans: PublicPlan[], trending: RankedPublicPlan[]): DiscoverFeedSection[] {
  const popularIds = new Set(trending.slice(0, 6).map((item) => item.plan.id));
  const popular = trending.slice(0, 6).map((item) => item.plan);
  const remaining = plans.filter((plan) => !popularIds.has(plan.id));

  const sections: DiscoverFeedSection[] = [
    {
      id: 'popular',
      title: '人気の旅行プラン',
      plans: popular.length ? popular : plans.slice(0, 4),
    },
    {
      id: 'weekend',
      title: '週末のおでかけ',
      plans: remaining.filter(matchesWeekend).slice(0, 4),
    },
    {
      id: 'gourmet',
      title: 'グルメ旅',
      plans: plans.filter(matchesGourmet).slice(0, 4),
    },
    {
      id: 'date',
      title: 'デートプラン',
      plans: plans.filter(matchesDate).slice(0, 4),
    },
  ];

  return sections.filter((section) => section.plans.length > 0);
}

function sectionPriority(sectionId: string, prefs: TravelUserPreferences): number {
  const categories = prefs.favoriteCategories;
  let score = 0;
  if (sectionId === 'gourmet' && categories.some((c) => ['グルメ', 'カフェ'].includes(c))) {
    score += 3;
  }
  if (sectionId === 'date' && categories.includes('映え')) score += 2;
  if (sectionId === 'weekend' && prefs.travelPace === 'ゆっくり') score += 1;
  if (sectionId === 'popular') score += 1;
  return score;
}

export function personalizeDiscoverFeedSections(
  sections: DiscoverFeedSection[],
  prefs: TravelUserPreferences | null,
): DiscoverFeedSection[] {
  if (!prefs || !hasTravelUserPreferences(prefs)) return sections;

  console.log('[Discover] personalized feed by preferences', prefs);

  const sorted = [...sections].sort(
    (a, b) => sectionPriority(b.id, prefs) - sectionPriority(a.id, prefs),
  );

  const personalizedTitle =
    prefs.favoriteCategories.includes('グルメ') && prefs.favoriteCategories.includes('ローカル穴場')
      ? 'あなた向け（グルメ × 穴場）'
      : prefs.favoriteCategories.length
        ? `あなた向け（${prefs.favoriteCategories.slice(0, 2).join(' · ')}）`
        : null;

  if (!personalizedTitle) return sorted;

  const topPlans = sorted.flatMap((section) => section.plans).slice(0, 4);
  if (!topPlans.length) return sorted;

  return [
    { id: 'for-you', title: personalizedTitle, plans: topPlans },
    ...sorted,
  ];
}

export async function loadDiscoverFeed(
  areaHint?: string,
  preferences?: TravelUserPreferences | null,
): Promise<DiscoverFeedResult> {
  console.log('[Discover] loading feed');

  if (!isSupabaseConfigured()) {
    const plans = getMockDiscoverPlans();
    const trending = await buildTrendingPlans(plans);
    const sections = personalizeDiscoverFeedSections(
      buildDiscoverFeedSections(plans, trending),
      preferences ?? null,
    );
    console.log('[Discover] feed items', { planCount: plans.length, fromMock: true, sections });
    return { plans, trending, sections, fromMock: true };
  }

  try {
    const plans = await fetchPublicPlans();
    if (!plans.length) {
      const mockPlans = getMockDiscoverPlans();
      const trending = await buildTrendingPlans(mockPlans);
      const sections = personalizeDiscoverFeedSections(
        buildDiscoverFeedSections(mockPlans, trending),
        preferences ?? null,
      );
      console.log('[Discover] feed items', { planCount: mockPlans.length, fromMock: true, sections });
      return { plans: mockPlans, trending, sections, fromMock: true };
    }

    const trending = await buildTrendingPlans(plans);
    const sections = personalizeDiscoverFeedSections(
      buildDiscoverFeedSections(plans, trending),
      preferences ?? null,
    );
    console.log('[Discover] feed items', { planCount: plans.length, fromMock: false, sections });
    return { plans, trending, sections, fromMock: false };
  } catch (error) {
    console.warn('[Discover] feed load failed, using fallback', error);
    const plans = getMockDiscoverPlans();
    const trending = await buildTrendingPlans(plans);
    const sections = personalizeDiscoverFeedSections(
      buildDiscoverFeedSections(plans, trending),
      preferences ?? null,
    );
    console.log('[Discover] feed items', { planCount: plans.length, fromMock: true, sections });
    return { plans, trending, sections, fromMock: true };
  }
}
