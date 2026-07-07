import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useRef, useState, useMemo, type ReactNode, type RefObject } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PlanGenerationOverlay } from '@/components/plan-generation-overlay';
import { PreferenceHomePromptCard } from '@/components/preference-settings-card';
import {
  HOME_FEATURE_ACTIONS,
  HOME_ROUTES,
  PLAN_MODE_LABELS,
  PLAN_MODE_TO_TYPE,
  type HomeActionConfig,
  type HomeActionTarget,
  type HomeCategoryConfig,
  type HomePlanMode,
} from '@/components/home/home-action-config';
import { VISUAL_PRESETS } from '@/lib/visual-placeholders';
import { getFormSheetScrollPaddingBottom } from '@/constants/mobile-layout';
import { Spacing } from '@/constants/theme';
import { LOOP_TEST_RESTORE } from '@/lib/loop-test-config';
import { shouldShowTravelFormOverlay } from '@/lib/travel-form-restore';
import { safeKey, safeText } from '@/lib/safe-text';
import type { PlanCreationType } from '@/types/plan-creation';
import {
  getTravelUserPreferenceChips,
  hasTravelUserPreferences,
  type TravelUserPreferences,
} from '@/types/travel-user-preferences';

const PAD = 16;
const MAX_W = 430;
const HERO_H = 190;
const HERO_RADIUS = 22;
const HERO_TEXT_RATIO = 0.55;
const STORY = 64;
const STORY_INNER = 52;
const CARD_H = 90;
const GRID_GAP = 12;
const BOTTOM_NAV_PAD = 128;

const PAGE_BG = '#FFFCF8';

const softShadow = {
  shadowColor: '#0F172A',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 4,
};

type HeroChip = {
  id: string;
  label: string;
  bg: string;
  text: string;
  border: string;
  target: HomeActionTarget;
};

type HeroBannerSlide = {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  fallbackColor: string;
  emoji: string;
  bannerTarget: HomeActionTarget;
  chips: HeroChip[];
};

const HERO_BANNERS: HeroBannerSlide[] = [
  {
    id: 'hero-weekend',
    title: '週末、なにする？♡',
    subtitle: '気分にぴったりの過ごし方を見つけよう',
    imageUrl: VISUAL_PRESETS.hero.imageUrl,
    fallbackColor: '#FFE8D6',
    emoji: '🏖',
    bannerTarget: { kind: 'openForm', mode: 'now', routeLabel: 'openForm:now' },
    chips: [
      {
        id: 'weekend-cafe',
        label: 'カフェ',
        bg: '#FFEDD5',
        text: '#C2410C',
        border: '#FDBA74',
        target: { kind: 'openForm', mode: 'now', routeLabel: 'openForm:now' },
      },
      {
        id: 'weekend-date',
        label: 'デート',
        bg: '#FFE4E6',
        text: '#E11D48',
        border: '#FDA4AF',
        target: { kind: 'openForm', mode: 'now', planType: 'デートプラン', routeLabel: 'openForm:date' },
      },
      {
        id: 'weekend-travel',
        label: '旅行',
        bg: '#DBEAFE',
        text: '#1D4ED8',
        border: '#93C5FD',
        target: { kind: 'openForm', mode: 'travel', routeLabel: 'openForm:travel' },
      },
      {
        id: 'weekend-night',
        label: '夜遊び',
        bg: '#E0E7FF',
        text: '#4338CA',
        border: '#A5B4FC',
        target: { kind: 'openForm', mode: 'night', routeLabel: 'openForm:night' },
      },
    ],
  },
  {
    id: 'hero-cafe',
    title: 'カフェ巡り',
    subtitle: 'のんびり過ごせるスポットをチェック',
    imageUrl: VISUAL_PRESETS.cafe.imageUrl,
    fallbackColor: '#FFEDD5',
    emoji: '☕',
    bannerTarget: { kind: 'openForm', mode: 'now', routeLabel: 'openForm:now' },
    chips: [
      {
        id: 'cafe-cafe',
        label: 'カフェ',
        bg: '#FFEDD5',
        text: '#C2410C',
        border: '#FDBA74',
        target: { kind: 'openForm', mode: 'now', routeLabel: 'openForm:now' },
      },
      {
        id: 'cafe-walk',
        label: '散歩',
        bg: '#ECFDF5',
        text: '#047857',
        border: '#A7F3D0',
        target: { kind: 'openForm', mode: 'now', routeLabel: 'openForm:now' },
      },
    ],
  },
  {
    id: 'hero-night',
    title: '夜のプラン',
    subtitle: '2軒目や夜景も、この先で',
    imageUrl: VISUAL_PRESETS.night.imageUrl,
    fallbackColor: '#E0E7FF',
    emoji: '🌙',
    bannerTarget: { kind: 'openForm', mode: 'night', routeLabel: 'openForm:night' },
    chips: [
      {
        id: 'night-night',
        label: '夜遊び',
        bg: '#E0E7FF',
        text: '#4338CA',
        border: '#A5B4FC',
        target: { kind: 'openForm', mode: 'night', routeLabel: 'openForm:night' },
      },
      {
        id: 'night-date',
        label: 'デート',
        bg: '#FFE4E6',
        text: '#E11D48',
        border: '#FDA4AF',
        target: { kind: 'openForm', mode: 'now', planType: 'デートプラン', routeLabel: 'openForm:date' },
      },
    ],
  },
];

const CATEGORIES: HomeCategoryConfig[] = [
  {
    id: 'rec',
    label: 'おすすめ',
    ring: '#FB7185',
    fallback: '#FECDD3',
    emoji: '♥',
    kind: 'recommended',
    target: { kind: 'href', href: HOME_ROUTES.explore, routeLabel: '/(tabs)/explore' },
  },
  {
    id: 'cafe',
    label: 'カフェ',
    ring: '#FB923C',
    image: VISUAL_PRESETS.cafe.imageUrl,
    fallback: '#FFEDD5',
    emoji: '☕',
    kind: 'photo',
    target: { kind: 'href', href: HOME_ROUTES.explore, routeLabel: '/(tabs)/explore' },
  },
  {
    id: 'travel',
    label: '旅行',
    ring: '#38BDF8',
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=200&h=200&q=80&fm=jpg',
    fallback: '#DBEAFE',
    emoji: '🏖',
    kind: 'photo',
    target: { kind: 'openForm', mode: 'travel', routeLabel: 'openForm:travel' },
  },
  {
    id: 'night',
    label: '夜遊び',
    ring: '#6366F1',
    image: VISUAL_PRESETS.night.imageUrl,
    fallback: '#312E81',
    emoji: '🌙',
    kind: 'photo',
    target: { kind: 'openForm', mode: 'night', routeLabel: 'openForm:night' },
  },
  {
    id: 'outing',
    label: 'おでかけ',
    ring: '#34D399',
    image: VISUAL_PRESETS.outing.imageUrl,
    fallback: '#D1FAE5',
    emoji: '🌸',
    kind: 'photo',
    target: { kind: 'openForm', mode: 'now', routeLabel: 'openForm:now' },
  },
  {
    id: 'food',
    label: 'グルメ',
    ring: '#F472B6',
    image: VISUAL_PRESETS.food.imageUrl,
    fallback: '#FCE7F3',
    emoji: '🍽',
    kind: 'photo',
    target: { kind: 'href', href: HOME_ROUTES.explore, routeLabel: '/(tabs)/explore' },
  },
];

const DISCOVER = [
  {
    id: 'home-discover-sample-1',
    badge: '夜デートに♡',
    badgeBg: 'rgba(251,113,133,0.94)',
    title: '夜カフェから始まる梅田デート',
    desc: 'おしゃれカフェでまったり…',
    creator: 'さやか',
    creatorAvatar:
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=80&h=80&q=80&fm=jpg',
    likes: 128,
    saves: 56,
    image: 'https://images.unsplash.com/photo-1514933656553-9e29c4b5b4c0?auto=format&fit=crop&w=640&q=80&fm=jpg',
    emoji: '🌙',
    fallback: '#E0E7FF',
  },
  {
    id: 'home-discover-sample-2',
    badge: '雨の日も楽しい',
    badgeBg: 'rgba(56,189,248,0.94)',
    title: '雨の日の神戸ゆる旅',
    desc: '屋内中心で移動少なめ…',
    creator: 'はると',
    creatorAvatar:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=80&h=80&q=80&fm=jpg',
    likes: 92,
    saves: 41,
    image: 'https://images.unsplash.com/photo-1420540443065-ee9d9b585086?auto=format&fit=crop&w=640&q=80&fm=jpg',
    emoji: '🌧',
    fallback: '#DBEAFE',
  },
  {
    id: 'home-discover-sample-3',
    badge: 'ローカルおすすめ',
    badgeBg: 'rgba(52,211,153,0.94)',
    title: 'ローカルが教える浅草の穴場3選',
    desc: '観光地の裏側を知る人だけ…',
    creator: 'ゆい',
    creatorAvatar:
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=80&h=80&q=80&fm=jpg',
    likes: 76,
    saves: 33,
    image: 'https://images.unsplash.com/photo-1545569344-7aa5bea84075?auto=format&fit=crop&w=640&q=80&fm=jpg',
    emoji: '⛩',
    fallback: '#A7F3D0',
  },
] as const;

const PREF_CHIPS = [
  { label: '映え', emoji: '✨', bg: '#FEF9C3', border: '#FDE047', text: '#A16207' },
  { label: 'カフェ', emoji: '☕', bg: '#FFF7ED', border: '#FDBA74', text: '#C2410C' },
  { label: 'のんびり', emoji: '🌿', bg: '#ECFDF5', border: '#A7F3D0', text: '#047857' },
  { label: '海辺', emoji: '🌊', bg: '#EFF6FF', border: '#93C5FD', text: '#1D4ED8' },
  { label: '温泉', emoji: '♨️', bg: '#FFF1F2', border: '#FECDD3', text: '#E11D48' },
] as const;

export type ReferenceHomeScreenProps = {
  renderPlanForm?: (sheetScrollRef: RefObject<ScrollView | null>) => ReactNode;
  onPlanFormOpen: (mode: HomePlanMode, planType: PlanCreationType) => void;
  onPlanFormClose?: () => void;
  afterPlanLocation?: string;
  isPlanGenerating?: boolean;
  generationStepIndex?: number;
  onAbortPlanGeneration?: () => void;
  travelUserPreferences?: TravelUserPreferences | null;
};

/** Always shows emoji/gradient first; overlays photo when loaded. Never blank. */
function CircleFill({
  uri,
  size,
  fallbackColor,
  emoji,
  emojiSize = 22,
}: {
  uri?: string;
  size: number;
  fallbackColor: string;
  emoji: string;
  emojiSize?: number;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(uri?.trim()) && !imageFailed;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: fallbackColor,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text style={{ fontSize: emojiSize }}>{emoji}</Text>
      {showImage ? (
        <Image
          source={{ uri }}
          style={[StyleSheet.absoluteFill, { width: size, height: size }]}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={160}
          onError={() => setImageFailed(true)}
        />
      ) : null}
    </View>
  );
}

function CoverFill({
  uri,
  width,
  height,
  fallbackColor,
  emoji,
  borderRadius = 0,
}: {
  uri: string;
  width: number;
  height: number;
  fallbackColor: string;
  emoji: string;
  borderRadius?: number;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = uri.trim().length > 0 && !imageFailed;

  return (
    <View
      style={{
        width,
        height,
        backgroundColor: fallbackColor,
        overflow: 'hidden',
        borderRadius,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text style={styles.coverFallbackEmoji}>{emoji}</Text>
      {showImage ? (
        <Image
          source={{ uri }}
          style={[StyleSheet.absoluteFill, { width, height }]}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={180}
          onError={() => setImageFailed(true)}
        />
      ) : null}
    </View>
  );
}

function RecommendedStoryCircle() {
  const gradientStyle =
    Platform.OS === 'web'
      ? ({
          experimental_backgroundImage: 'linear-gradient(145deg, #FB7185 0%, #FB923C 100%)',
        } as object)
      : { backgroundColor: '#FB7185' };

  return (
    <View style={[styles.storyRing, { borderColor: '#FB7185' }]}>
      <View style={[styles.storyRecommendedInner, gradientStyle]}>
        <Text style={styles.storyHeartIcon}>♥</Text>
      </View>
    </View>
  );
}

function StoryCircle({ item }: { item: HomeCategoryConfig }) {
  if (item.kind === 'recommended') {
    return <RecommendedStoryCircle />;
  }

  return (
    <View style={[styles.storyRing, { borderColor: item.ring }]}>
      <CircleFill
        uri={item.image}
        size={STORY_INNER}
        fallbackColor={item.fallback}
        emoji={item.emoji}
      />
    </View>
  );
}

function AllStoryCircle() {
  return (
    <View style={[styles.storyRing, { borderColor: '#CBD5E1' }]}>
      <View style={styles.storyAllInner}>
        <Text style={styles.storyAllChevronText}>⌄</Text>
      </View>
    </View>
  );
}

function HeroBannerCarousel({
  cardWidth,
  heroTextW,
  heroImageW,
  onBannerPress,
  onChipPress,
}: {
  cardWidth: number;
  heroTextW: number;
  heroImageW: number;
  onBannerPress: (slide: HeroBannerSlide) => void;
  onChipPress: (chip: HeroChip) => void;
}) {
  const listRef = useRef<FlatList<HeroBannerSlide>>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const updateActiveIndex = useCallback(
    (offsetX: number) => {
      if (cardWidth <= 0) return;
      const next = Math.min(
        Math.max(Math.round(offsetX / cardWidth), 0),
        HERO_BANNERS.length - 1,
      );
      setActiveIndex((prev) => (prev === next ? prev : next));
    },
    [cardWidth],
  );

  const onScrollSettled = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      updateActiveIndex(event.nativeEvent.contentOffset.x);
    },
    [updateActiveIndex],
  );

  const scrollToBanner = useCallback(
    (index: number) => {
      setActiveIndex((prev) => (prev === index ? prev : index));
      listRef.current?.scrollToIndex({ index, animated: true });
    },
    [],
  );

  const renderBanner = useCallback(
    ({ item }: { item: HeroBannerSlide }) => (
      <View style={{ width: cardWidth }}>
        <Pressable
          style={[styles.heroCard, { width: cardWidth, height: HERO_H }, softShadow]}
          onPress={() => onBannerPress(item)}>
          <View style={[styles.heroImagePane, { width: heroImageW }]}>
            <CoverFill
              uri={item.imageUrl}
              width={heroImageW}
              height={HERO_H}
              fallbackColor={item.fallbackColor}
              emoji={item.emoji}
            />
          </View>
          <View style={[styles.heroGradSolid, { width: heroTextW + 18 }]} />
          <View style={[styles.heroGradMid, { left: heroTextW - 14, width: 28 }]} />
          <View style={[styles.heroGradSoft, { left: heroTextW + 10, width: 18 }]} />
          <View style={[styles.heroTextPane, { width: heroTextW }]}>
            <Text style={styles.heroTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={styles.heroSub} numberOfLines={2}>
              {item.subtitle}
            </Text>
            <View style={styles.heroChips}>
              {item.chips.map((chip, chipIndex) => (
                <Pressable
                  key={safeKey(chip.id, `hero-chip-${chipIndex}`)}
                  style={[styles.heroChip, { backgroundColor: chip.bg, borderColor: chip.border }]}
                  onPress={(event) => {
                    event.stopPropagation();
                    onChipPress(chip);
                  }}>
                  <Text style={[styles.heroChipText, { color: chip.text }]}>{safeText(chip.label)}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Pressable>
      </View>
    ),
    [cardWidth, heroImageW, heroTextW, onBannerPress, onChipPress],
  );

  return (
    <View style={[styles.heroWrap, { width: cardWidth }]}>
      <FlatList
        ref={listRef}
        data={HERO_BANNERS}
        keyExtractor={(item, index) => safeKey(item.id, `hero-banner-${index}`)}
        renderItem={renderBanner}
        horizontal
        pagingEnabled={Platform.OS !== 'web'}
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={cardWidth}
        snapToAlignment="start"
        disableIntervalMomentum
        nestedScrollEnabled
        directionalLockEnabled
        bounces={false}
        onMomentumScrollEnd={onScrollSettled}
        onScrollEndDrag={onScrollSettled}
        getItemLayout={(_, index) => ({
          length: cardWidth,
          offset: cardWidth * index,
          index,
        })}
        onScrollToIndexFailed={(info) => {
          listRef.current?.scrollToOffset({
            offset: info.index * cardWidth,
            animated: true,
          });
        }}
      />
      <View style={styles.heroDots}>
        {HERO_BANNERS.map((banner, index) => (
          <Pressable
            key={safeKey(banner.id, `hero-dot-${index}`)}
            onPress={() => scrollToBanner(index)}
            hitSlop={8}
            accessibilityLabel={`バナー ${index + 1}`}>
            <View style={[styles.heroDot, index === activeIndex && styles.heroDotActive]} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function PlanFormSheet({
  visible,
  mode,
  onClose,
  preventClose,
  onAbortGeneration,
  isPlanGenerating,
  generationStepIndex = 0,
  renderForm,
}: {
  visible: boolean;
  mode: HomePlanMode | null;
  onClose: () => void;
  preventClose?: boolean;
  onAbortGeneration?: () => void;
  isPlanGenerating?: boolean;
  generationStepIndex?: number;
  renderForm?: (sheetScrollRef: RefObject<ScrollView | null>) => ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const formScrollRef = useRef<ScrollView>(null);

  const handleCloseRequest = useCallback(() => {
    if (preventClose) {
      Alert.alert(
        '作成を中断しますか？',
        'プラン生成中です。中断すると作成がキャンセルされます。',
        [
          { text: '続ける', style: 'cancel' },
          {
            text: '中断する',
            style: 'destructive',
            onPress: onAbortGeneration,
          },
        ],
      );
      return;
    }
    onClose();
  }, [onAbortGeneration, onClose, preventClose]);

  if (!mode) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleCloseRequest}>
      <View style={styles.modalRoot}>
        <Pressable
          style={styles.modalBackdrop}
          onPress={handleCloseRequest}
          accessibilityLabel="閉じる"
        />
        <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeaderText}>
              <Text style={styles.sheetTitle}>{safeText(PLAN_MODE_LABELS[mode])}</Text>
              <Text style={styles.sheetSubtitle}>プランを作成</Text>
            </View>
            <Pressable
              style={[styles.closeBtn, preventClose && styles.closeBtnDisabled]}
              onPress={handleCloseRequest}
              hitSlop={8}>
              <Text style={[styles.closeBtnText, preventClose && styles.closeBtnTextMuted]}>
                閉じる
              </Text>
            </Pressable>
          </View>
          <KeyboardAvoidingView
            style={styles.sheetKeyboardAvoid}
            behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : 'padding'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 4 : 0}>
            <ScrollView
              ref={formScrollRef}
              style={styles.sheetScroll}
              contentContainerStyle={[
                styles.sheetScrollContent,
                { paddingBottom: getFormSheetScrollPaddingBottom(insets.bottom) },
              ]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
              automaticallyAdjustKeyboardInsets>
              {renderForm?.(formScrollRef)}
            </ScrollView>
          </KeyboardAvoidingView>
        </View>

        {shouldShowTravelFormOverlay() ? (
        <PlanGenerationOverlay
          embedded
          visible={Boolean(isPlanGenerating)}
          currentStepIndex={generationStepIndex}
        />
        ) : null}
      </View>
    </Modal>
  );
}

export function ReferenceHomeScreen({
  renderPlanForm,
  onPlanFormOpen,
  onPlanFormClose,
  isPlanGenerating,
  generationStepIndex = 0,
  onAbortPlanGeneration,
  travelUserPreferences = null,
}: ReferenceHomeScreenProps) {
  const insets = useSafeAreaInsets();
  const { width: windowW } = useWindowDimensions();
  const contentW = useMemo(() => {
    const quantizedW = Platform.OS === 'web' ? Math.round(windowW / 4) * 4 : windowW;
    const shellW = Math.min(Math.floor(quantizedW), MAX_W);
    return shellW - PAD * 2;
  }, [windowW]);
  const shellW = contentW + PAD * 2;
  const heroTextW = useMemo(() => Math.round(contentW * HERO_TEXT_RATIO), [contentW]);
  const heroImageW = useMemo(() => contentW - heroTextW, [contentW, heroTextW]);
  const prefChips = travelUserPreferences && hasTravelUserPreferences(travelUserPreferences)
    ? getTravelUserPreferenceChips(travelUserPreferences)
    : PREF_CHIPS.map((c) => c.label);
  const [isPlanFormOpen, setIsPlanFormOpen] = useState(false);
  const [selectedPlanMode, setSelectedPlanMode] = useState<HomePlanMode | null>(null);
  const cardW = (contentW - GRID_GAP) / 2;
  const discoverW = Math.min(contentW * 0.64, 224);

  const closePlanForm = useCallback(() => {
    setIsPlanFormOpen(false);
    setSelectedPlanMode(null);
    onPlanFormClose?.();
  }, [onPlanFormClose]);

  const openPlanForm = useCallback(
    (mode: HomePlanMode, label: string, planTypeOverride?: PlanCreationType) => {
      const planType = planTypeOverride ?? PLAN_MODE_TO_TYPE[mode];
      console.log(`[HomeAction] tapped: ${label}`);
      console.log(`[HomeAction] open form mode: ${mode}`);
      setSelectedPlanMode(mode);
      setIsPlanFormOpen(true);
      onPlanFormOpen(mode, planType);
    },
    [onPlanFormOpen],
  );

  const runTarget = useCallback(
    (label: string, target: HomeActionTarget) => {
      console.log(`[HomeAction] tapped: ${label}`);
      if (target.kind === 'openForm') {
        openPlanForm(target.mode, label, target.planType);
        return;
      }
      console.log(`[HomeAction] tapped: ${safeText(label)} -> route: ${safeText(target.routeLabel)}`);
      const href = safeText(target.routeLabel);
      if (href.startsWith('/')) {
        router.push(href as never);
      }
    },
    [openPlanForm],
  );

  const handleFeaturePress = (action: HomeActionConfig) => {
    runTarget(action.title, action.target);
  };

  return (
    <>
      <View
        style={[
          styles.page,
          {
            width: shellW,
            maxWidth: MAX_W,
            alignSelf: 'center',
            paddingTop: Math.max(insets.top, 8),
            paddingBottom: BOTTOM_NAV_PAD,
          },
        ]}>
        {LOOP_TEST_RESTORE.homeSectionHeader ? (
        <>
        <View style={styles.header}>
          <Text style={styles.logo}>Nanisuru</Text>
          <View style={styles.headerRight}>
            <Pressable
              style={styles.searchBtn}
              onPress={() =>
                runTarget('検索', { kind: 'href', href: HOME_ROUTES.explore, routeLabel: HOME_ROUTES.explore })
              }>
              <Text style={styles.searchIcon}>🔍</Text>
            </Pressable>
            <Pressable
              style={styles.avatar}
              onPress={() =>
                runTarget('プロフィール', {
                  kind: 'href',
                  href: HOME_ROUTES.profile,
                  routeLabel: HOME_ROUTES.profile,
                })
              }>
              <CircleFill
                uri="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=80&h=80&q=80&fm=jpg"
                size={32}
                fallbackColor="#FECDD3"
                emoji="👤"
                emojiSize={16}
              />
            </Pressable>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [styles.myTripsLink, pressed && styles.myTripsLinkPressed]}
          onPress={() =>
            runTarget('マイトリップ', {
              kind: 'href',
              href: HOME_ROUTES.myTrips,
              routeLabel: HOME_ROUTES.myTrips,
            })
          }>
          <Text style={styles.myTripsEmoji}>🧳</Text>
          <View style={styles.myTripsTextWrap}>
            <Text style={styles.myTripsTitle}>マイトリップ</Text>
            <Text style={styles.myTripsSubtitle}>保存したプランと旅行秘書フォルダ</Text>
          </View>
          <Text style={styles.myTripsChevron}>›</Text>
        </Pressable>
        </>
        ) : null}

        {LOOP_TEST_RESTORE.homeSectionHero ? (
        <>
        <Text style={styles.sectionLabel}>✨ 今日のおすすめ</Text>

        <HeroBannerCarousel
          cardWidth={contentW}
          heroTextW={heroTextW}
          heroImageW={heroImageW}
          onBannerPress={(slide) => {
            if (slide.bannerTarget.kind === 'openForm') {
              openPlanForm(slide.bannerTarget.mode, slide.title, slide.bannerTarget.planType);
              return;
            }
            runTarget(slide.title, slide.bannerTarget);
          }}
          onChipPress={(chip) => runTarget(chip.label, chip.target)}
        />
        </>
        ) : null}

        {LOOP_TEST_RESTORE.homeSectionCategories ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.storyScroll}
          style={styles.storyRow}>
          {CATEGORIES.map((item, index) => (
            <Pressable
              key={safeKey(item.id, `category-${index}`)}
              style={styles.storyItem}
              onPress={() => runTarget(item.label, item.target)}>
              <StoryCircle item={item} />
              <Text style={styles.storyLabel}>{safeText(item.label)}</Text>
            </Pressable>
          ))}
          <Pressable
            style={styles.storyItem}
            onPress={() =>
              runTarget('すべて', { kind: 'href', href: HOME_ROUTES.explore, routeLabel: HOME_ROUTES.explore })
            }>
            <AllStoryCircle />
            <Text style={styles.storyLabel}>すべて</Text>
          </Pressable>
        </ScrollView>
        ) : null}

        {LOOP_TEST_RESTORE.homeSectionActionCards ? (
        <View style={[styles.grid, { width: contentW }]}>
          {Array.from({ length: 3 }).map((_, row) => (
            <View key={`action-row-${row}`} style={[styles.gridRow, { gap: GRID_GAP }]}>
              {HOME_FEATURE_ACTIONS.slice(row * 2, row * 2 + 2).map((action, index) => (
                <Pressable
                  key={safeKey(action.id, `action-${row}-${index}`)}
                  style={[
                    styles.featureCard,
                    softShadow,
                    {
                      width: cardW,
                      height: CARD_H,
                      backgroundColor: action.bg,
                      borderColor: action.border,
                    },
                  ]}
                  onPress={() => handleFeaturePress(action)}>
                  <View style={[styles.featureIconCircle, { borderColor: action.border }]}>
                    <Text style={styles.featureIconEmoji}>{action.fallbackEmoji}</Text>
                  </View>
                  <View style={styles.featureCopy}>
                    <Text style={[styles.featureTitle, { color: action.accent }]} numberOfLines={1}>
                      {action.title}
                    </Text>
                    <Text style={styles.featureSub} numberOfLines={2}>
                      {action.subtitle}
                    </Text>
                  </View>
                  <View style={[styles.featureArrow, { borderColor: `${action.accent}33` }]}>
                    <Text style={[styles.featureArrowText, { color: action.accent }]}>›</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ))}
        </View>
        ) : null}

        {LOOP_TEST_RESTORE.homeSectionDiscoverPreview ? (
        <View style={[styles.discoverSection, { width: contentW }]}>
          <View style={styles.discoverHead}>
            <Text style={styles.discoverTitle}>✨ みんなのプランから発見</Text>
            <Pressable
              onPress={() =>
                runTarget('すべて見る', { kind: 'href', href: HOME_ROUTES.explore, routeLabel: HOME_ROUTES.explore })
              }>
              <Text style={styles.discoverLink}>すべて見る 〉</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: GRID_GAP }}>
            {DISCOVER.map((d, index) => (
              <Pressable
                key={safeKey(d.id, `discover-${index}`)}
                style={[styles.discoverCard, softShadow, { width: discoverW }]}
                onPress={() =>
                  runTarget(d.title, { kind: 'href', href: HOME_ROUTES.explore, routeLabel: '/(tabs)/explore' })
                }>
                <View style={styles.discoverCover}>
                  <CoverFill
                    uri={d.image}
                    width={discoverW}
                    height={124}
                    fallbackColor={d.fallback}
                    emoji={d.emoji}
                  />
                  <View style={[styles.discoverBadge, { backgroundColor: d.badgeBg }]}>
                    <Text style={styles.discoverBadgeText}>{d.badge}</Text>
                  </View>
                </View>
                <View style={styles.discoverBody}>
                  <Text style={styles.discoverCardTitle} numberOfLines={2}>
                    {d.title}
                  </Text>
                  <Text style={styles.discoverCardDesc} numberOfLines={1}>
                    {d.desc}
                  </Text>
                  <View style={styles.discoverFooter}>
                    <View style={styles.discoverCreator}>
                      <CircleFill
                        uri={d.creatorAvatar}
                        size={20}
                        fallbackColor="#FECDD3"
                        emoji={safeText(d.creator[0]) || '?'}
                        emojiSize={10}
                      />
                      <Text style={styles.discoverCreatorName}>{safeText(d.creator)}</Text>
                    </View>
                    <Text style={styles.discoverStats}>
                      ♥ {d.likes}   📌 {d.saves}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
        ) : null}

        {LOOP_TEST_RESTORE.homeSectionPreferenceCard ? (
        <>
        {travelUserPreferences ? (
          <View style={{ width: contentW, marginTop: 2 }}>
            <PreferenceHomePromptCard preferences={travelUserPreferences} />
          </View>
        ) : null}

        <View style={[styles.prefCard, softShadow, { width: contentW }]}>
          <View style={styles.prefHeartCircle}>
            <Text style={styles.prefHeartIcon}>♥</Text>
          </View>
          <View style={styles.prefMain}>
            <Text style={styles.prefTitle}>あなたの好み</Text>
            <Text style={styles.prefDesc}>
              {travelUserPreferences && hasTravelUserPreferences(travelUserPreferences)
                ? '好み診断の結果をもとに、あなた向けの提案をしています'
                : 'これまでの保存や閲覧から、あなたの「好き」をまとめました'}
            </Text>
            <View style={styles.prefChips}>
              {prefChips.map((label, chipIndex) => {
                const chipLabel = safeText(label);
                const preset = PREF_CHIPS.find((c) => c.label === chipLabel);
                return (
                <View
                  key={`pref-${safeKey(chipLabel, 'chip')}-${chipIndex}`}
                  style={[
                    styles.prefChip,
                    {
                      backgroundColor: preset?.bg ?? '#EEF2FF',
                      borderColor: preset?.border ?? '#C7D2FE',
                    },
                  ]}>
                  <Text style={[styles.prefChipText, { color: preset?.text ?? '#4338CA' }]}>
                    {preset ? `${preset.emoji} ${chipLabel}` : chipLabel}
                  </Text>
                </View>
              )})}
            </View>
          </View>
          <Pressable
            style={styles.prefEdit}
            onPress={() => router.push('/preference-onboarding')}>
            <Text style={styles.prefEditIcon}>✎</Text>
            <Text style={styles.prefEditText}>編集</Text>
          </Pressable>
        </View>
        </>
        ) : null}
      </View>

      <PlanFormSheet
        visible={isPlanFormOpen}
        mode={selectedPlanMode}
        onClose={closePlanForm}
        preventClose={isPlanGenerating}
        onAbortGeneration={onAbortPlanGeneration}
        isPlanGenerating={isPlanGenerating}
        generationStepIndex={generationStepIndex}
        renderForm={renderPlanForm}
      />
    </>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: PAD,
    gap: 12,
    backgroundColor: PAGE_BG,
    width: '100%',
    maxWidth: MAX_W,
    alignSelf: 'center',
  },
  coverFallbackEmoji: { fontSize: 28, opacity: 0.85 },

  modalRoot: { flex: 1, justifyContent: 'flex-end', position: 'relative' },
  modalBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(15,23,42,0.45)' },
  modalSheet: {
    maxHeight: '92%',
    minHeight: '55%',
    backgroundColor: PAGE_BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  sheetKeyboardAvoid: {
    flex: 1,
    minHeight: 0,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    marginTop: 10,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(15,23,42,0.06)',
  },
  sheetHeaderText: { gap: 2 },
  sheetTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
  sheetSubtitle: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  closeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(251,146,60,0.25)',
  },
  closeBtnText: { fontSize: 13, fontWeight: '800', color: '#FB923C' },
  closeBtnDisabled: { opacity: 0.85 },
  closeBtnTextMuted: { color: '#94A3B8' },
  sheetScroll: { flexGrow: 1, flexShrink: 1 },
  sheetScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    flexGrow: 1,
    width: '100%',
    maxWidth: MAX_W,
    alignSelf: 'center',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingBottom: 2,
  },
  logo: {
    color: '#FB923C',
    fontSize: 25,
    fontWeight: '900',
    letterSpacing: -0.7,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  myTripsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.22)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 4,
  },
  myTripsLinkPressed: { opacity: 0.92 },
  myTripsEmoji: { fontSize: 22 },
  myTripsTextWrap: { flex: 1, gap: 2 },
  myTripsTitle: { fontSize: 14, fontWeight: '900', color: '#0F172A' },
  myTripsSubtitle: { fontSize: 11, fontWeight: '600', color: '#64748B' },
  myTripsChevron: { fontSize: 22, fontWeight: '700', color: '#818CF8' },
  searchBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 2,
  },
  searchIcon: { fontSize: 16 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: '#FECDD3',
  },

  sectionLabel: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
    marginTop: Spacing.one,
    marginBottom: Spacing.two,
  },

  heroWrap: { alignSelf: 'center', gap: 0, overflow: 'hidden' },
  heroCard: {
    position: 'relative',
    borderRadius: HERO_RADIUS,
    overflow: 'hidden',
    backgroundColor: '#FFF3E8',
    borderWidth: 1,
    borderColor: 'rgba(251,146,60,0.14)',
  },
  heroImagePane: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    backgroundColor: '#FFE8D6',
  },
  heroGradSolid: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(255,243,232,0.97)',
    zIndex: 1,
  },
  heroGradMid: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,243,232,0.5)',
    zIndex: 1,
  },
  heroGradSoft: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,243,232,0.12)',
    zIndex: 1,
  },
  heroTextPane: {
    position: 'relative',
    zIndex: 2,
    height: '100%',
    justifyContent: 'center',
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 10,
    gap: 3,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
    lineHeight: 25,
  },
  heroSub: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    lineHeight: 17,
  },
  heroChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  heroChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  heroChipText: { fontSize: 11, fontWeight: '800' },
  heroDots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: -10,
    zIndex: 3,
  },
  heroDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#CBD5E1',
    opacity: 0.55,
  },
  heroDotActive: {
    width: 18,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FB923C',
    opacity: 1,
  },

  storyRow: { marginHorizontal: -PAD },
  storyScroll: { paddingHorizontal: PAD, gap: 14, paddingVertical: 4 },
  storyItem: { alignItems: 'center', width: STORY + 6, gap: 5 },
  storyRing: {
    width: STORY,
    height: STORY,
    borderRadius: STORY / 2,
    borderWidth: 2.5,
    padding: 2,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyRecommendedInner: {
    width: STORY_INNER,
    height: STORY_INNER,
    borderRadius: STORY_INNER / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyHeartIcon: { color: '#FFFFFF', fontSize: 24, fontWeight: '900', marginTop: 1 },
  storyAllInner: {
    width: STORY_INNER,
    height: STORY_INNER,
    borderRadius: STORY_INNER / 2,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  storyAllChevronText: { fontSize: 22, color: '#64748B', fontWeight: '700', marginTop: -3 },
  storyLabel: { fontSize: 10, fontWeight: '700', color: '#0F172A', textAlign: 'center' },

  grid: { gap: GRID_GAP, alignSelf: 'center' },
  gridRow: { flexDirection: 'row' },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
    borderWidth: 1.5,
  },
  featureIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    backgroundColor: '#FFFFFF',
  },
  featureIconEmoji: { fontSize: 20 },
  featureCopy: { flex: 1, gap: 2, minWidth: 0, justifyContent: 'center' },
  featureTitle: { fontSize: 14, fontWeight: '900', letterSpacing: -0.25 },
  featureSub: { fontSize: 11, fontWeight: '600', color: '#475569', lineHeight: 15 },
  featureArrow: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  featureArrowText: { fontSize: 18, fontWeight: '700', marginTop: -1 },

  discoverSection: { gap: 10, alignSelf: 'center', marginTop: 2 },
  discoverHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  discoverTitle: { flex: 1, fontSize: 15, fontWeight: '900', color: '#0F172A', letterSpacing: -0.3 },
  discoverLink: { fontSize: 11, fontWeight: '800', color: '#FB923C' },
  discoverCard: {
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(251,146,60,0.1)',
  },
  discoverCover: { height: 124, position: 'relative', overflow: 'hidden' },
  discoverBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    zIndex: 2,
  },
  discoverBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
  discoverBody: { padding: 11, gap: 4 },
  discoverCardTitle: { fontSize: 12, fontWeight: '900', color: '#0F172A', lineHeight: 16 },
  discoverCardDesc: { fontSize: 10, fontWeight: '600', color: '#64748B' },
  discoverFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  discoverCreator: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  discoverCreatorName: { fontSize: 10, fontWeight: '700', color: '#0F172A' },
  discoverStats: { fontSize: 9, fontWeight: '800', color: '#64748B' },

  prefCard: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FFF5F2',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(251,146,60,0.16)',
    alignSelf: 'center',
    marginTop: 2,
  },
  prefHeartCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FECDD3',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  prefHeartIcon: { fontSize: 20, color: '#FB7185' },
  prefMain: { flex: 1, gap: 4, paddingRight: 52 },
  prefTitle: { fontSize: 14, fontWeight: '900', color: '#0F172A' },
  prefDesc: { fontSize: 10, fontWeight: '600', color: '#64748B', lineHeight: 14 },
  prefChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  prefChip: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
  },
  prefChipText: { fontSize: 10, fontWeight: '700' },
  prefEdit: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(251,146,60,0.22)',
  },
  prefEditIcon: { fontSize: 11, color: '#FB923C' },
  prefEditText: { fontSize: 10, fontWeight: '800', color: '#FB923C' },
});
