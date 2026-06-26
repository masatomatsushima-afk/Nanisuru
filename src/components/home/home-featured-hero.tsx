import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { HOME_LAYOUT } from '@/constants/home-layout';
import { HOME_UI } from '@/constants/home-ui';
import { NS } from '@/constants/nanisuru-ui';
import { VISUAL_PRESETS, type VisualTheme } from '@/lib/visual-placeholders';
import type { PlanCreationType } from '@/types/plan-creation';

const HERO_HEIGHT = 158;
const IMAGE_SHARE = 0.45;

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
  eyebrow?: string;
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
    eyebrow: '☕ カフェ特集',
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
    eyebrow: '🌙 今夜のおでかけ',
    title: '夜のプラン',
    subtitle: '2軒目や夜景も、この先で',
    chips: [
      { label: '夜遊び', route: '/after-plan', bg: '#EEF2FF', text: '#4338CA', border: '#C7D2FE' },
      { label: 'デート', planType: 'デートプラン', bg: '#FFF1F2', text: '#E11D48', border: '#FECDD3' },
    ],
  },
];

type HomeFeaturedHeroProps = {
  onChipPress?: (planType?: PlanCreationType, route?: string) => void;
  onPress?: () => void;
};

function HeroBannerSlide({
  slide,
  cardWidth,
  onPress,
  onChipPress,
}: {
  slide: HeroSlide;
  cardWidth: number;
  onPress?: () => void;
  onChipPress?: (planType?: PlanCreationType, route?: string) => void;
}) {
  const imageWidth = Math.round(cardWidth * IMAGE_SHARE);
  const preset = VISUAL_PRESETS[slide.theme];

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { width: cardWidth, height: HERO_HEIGHT },
        pressed && styles.cardPressed,
      ]}
      onPress={onPress}>
      {/* Right half: wide cover photo, edge-to-edge */}
      <View style={[styles.imagePane, { width: imageWidth }]}>
        <Image
          source={{ uri: preset.imageUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          contentPosition="center"
          cachePolicy="memory-disk"
          transition={220}
        />
        <View style={styles.imageWarmWash} />
      </View>

      {/* Left-to-right warm fade so text and photo feel like one banner */}
      <View style={styles.fadeA} />
      <View style={styles.fadeB} />
      <View style={styles.fadeC} />
      <View style={styles.fadeD} />

      {/* Text + chips on the left */}
      <View style={[styles.textPane, { width: cardWidth - imageWidth + 12 }]}>
        {slide.eyebrow ? <Text style={styles.eyebrow}>{slide.eyebrow}</Text> : null}
        <Text style={styles.title} numberOfLines={2}>
          {slide.title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          {slide.subtitle}
        </Text>
        <View style={styles.chipRow}>
          {slide.chips.map((chip) => (
            <Pressable
              key={chip.label}
              style={({ pressed }) => [
                styles.chip,
                { backgroundColor: chip.bg, borderColor: chip.border },
                pressed && styles.chipPressed,
              ]}
              onPress={(event) => {
                event.stopPropagation?.();
                onChipPress?.(chip.planType, chip.route);
              }}>
              <Text style={[styles.chipText, { color: chip.text }]}>{chip.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Pressable>
  );
}

export function HomeFeaturedHero({ onChipPress, onPress }: HomeFeaturedHeroProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const handleLayout = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    if (next > 0 && next !== containerWidth) {
      setContainerWidth(next);
    }
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (containerWidth <= 0) return;
    const index = Math.round(
      event.nativeEvent.contentOffset.x / (containerWidth + HOME_LAYOUT.actionGap),
    );
    setActiveIndex(Math.min(index, HERO_SLIDES.length - 1));
  };

  return (
    <View style={styles.wrap} onLayout={handleLayout}>
      {containerWidth > 0 ? (
        <>
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            decelerationRate="fast"
            snapToInterval={containerWidth + HOME_LAYOUT.actionGap}
            contentContainerStyle={styles.scroll}>
            {HERO_SLIDES.map((slide) => (
              <HeroBannerSlide
                key={slide.id}
                slide={slide}
                cardWidth={containerWidth}
                onPress={onPress}
                onChipPress={onChipPress}
              />
            ))}
          </ScrollView>

          <View style={styles.dots}>
            {HERO_SLIDES.map((slide, index) => (
              <View
                key={slide.id}
                style={[styles.dot, index === activeIndex && styles.dotActive]}
              />
            ))}
          </View>
        </>
      ) : (
        <View style={styles.placeholder} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    gap: 4,
  },
  placeholder: {
    height: HERO_HEIGHT,
  },
  scroll: {
    gap: HOME_LAYOUT.actionGap,
  },
  card: {
    borderRadius: HOME_UI.radius.hero,
    overflow: 'hidden',
    backgroundColor: '#FFF4EB',
    borderWidth: 1,
    borderColor: 'rgba(251, 146, 60, 0.18)',
    ...HOME_UI.shadow.hero,
  },
  cardPressed: {
    opacity: 0.97,
  },
  imagePane: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  imageWarmWash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(251, 146, 60, 0.05)',
  },
  fadeA: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: '55%',
    backgroundColor: 'rgba(255, 248, 241, 0.98)',
  },
  fadeB: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: '10%',
    backgroundColor: 'rgba(255, 248, 241, 0.55)',
  },
  fadeC: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '58%',
    width: '8%',
    backgroundColor: 'rgba(255, 248, 241, 0.18)',
  },
  fadeD: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '64%',
    width: '6%',
    backgroundColor: 'rgba(255, 248, 241, 0.06)',
  },
  textPane: {
    flex: 1,
    justifyContent: 'center',
    paddingLeft: 13,
    paddingRight: 2,
    paddingVertical: 9,
    gap: 1,
    zIndex: 2,
  },
  eyebrow: {
    color: NS.colors.orange,
    fontSize: 9,
    fontWeight: '800',
    marginBottom: 1,
  },
  title: {
    color: NS.colors.text,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.45,
    lineHeight: 22,
  },
  subtitle: {
    color: NS.colors.textSecondary,
    fontSize: 10.5,
    fontWeight: '600',
    lineHeight: 14,
    opacity: 0.92,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6,
  },
  chip: {
    borderRadius: HOME_UI.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
  },
  chipPressed: {
    opacity: 0.85,
  },
  chipText: {
    fontSize: 9,
    fontWeight: '800',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#FDBA74',
    opacity: 0.45,
  },
  dotActive: {
    width: 14,
    backgroundColor: NS.colors.orange,
    opacity: 1,
  },
});
