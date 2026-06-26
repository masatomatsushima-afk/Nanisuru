import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { HomePhoto } from '@/components/home/home-photo';
import { HOME_LAYOUT, homeContentWidth } from '@/constants/home-layout';
import { HOME_UI } from '@/constants/home-ui';
import { NS } from '@/constants/nanisuru-ui';
import { useAuth } from '@/contexts/auth-context';
import { fetchPublicPlans } from '@/lib/public-plans';
import { VISUAL_PRESETS, type VisualTheme } from '@/lib/visual-placeholders';
import { getPublicPlanDestination, type PublicPlan } from '@/types/public-plan';
import { getProfileInitial } from '@/types/user-profile';

const COVER_H = 120;

type PreviewCard = {
  id: string;
  title: string;
  description: string;
  tag: string;
  area: string;
  creatorName: string;
  likes: number;
  saves: number;
  comments: number;
  imageUrl?: string;
  category: string;
  theme: VisualTheme;
  onPress: () => void;
};

const HOME_DISCOVER_FALLBACK: PreviewCard[] = [
  {
    id: 'umeda-night-cafe',
    title: '夜カフェから始まる梅田デート',
    description: '夜景とカフェでゆっくり過ごす、大人のデートコース',
    tag: 'デート',
    area: '大阪・梅田',
    creatorName: 'さくら',
    likes: 248,
    saves: 92,
    comments: 18,
    imageUrl: VISUAL_PRESETS.night.imageUrl,
    category: 'デート',
    theme: 'night',
    onPress: () => router.push('/(tabs)/explore'),
  },
  {
    id: 'kobe-rainy-trip',
    title: '雨の日の神戸ゆる旅',
    description: '屋内中心で移動少なめ。カフェと散歩の癒やし旅',
    tag: '旅行',
    area: '兵庫・神戸',
    creatorName: 'ゆうき',
    likes: 186,
    saves: 74,
    comments: 12,
    imageUrl: VISUAL_PRESETS.travel.imageUrl,
    category: '旅行',
    theme: 'travel',
    onPress: () => router.push('/(tabs)/explore'),
  },
  {
    id: 'asakusa-local',
    title: 'ローカルが教える浅草の穴場3選',
    description: '観光地の裏側を知る人だけの、穴場スポット巡り',
    tag: '穴場',
    area: '東京・浅草',
    creatorName: 'けんた',
    likes: 312,
    saves: 128,
    comments: 24,
    imageUrl: VISUAL_PRESETS.local.imageUrl,
    category: 'ローカル',
    theme: 'local',
    onPress: () => router.push('/(tabs)/explore'),
  },
];

function planToCard(plan: PublicPlan): PreviewCard {
  const tag = plan.tags[0] ?? plan.category;
  return {
    id: plan.id,
    title: plan.title,
    description: plan.description ?? '',
    tag,
    area: getPublicPlanDestination(plan),
    creatorName: plan.creatorDisplayName,
    likes: plan.likeCount,
    saves: plan.saveCount,
    comments: plan.commentCount ?? Math.max(1, Math.round(plan.likeCount * 0.1)),
    imageUrl: plan.images?.[0]?.imageUrl,
    category: plan.category,
    theme: 'popular',
    onPress: () => router.push(`/public-plan/${plan.id}`),
  };
}

function CoverScrim() {
  return (
    <>
      <View style={styles.scrimTopA} />
      <View style={styles.scrimTopB} />
      <View style={styles.scrimBottomA} />
      <View style={styles.scrimBottomB} />
    </>
  );
}

function PreviewCardView({ card, width }: { card: PreviewCard; width: number }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, { width }, pressed && styles.cardPressed]}
      onPress={card.onPress}>
      <View style={styles.coverWrap}>
        <HomePhoto
          width={width}
          height={COVER_H}
          theme={card.theme}
          imageUrl={card.imageUrl}
          borderRadius={0}
        />
        <CoverScrim />
        <View style={styles.tag}>
          <Text style={styles.tagText}>#{card.tag}</Text>
        </View>
        <View style={styles.statRow}>
          <View style={styles.statPill}>
            <Text style={styles.statText}>♥ {card.likes}</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statText}>📌 {card.saves}</Text>
          </View>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {card.title}
        </Text>
        <Text style={styles.area} numberOfLines={1}>
          📍 {card.area}
        </Text>
        <Text style={styles.description} numberOfLines={2}>
          {card.description}
        </Text>
        <View style={styles.divider} />
        <View style={styles.footer}>
          <View style={styles.creatorRow}>
            <View style={styles.avatarRing}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getProfileInitial(card.creatorName)}</Text>
              </View>
            </View>
            <Text style={styles.creator} numberOfLines={1}>
              {card.creatorName}
            </Text>
          </View>
          <View style={styles.commentPill}>
            <Text style={styles.comments}>💬 {card.comments}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export function HomeDiscoverPreview() {
  const { isConfigured } = useAuth();
  const [cards, setCards] = useState<PreviewCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const cardWidth = Math.min(homeContentWidth(Dimensions.get('window').width) * 0.58, 208);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      if (isConfigured) {
        const plans = await fetchPublicPlans();
        if (plans.length > 0) {
          setCards(plans.slice(0, 3).map(planToCard));
          return;
        }
      }
      setCards(HOME_DISCOVER_FALLBACK);
    } catch {
      setCards(HOME_DISCOVER_FALLBACK);
    } finally {
      setIsLoading(false);
    }
  }, [isConfigured]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>✨ みんなのプランから発見</Text>
        <Pressable onPress={() => router.push('/(tabs)/explore')} hitSlop={8}>
          <Text style={styles.action}>すべて見る</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={NS.colors.orange} size="small" />
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scroll}>
          {cards.map((card) => (
            <PreviewCardView key={card.id} card={card} width={cardWidth} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 5,
    paddingTop: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingBottom: 1,
  },
  sectionTitle: {
    flex: 1,
    color: NS.colors.text,
    ...HOME_UI.type.sectionTitle,
    fontSize: 14,
  },
  action: {
    color: NS.colors.orange,
    fontSize: 11,
    fontWeight: '800',
  },
  loading: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  scroll: {
    gap: HOME_LAYOUT.actionGap,
    paddingRight: 2,
  },
  card: {
    borderRadius: HOME_UI.radius.discover,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    borderWidth: HOME_UI.border.width,
    borderColor: HOME_UI.border.color,
    ...HOME_UI.shadow.card,
  },
  cardPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.995 }],
  },
  coverWrap: {
    height: COVER_H,
    overflow: 'hidden',
    position: 'relative',
    borderTopLeftRadius: HOME_UI.radius.discover,
    borderTopRightRadius: HOME_UI.radius.discover,
  },
  scrimTopA: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 36,
    backgroundColor: 'rgba(15, 23, 42, 0.22)',
  },
  scrimTopB: {
    position: 'absolute',
    top: 36,
    left: 0,
    right: 0,
    height: 24,
    backgroundColor: 'rgba(15, 23, 42, 0.06)',
  },
  scrimBottomA: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 52,
    backgroundColor: 'rgba(15, 23, 42, 0.34)',
  },
  scrimBottomB: {
    position: 'absolute',
    bottom: 52,
    left: 0,
    right: 0,
    height: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.08)',
  },
  tag: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: HOME_UI.radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(251, 146, 60, 0.15)',
    ...HOME_UI.shadow.photo,
    shadowOpacity: 0.06,
  },
  tagText: {
    color: NS.colors.coral,
    fontSize: 9,
    fontWeight: '800',
  },
  statRow: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    flexDirection: 'row',
    gap: 6,
  },
  statPill: {
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
    borderRadius: HOME_UI.radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  statText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  body: {
    paddingHorizontal: 11,
    paddingTop: 10,
    paddingBottom: 11,
    gap: 3,
  },
  title: {
    color: NS.colors.text,
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 16,
    letterSpacing: -0.2,
  },
  area: {
    color: NS.colors.textMuted,
    fontSize: 9,
    fontWeight: '700',
  },
  description: {
    color: NS.colors.textSecondary,
    fontSize: 9,
    lineHeight: 13,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: HOME_UI.border.colorSoft,
    marginTop: 7,
    marginBottom: 3,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  avatarRing: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: NS.colors.coralSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(251, 146, 60, 0.25)',
  },
  avatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 8,
    fontWeight: '900',
    color: NS.colors.coral,
  },
  creator: {
    flex: 1,
    color: NS.colors.text,
    fontSize: 9,
    fontWeight: '700',
  },
  commentPill: {
    backgroundColor: '#F8FAFC',
    borderRadius: HOME_UI.radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: HOME_UI.border.colorSoft,
  },
  comments: {
    color: NS.colors.textMuted,
    fontSize: 9,
    fontWeight: '700',
  },
});
