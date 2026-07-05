import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HOME_PASTEL } from '@/constants/home-layout';
import { NS, getChipPalette } from '@/constants/nanisuru-ui';
import { useAuth } from '@/contexts/auth-context';
import { getUserInitial } from '@/lib/auth';
import { fetchPublicPlans } from '@/lib/public-plans';
import type { TravelMemoryDisplayData } from '@/lib/travel-memory-display';
import { VISUAL_PRESETS, type VisualTheme } from '@/lib/visual-placeholders';
import { getPublicPlanDestination, type PublicPlan } from '@/types/public-plan';
import type { PlanCreationType } from '@/types/plan-creation';
import { getProfileInitial } from '@/types/user-profile';

/* ─── tokens ─── */
const HERO_H = 170;
const IMG_RATIO = 0.45;
const STORY_SIZE = 56;
const STORY_PHOTO = 44;
const ACTION_H = 88;
const ACTION_GAP = 8;
const DEFAULT_PREFS = ['映え', 'カフェ', 'のんびり', '海辺', '温泉'] as const;

type HomeFeedProps = {
  onScrollToForm: (planType?: PlanCreationType) => void;
  onTravelPress: () => void;
  afterPlanLocation?: string;
  memoryDisplay?: TravelMemoryDisplayData | null;
  isMemoryLoading?: boolean;
};

/* ══════════════════════════════════════════════
   HEADER
   ══════════════════════════════════════════════ */
function Header() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  return (
    <View style={[s.header, { paddingTop: insets.top + 2 }]}>
      <Text style={s.logo}>Nanisuru</Text>
      <View style={s.headerActions}>
        <Pressable
          style={({ pressed }) => [s.headerIcon, pressed && s.pressed]}
          onPress={() => router.push('/(tabs)/explore')}
          accessibilityLabel="検索">
          <Text style={s.headerIconText}>🔍</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [s.headerAvatar, pressed && s.pressed]}
          onPress={() => router.push('/(tabs)/profile')}
          accessibilityLabel="マイページ">
          <Text style={s.headerAvatarText}>{user ? getUserInitial(user) : '👤'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ══════════════════════════════════════════════
   HERO BANNER
   ══════════════════════════════════════════════ */
type HeroChip = {
  label: string;
  planType?: PlanCreationType;
  route?: string;
  bg: string;
  text: string;
  border: string;
};

type HeroSlide = {
  id: string;
  theme: VisualTheme;
  title: string;
  subtitle: string;
  chips: HeroChip[];
};

const HERO_SLIDES: HeroSlide[] = [
  {
    id: 'weekend',
    theme: 'hero',
    title: '週末、なにする？',
    subtitle: '気分にぴったりの過ごし方を見つけよう',
    chips: [
      { label: 'カフェ', planType: '今日のお出かけ', bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA' },
      { label: 'デート', planType: 'デートプラン', bg: '#FFF1F2', text: '#E11D48', border: '#FECDD3' },
      { label: '旅行', planType: '旅行プラン', bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' },
      { label: '夜遊び', route: '/after-plan', bg: '#EEF2FF', text: '#4338CA', border: '#C7D2FE' },
    ],
  },
  {
    id: 'cafe',
    theme: 'cafe',
    title: 'カフェ巡り',
    subtitle: 'のんびり過ごせるスポットをチェック',
    chips: [
      { label: 'カフェ', planType: '今日のお出かけ', bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA' },
      { label: '散歩', planType: '今日のお出かけ', bg: '#ECFDF5', text: '#047857', border: '#A7F3D0' },
    ],
  },
  {
    id: 'night',
    theme: 'night',
    title: '夜のプラン',
    subtitle: '2軒目や夜景も、この先で',
    chips: [
      { label: '夜遊び', route: '/after-plan', bg: '#EEF2FF', text: '#4338CA', border: '#C7D2FE' },
      { label: 'デート', planType: 'デートプラン', bg: '#FFF1F2', text: '#E11D48', border: '#FECDD3' },
    ],
  },
];

function HeroBanner({
  width,
  onPress,
  onChipPress,
}: {
  width: number;
  onPress?: () => void;
  onChipPress?: (planType?: PlanCreationType, route?: string) => void;
}) {
  const [active, setActive] = useState(0);
  const imgW = Math.round(width * IMG_RATIO);
  const textW = width - imgW;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / (width + ACTION_GAP));
    setActive(Math.min(idx, HERO_SLIDES.length - 1));
  };

  return (
    <View style={s.heroWrap}>
      <Text style={s.recLabel}>✨ 今日のおすすめ</Text>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        decelerationRate="fast"
        snapToInterval={width + ACTION_GAP}
        contentContainerStyle={{ gap: ACTION_GAP }}>
        {HERO_SLIDES.map((slide) => {
          const preset = VISUAL_PRESETS[slide.theme];
          return (
            <Pressable
              key={slide.id}
              style={({ pressed }) => [
                s.heroCard,
                { width, height: HERO_H },
                pressed && s.pressed,
              ]}
              onPress={onPress}>
              {/* cover image — right 45% */}
              <View style={[s.heroImagePane, { width: imgW }]}>
                <Image
                  source={{ uri: preset.imageUrl }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  contentPosition="center"
                  cachePolicy="memory-disk"
                  transition={250}
                />
                <View style={s.heroImageTint} />
              </View>
              {/* gradient blend */}
              <View style={[s.heroFade1, { width: textW + 24 }]} />
              <View style={[s.heroFade2, { left: textW - 20, width: 44 }]} />
              <View style={[s.heroFade3, { left: textW + 16, width: 28 }]} />
              {/* text */}
              <View style={[s.heroText, { width: textW }]}>
                <Text style={s.heroTitle} numberOfLines={2}>
                  {slide.title}
                </Text>
                <Text style={s.heroSubtitle} numberOfLines={2}>
                  {slide.subtitle}
                </Text>
                <View style={s.heroChips}>
                  {slide.chips.map((chip) => (
                    <Pressable
                      key={chip.label}
                      style={({ pressed }) => [
                        s.heroChip,
                        { backgroundColor: chip.bg, borderColor: chip.border },
                        pressed && s.pressed,
                      ]}
                      onPress={(ev) => {
                        ev.stopPropagation?.();
                        onChipPress?.(chip.planType, chip.route);
                      }}>
                      <Text style={[s.heroChipText, { color: chip.text }]}>{chip.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={s.heroDots}>
        {HERO_SLIDES.map((slide, i) => (
          <View key={slide.id} style={[s.heroDot, i === active && s.heroDotActive]} />
        ))}
      </View>
    </View>
  );
}

/* ══════════════════════════════════════════════
   STORY CATEGORY ROW
   ══════════════════════════════════════════════ */
const STORIES: Array<{ id: string; label: string; theme: VisualTheme; ring: string }> = [
  { id: 'recommend', label: 'おすすめ', theme: 'popular', ring: '#A78BFA' },
  { id: 'cafe', label: 'カフェ', theme: 'cafe', ring: '#FB923C' },
  { id: 'travel', label: '旅行', theme: 'travel', ring: '#38BDF8' },
  { id: 'night', label: '夜遊び', theme: 'night', ring: '#6366F1' },
  { id: 'outing', label: 'おでかけ', theme: 'outing', ring: '#34D399' },
  { id: 'food', label: 'グルメ', theme: 'food', ring: '#F472B6' },
];

function StoryThumb({ theme, ring }: { theme: VisualTheme; ring: string }) {
  const preset = VISUAL_PRESETS[theme];
  return (
    <View style={[s.storyRing, { borderColor: ring }]}>
      <Image
        source={{ uri: preset.imageUrl }}
        style={s.storyPhoto}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={150}
      />
    </View>
  );
}

function StoryCategoryRow() {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.storyScroll}>
      {STORIES.map((item) => (
        <Pressable
          key={item.id}
          style={({ pressed }) => [s.storyItem, pressed && s.pressed]}
          onPress={() => {
            if (item.id === 'night') {
              router.push('/after-plan');
              return;
            }
            router.push('/(tabs)/explore');
          }}>
          <StoryThumb theme={item.theme} ring={item.ring} />
          <Text style={s.storyLabel}>{item.label}</Text>
        </Pressable>
      ))}
      <Pressable
        style={({ pressed }) => [s.storyItem, pressed && s.pressed]}
        onPress={() => router.push('/(tabs)/explore')}>
        <View style={[s.storyRing, { borderColor: '#CBD5E1' }]}>
          <View style={s.storyAllInner}>
            <View style={s.storyAllGrid}>
              <View style={[s.storyAllDot, { backgroundColor: '#FDBA74' }]} />
              <View style={[s.storyAllDot, { backgroundColor: '#93C5FD' }]} />
              <View style={[s.storyAllDot, { backgroundColor: '#C4B5FD' }]} />
              <View style={[s.storyAllDot, { backgroundColor: '#6EE7B7' }]} />
            </View>
          </View>
        </View>
        <Text style={[s.storyLabel, { color: NS.colors.textSecondary }]}>すべて</Text>
      </Pressable>
    </ScrollView>
  );
}

/* ══════════════════════════════════════════════
   FEATURE ACTION GRID
   ══════════════════════════════════════════════ */
type ActionDef = {
  id: string;
  title: string;
  subtitle: string;
  emoji: string;
  theme: VisualTheme;
  bg: string;
  border: string;
  accent: string;
};

const ACTIONS: ActionDef[] = [
  { id: 'now', title: '今すぐ出かける', subtitle: '今日行けるスポットを探す', emoji: '⚡', theme: 'now', bg: HOME_PASTEL.peach, border: '#FECACA', accent: '#EA580C' },
  { id: 'travel', title: '旅行プラン', subtitle: '週末旅行を計画する', emoji: '🧳', theme: 'travel', bg: HOME_PASTEL.sky, border: '#BFDBFE', accent: '#2563EB' },
  { id: 'popular', title: '人気プラン', subtitle: 'みんなの定番プランを見る', emoji: '✨', theme: 'popular', bg: HOME_PASTEL.lavender, border: '#DDD6FE', accent: '#7C3AED' },
  { id: 'night', title: '夜のおでかけ', subtitle: '夜をもっと楽しもう', emoji: '🌙', theme: 'night', bg: HOME_PASTEL.night, border: '#C7D2FE', accent: '#4338CA' },
  { id: 'local', title: 'ローカルの穴場', subtitle: '地元の人おすすめスポット', emoji: '🌿', theme: 'local', bg: HOME_PASTEL.mint, border: '#A7F3D0', accent: '#059669' },
  { id: 'memory', title: '思い出アルバム', subtitle: '行った場所を記録する', emoji: '📸', theme: 'memory', bg: HOME_PASTEL.lemon, border: '#FDE68A', accent: '#D97706' },
];

function FeatureActionGrid({
  width,
  onTravelPress,
  afterPlanLocation,
}: {
  width: number;
  onTravelPress: () => void;
  afterPlanLocation?: string;
}) {
  const cardW = (width - ACTION_GAP) / 2;

  const press = (id: string) => {
    switch (id) {
      case 'now':
        router.push('/imafima');
        break;
      case 'travel':
        onTravelPress();
        break;
      case 'popular':
        router.push('/(tabs)/explore');
        break;
      case 'local':
        router.push('/local-gems');
        break;
      case 'night':
        router.push({
          pathname: '/after-plan',
          params: afterPlanLocation?.trim() ? { location: afterPlanLocation.trim() } : {},
        });
        break;
      case 'memory':
        router.push('/memories');
        break;
    }
  };

  const rows: ActionDef[][] = [];
  for (let i = 0; i < ACTIONS.length; i += 2) rows.push(ACTIONS.slice(i, i + 2));

  return (
    <View style={[s.actionGrid, { width }]}>
      {rows.map((row, ri) => (
        <View key={`r-${ri}`} style={[s.actionRow, { width }]}>
          {row.map((a) => {
            const preset = VISUAL_PRESETS[a.theme];
            return (
              <Pressable
                key={a.id}
                style={({ pressed }) => [
                  s.actionCard,
                  { width: cardW, height: ACTION_H, backgroundColor: a.bg, borderColor: a.border },
                  pressed && s.pressed,
                ]}
                onPress={() => press(a.id)}>
                <View style={s.actionThumbWrap}>
                  <Image
                    source={{ uri: preset.imageUrl }}
                    style={s.actionThumb}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                  <View style={[s.actionEmoji, { borderColor: a.border }]}>
                    <Text style={s.actionEmojiText}>{a.emoji}</Text>
                  </View>
                </View>
                <View style={s.actionCopy}>
                  <Text style={[s.actionTitle, { color: a.accent }]} numberOfLines={1}>
                    {a.title}
                  </Text>
                  <Text style={s.actionSub} numberOfLines={2}>
                    {a.subtitle}
                  </Text>
                </View>
                <View style={[s.actionArrow, { borderColor: `${a.accent}30` }]}>
                  <Text style={[s.actionArrowText, { color: a.accent }]}>›</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/* ══════════════════════════════════════════════
   DISCOVER PREVIEW
   ══════════════════════════════════════════════ */
type DiscoverCard = {
  id: string;
  title: string;
  description: string;
  tag: string;
  area: string;
  creatorName: string;
  likes: number;
  saves: number;
  imageUrl: string;
  theme: VisualTheme;
  onPress: () => void;
};

const DISCOVER_FALLBACK: DiscoverCard[] = [
  {
    id: 'umeda',
    title: '夜カフェから始まる梅田デート',
    description: '夜景とカフェでゆっくり過ごす、大人のデートコース',
    tag: 'デート',
    area: '大阪・梅田',
    creatorName: 'さくら',
    likes: 248,
    saves: 92,
    imageUrl: VISUAL_PRESETS.night.imageUrl,
    theme: 'night',
    onPress: () => router.push('/(tabs)/explore'),
  },
  {
    id: 'kobe',
    title: '雨の日の神戸ゆる旅',
    description: '屋内中心で移動少なめ。カフェと散歩の癒やし旅',
    tag: '旅行',
    area: '兵庫・神戸',
    creatorName: 'ゆうき',
    likes: 186,
    saves: 74,
    imageUrl: VISUAL_PRESETS.travel.imageUrl,
    theme: 'travel',
    onPress: () => router.push('/(tabs)/explore'),
  },
  {
    id: 'asakusa',
    title: 'ローカルが教える浅草の穴場3選',
    description: '観光地の裏側を知る人だけの、穴場スポット巡り',
    tag: '穴場',
    area: '東京・浅草',
    creatorName: 'けんた',
    likes: 312,
    saves: 128,
    imageUrl: VISUAL_PRESETS.local.imageUrl,
    theme: 'local',
    onPress: () => router.push('/(tabs)/explore'),
  },
];

function DiscoverCardView({ card, width }: { card: DiscoverCard; width: number }) {
  const coverH = 112;
  return (
    <Pressable
      style={({ pressed }) => [s.discoverCard, { width }, pressed && s.pressed]}
      onPress={card.onPress}>
      <View style={[s.discoverCover, { height: coverH }]}>
        <Image
          source={{ uri: card.imageUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
        <View style={s.discoverCoverTop} />
        <View style={s.discoverCoverBottom} />
        <View style={s.discoverTag}>
          <Text style={s.discoverTagText}>#{card.tag}</Text>
        </View>
        <View style={s.discoverStats}>
          <Text style={s.discoverStatText}>♥ {card.likes}</Text>
          <Text style={s.discoverStatText}>📌 {card.saves}</Text>
        </View>
      </View>
      <View style={s.discoverBody}>
        <Text style={s.discoverTitle} numberOfLines={2}>
          {card.title}
        </Text>
        <Text style={s.discoverArea} numberOfLines={1}>
          📍 {card.area}
        </Text>
        <Text style={s.discoverDesc} numberOfLines={2}>
          {card.description}
        </Text>
        <View style={s.discoverDivider} />
        <View style={s.discoverFooter}>
          <View style={s.discoverCreatorRow}>
            <View style={s.discoverAvatar}>
              <Text style={s.discoverAvatarText}>{getProfileInitial(card.creatorName)}</Text>
            </View>
            <Text style={s.discoverCreator} numberOfLines={1}>
              {card.creatorName}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function DiscoverPreview({ width }: { width: number }) {
  const { isConfigured } = useAuth();
  const [cards, setCards] = useState<DiscoverCard[]>([]);
  const [loading, setLoading] = useState(false);
  const cardW = Math.min(width * 0.58, 210);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (isConfigured) {
        const plans = await fetchPublicPlans();
        if (plans.length > 0) {
          setCards(
            plans.slice(0, 3).map((p: PublicPlan) => ({
              id: p.id,
              title: p.title,
              description: p.description ?? '',
              tag: p.tags[0] ?? p.category,
              area: getPublicPlanDestination(p),
              creatorName: p.creatorDisplayName,
              likes: p.likeCount,
              saves: p.saveCount,
              imageUrl: p.images?.[0]?.imageUrl ?? VISUAL_PRESETS.popular.imageUrl,
              theme: 'popular' as VisualTheme,
              onPress: () => router.push(`/public-plan/${p.id}`),
            })),
          );
          return;
        }
      }
      setCards(DISCOVER_FALLBACK);
    } catch {
      setCards(DISCOVER_FALLBACK);
    } finally {
      setLoading(false);
    }
  }, [isConfigured]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={s.discoverWrap}>
      <View style={s.discoverHeader}>
        <Text style={s.discoverSectionTitle}>✨ みんなのプランから発見</Text>
        <Pressable onPress={() => router.push('/(tabs)/explore')} hitSlop={8}>
          <Text style={s.discoverLink}>すべて見る</Text>
        </Pressable>
      </View>
      {loading ? (
        <ActivityIndicator color={NS.colors.orange} style={{ paddingVertical: 20 }} />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: ACTION_GAP }}>
          {cards.map((c) => (
            <DiscoverCardView key={c.id} card={c} width={cardW} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

/* ══════════════════════════════════════════════
   PREFERENCE SUMMARY
   ══════════════════════════════════════════════ */
function PreferenceSummary({
  memoryDisplay,
  isMemoryLoading,
}: {
  memoryDisplay?: TravelMemoryDisplayData | null;
  isMemoryLoading?: boolean;
}) {
  const chips =
    memoryDisplay?.hasMemory && memoryDisplay.preferenceChips.length > 0
      ? memoryDisplay.preferenceChips.slice(0, 5).map((c) => c.label)
      : [...DEFAULT_PREFS];

  return (
    <View style={s.prefCard}>
      <View style={s.prefHeader}>
        <Text style={s.prefTitle}>あなたの好み</Text>
        <Pressable
          style={({ pressed }) => [s.prefEdit, pressed && s.pressed]}
          onPress={() => router.push('/(tabs)/profile')}>
          <Text style={s.prefEditText}>編集</Text>
        </Pressable>
      </View>
      {isMemoryLoading ? (
        <Text style={s.prefLoading}>読み込み中...</Text>
      ) : (
        <View style={s.prefChips}>
          {chips.map((label, i) => {
            const pal = getChipPalette(i);
            return (
              <View
                key={`${label}-${i}`}
                style={[s.prefChip, { backgroundColor: pal.bg, borderColor: pal.border }]}>
                <Text style={[s.prefChipText, { color: pal.text }]}>{label}</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

/* ══════════════════════════════════════════════
   HOME FEED (entry point)
   ══════════════════════════════════════════════ */
export function HomeFeed({
  onScrollToForm,
  onTravelPress,
  afterPlanLocation,
  memoryDisplay,
  isMemoryLoading = false,
}: HomeFeedProps) {
  const [contentWidth, setContentWidth] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0 && w !== contentWidth) setContentWidth(w);
  };

  const handleChip = (planType?: PlanCreationType, route?: string) => {
    if (route) {
      router.push(route as '/after-plan');
      return;
    }
    onScrollToForm(planType);
  };

  return (
    <View style={s.screen} onLayout={onLayout}>
      <Header />
      {contentWidth > 0 ? (
        <>
          <HeroBanner
            width={contentWidth}
            onPress={() => onScrollToForm('今日のお出かけ')}
            onChipPress={handleChip}
          />
          <StoryCategoryRow />
          <FeatureActionGrid
            width={contentWidth}
            onTravelPress={onTravelPress}
            afterPlanLocation={afterPlanLocation}
          />
          <DiscoverPreview width={contentWidth} />
          <PreferenceSummary memoryDisplay={memoryDisplay} isMemoryLoading={isMemoryLoading} />
        </>
      ) : (
        <View style={{ height: HERO_H + 80 }} />
      )}
    </View>
  );
}

/* ══════════════════════════════════════════════
   STYLES
   ══════════════════════════════════════════════ */
const s = StyleSheet.create({
  screen: { gap: 10, width: '100%' },
  pressed: { opacity: 0.9 },

  /* header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 2,
  },
  logo: { color: NS.colors.orange, fontSize: 24, fontWeight: '900', letterSpacing: -0.8 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  headerIconText: { fontSize: 16 },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: NS.colors.coralSoft,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: { color: NS.colors.coral, fontSize: 14, fontWeight: '900' },

  /* hero */
  heroWrap: { gap: 6 },
  recLabel: { color: NS.colors.orange, fontSize: 11, fontWeight: '800', paddingLeft: 2 },
  heroCard: {
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#FFF5EB',
    borderWidth: 1,
    borderColor: 'rgba(251,146,60,0.16)',
    shadowColor: '#FB923C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 4,
  },
  heroImagePane: { position: 'absolute', top: 0, right: 0, bottom: 0, overflow: 'hidden' },
  heroImageTint: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(251,146,60,0.05)' },
  heroFade1: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(255,249,243,0.98)',
  },
  heroFade2: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,249,243,0.5)',
  },
  heroFade3: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,249,243,0.12)',
  },
  heroText: {
    flex: 1,
    justifyContent: 'center',
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 14,
    zIndex: 2,
    gap: 3,
  },
  heroTitle: {
    color: NS.colors.text,
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: -0.5,
    lineHeight: 24,
  },
  heroSubtitle: { color: NS.colors.textSecondary, fontSize: 11, fontWeight: '600', lineHeight: 15 },
  heroChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 8 },
  heroChip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  heroChipText: { fontSize: 9, fontWeight: '800' },
  heroDots: { flexDirection: 'row', justifyContent: 'center', gap: 5 },
  heroDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FDBA74', opacity: 0.4 },
  heroDotActive: { width: 18, backgroundColor: NS.colors.orange, opacity: 1 },

  /* stories */
  storyScroll: { gap: 14, paddingVertical: 2, paddingRight: 4 },
  storyItem: { alignItems: 'center', gap: 5, width: STORY_SIZE + 6 },
  storyRing: {
    width: STORY_SIZE,
    height: STORY_SIZE,
    borderRadius: STORY_SIZE / 2,
    borderWidth: 2.5,
    padding: 2,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyPhoto: { width: STORY_PHOTO, height: STORY_PHOTO, borderRadius: STORY_PHOTO / 2 },
  storyAllInner: {
    width: STORY_PHOTO,
    height: STORY_PHOTO,
    borderRadius: STORY_PHOTO / 2,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyAllGrid: { width: 20, height: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  storyAllDot: { width: 7, height: 7, borderRadius: 4 },
  storyLabel: { fontSize: 9, fontWeight: '700', color: NS.colors.text, textAlign: 'center' },

  /* actions */
  actionGrid: { gap: ACTION_GAP, alignSelf: 'center' },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between' },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
    shadowColor: '#FB923C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  actionThumbWrap: { position: 'relative', width: 40, height: 40 },
  actionThumb: { width: 40, height: 40, borderRadius: 11, borderWidth: 1.5, borderColor: '#FFFFFF' },
  actionEmoji: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionEmojiText: { fontSize: 9 },
  actionCopy: { flex: 1, gap: 2, minWidth: 0 },
  actionTitle: { fontSize: 12, fontWeight: '900', letterSpacing: -0.2 },
  actionSub: { fontSize: 9, fontWeight: '500', color: NS.colors.textMuted, lineHeight: 12 },
  actionArrow: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionArrowText: { fontSize: 17, fontWeight: '600', marginTop: -1 },

  /* discover */
  discoverWrap: { gap: 8 },
  discoverHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  discoverSectionTitle: { flex: 1, fontSize: 15, fontWeight: '900', color: NS.colors.text, letterSpacing: -0.3 },
  discoverLink: { color: NS.colors.orange, fontSize: 11, fontWeight: '800' },
  discoverCard: {
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(251,146,60,0.1)',
    shadowColor: '#FB923C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  discoverCover: { overflow: 'hidden', position: 'relative' },
  discoverCoverTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 40, backgroundColor: 'rgba(15,23,42,0.15)' },
  discoverCoverBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 48, backgroundColor: 'rgba(15,23,42,0.3)' },
  discoverTag: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  discoverTagText: { color: NS.colors.coral, fontSize: 9, fontWeight: '800' },
  discoverStats: { position: 'absolute', right: 8, bottom: 8, flexDirection: 'row', gap: 8 },
  discoverStatText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
  discoverBody: { padding: 11, gap: 3 },
  discoverTitle: { fontSize: 12, fontWeight: '900', color: NS.colors.text, lineHeight: 16 },
  discoverArea: { fontSize: 9, fontWeight: '700', color: NS.colors.textMuted },
  discoverDesc: { fontSize: 9, fontWeight: '600', color: NS.colors.textSecondary, lineHeight: 13 },
  discoverDivider: { height: 1, backgroundColor: 'rgba(15,23,42,0.06)', marginVertical: 4 },
  discoverFooter: { flexDirection: 'row', alignItems: 'center' },
  discoverCreatorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  discoverAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: NS.colors.coralSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discoverAvatarText: { fontSize: 8, fontWeight: '900', color: NS.colors.coral },
  discoverCreator: { fontSize: 9, fontWeight: '700', color: NS.colors.text },

  /* preferences */
  prefCard: {
    backgroundColor: HOME_PASTEL.cream,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: HOME_PASTEL.creamBorder,
  },
  prefHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  prefTitle: { fontSize: 14, fontWeight: '900', color: NS.colors.text },
  prefEdit: {
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(251,146,60,0.2)',
  },
  prefEditText: { color: NS.colors.orange, fontSize: 11, fontWeight: '800' },
  prefLoading: { color: NS.colors.textMuted, fontSize: 12 },
  prefChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  prefChip: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 5 },
  prefChipText: { fontSize: 11, fontWeight: '700' },
});
