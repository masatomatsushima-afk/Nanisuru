import { router } from 'expo-router';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';

import { HomePhoto } from '@/components/home/home-photo';
import { HOME_LAYOUT, HOME_PASTEL, homeActionCardWidth, homeContentWidth } from '@/constants/home-layout';
import { HOME_UI } from '@/constants/home-ui';
import { NS } from '@/constants/nanisuru-ui';
import type { VisualTheme } from '@/lib/visual-placeholders';

type ActionItem = {
  id: string;
  title: string;
  subtitle: string;
  emoji: string;
  theme: VisualTheme;
  bg: string;
  border: string;
  accent: string;
  onPress: () => void;
};

type HomeActionGridProps = {
  onTravelPress: () => void;
  afterPlanLocation?: string;
};

const ACTIONS: Omit<ActionItem, 'onPress'>[] = [
  {
    id: 'now',
    title: '今すぐ出かける',
    subtitle: '今日行けるスポットを探す',
    emoji: '⚡',
    theme: 'now',
    bg: HOME_PASTEL.peach,
    border: '#FECACA',
    accent: '#EA580C',
  },
  {
    id: 'travel',
    title: '旅行プラン',
    subtitle: '週末旅行を計画する',
    emoji: '🧳',
    theme: 'travel',
    bg: HOME_PASTEL.sky,
    border: '#BFDBFE',
    accent: '#2563EB',
  },
  {
    id: 'popular',
    title: '人気プラン',
    subtitle: 'みんなの定番プランを見る',
    emoji: '✨',
    theme: 'popular',
    bg: HOME_PASTEL.lavender,
    border: '#DDD6FE',
    accent: '#7C3AED',
  },
  {
    id: 'night',
    title: '夜のおでかけ',
    subtitle: '夜をもっと楽しもう',
    emoji: '🌙',
    theme: 'night',
    bg: HOME_PASTEL.night,
    border: '#C7D2FE',
    accent: '#4338CA',
  },
  {
    id: 'local',
    title: 'ローカルの穴場',
    subtitle: '地元の人おすすめスポット',
    emoji: '🌿',
    theme: 'local',
    bg: HOME_PASTEL.mint,
    border: '#A7F3D0',
    accent: '#059669',
  },
  {
    id: 'memory',
    title: '思い出アルバム',
    subtitle: '行った場所を記録する',
    emoji: '📸',
    theme: 'memory',
    bg: HOME_PASTEL.lemon,
    border: '#FDE68A',
    accent: '#D97706',
  },
];

function resolveOnPress(
  id: string,
  onTravelPress: () => void,
  afterPlanLocation?: string,
): () => void {
  switch (id) {
    case 'now':
      return () => router.push('/imafima');
    case 'travel':
      return onTravelPress;
    case 'popular':
    case 'local':
      return () => router.push('/(tabs)/explore');
    case 'night':
      return () =>
        router.push({
          pathname: '/after-plan',
          params: afterPlanLocation?.trim() ? { location: afterPlanLocation.trim() } : {},
        });
    case 'memory':
      return () => router.push('/memories');
    default:
      return () => {};
  }
}

function ActionCard({
  action,
  width,
  onPress,
}: {
  action: ActionItem;
  width: number;
  onPress: () => void;
}) {
  const thumb = HOME_LAYOUT.actionThumbSize;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        {
          width,
          height: HOME_LAYOUT.actionMinHeight,
          backgroundColor: action.bg,
          borderColor: action.border,
        },
        pressed && styles.cardPressed,
      ]}
      onPress={onPress}>
      <View style={styles.thumbWrap}>
        <View style={[styles.thumbFrame, { borderColor: action.border }]}>
          <HomePhoto
            width={thumb}
            height={thumb}
            theme={action.theme}
            borderRadius={HOME_UI.radius.thumb}
          />
        </View>
        <View style={[styles.emojiChip, { borderColor: action.border }]}>
          <Text style={styles.emojiText}>{action.emoji}</Text>
        </View>
      </View>

      <View style={styles.copy}>
        <Text style={[styles.title, { color: action.accent }]} numberOfLines={1}>
          {action.title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          {action.subtitle}
        </Text>
      </View>

      <View style={[styles.arrow, { backgroundColor: '#FFFFFF', borderColor: `${action.accent}28` }]}>
        <Text style={[styles.arrowText, { color: action.accent }]}>›</Text>
      </View>
    </Pressable>
  );
}

export function HomeActionGrid({ onTravelPress, afterPlanLocation }: HomeActionGridProps) {
  const screenWidth = Dimensions.get('window').width;
  const cardWidth = homeActionCardWidth(screenWidth);
  const gridWidth = homeContentWidth(screenWidth);

  const actions: ActionItem[] = ACTIONS.map((action) => ({
    ...action,
    onPress: resolveOnPress(action.id, onTravelPress, afterPlanLocation),
  }));

  const rows: ActionItem[][] = [];
  for (let i = 0; i < actions.length; i += 2) {
    rows.push(actions.slice(i, i + 2));
  }

  return (
    <View style={[styles.grid, { width: gridWidth }]}>
      {rows.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={[styles.row, { width: gridWidth }]}>
          {row.map((action) => (
            <ActionCard key={action.id} action={action} width={cardWidth} onPress={action.onPress} />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: HOME_LAYOUT.actionGap,
    alignSelf: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: HOME_UI.radius.card,
    paddingHorizontal: 9,
    paddingVertical: 8,
    gap: 8,
    borderWidth: HOME_UI.border.width,
    ...HOME_UI.shadow.card,
    shadowOpacity: 0.07,
  },
  cardPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.99 }],
  },
  thumbWrap: {
    position: 'relative',
    flexShrink: 0,
    width: HOME_LAYOUT.actionThumbSize + 2,
    height: HOME_LAYOUT.actionThumbSize + 2,
    alignSelf: 'center',
  },
  thumbFrame: {
    borderRadius: HOME_UI.radius.thumb + 1,
    borderWidth: 1.5,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    ...HOME_UI.shadow.photo,
    shadowOpacity: 0.08,
  },
  emojiChip: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
    ...HOME_UI.shadow.photo,
    shadowOpacity: 0.06,
  },
  emojiText: {
    fontSize: 10,
    lineHeight: 12,
  },
  copy: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
    minWidth: 0,
  },
  title: {
    ...HOME_UI.type.cardTitle,
  },
  subtitle: {
    color: NS.colors.textMuted,
    ...HOME_UI.type.cardSubtitle,
  },
  arrow: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    alignSelf: 'center',
  },
  arrowText: {
    fontSize: 17,
    fontWeight: '600',
    marginTop: -1,
    marginLeft: 1,
  },
});
