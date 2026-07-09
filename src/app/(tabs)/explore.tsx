import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PremiumCard } from '@/components/ui/premium-card';
import { ScreenBackground } from '@/components/ui/screen-background';
import { FadeInView } from '@/components/ui/fade-in-view';
import { NS } from '@/constants/nanisuru-ui';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { LOOP_TEST_RESTORE, loopTestLogOnce } from '@/lib/loop-test-config';
import { getVisualPresetFromSeed } from '@/lib/visual-placeholders';

const MVP_NOTICE = '人気プランや投稿機能は今後アップデート予定です';

type StaticDiscoverCard = {
  id: string;
  title: string;
  destination: string;
  tags: string[];
  category: string;
  emoji: string;
};

const STATIC_IDEAS: StaticDiscoverCard[] = [
  {
    id: 'mvp-korea-food',
    title: '韓国グルメ旅',
    destination: 'ソウル',
    tags: ['グルメ', '韓国'],
    category: 'food',
    emoji: '🍜',
  },
  {
    id: 'mvp-osaka-cafe',
    title: '大阪カフェ巡り',
    destination: '大阪',
    tags: ['カフェ', '散策'],
    category: 'cafe',
    emoji: '☕️',
  },
  {
    id: 'mvp-tokyo-date',
    title: '東京デートプラン',
    destination: '東京',
    tags: ['デート', '定番'],
    category: 'date',
    emoji: '💑',
  },
];

function DiscoverIdeaCard({ item }: { item: StaticDiscoverCard }) {
  const preset = getVisualPresetFromSeed(item.id, item.category);

  return (
    <PremiumCard style={styles.ideaCard}>
      <View
        style={[
          styles.cover,
          {
            backgroundColor: preset.gradientStart,
            borderBottomColor: preset.gradientEnd,
          },
        ]}>
        <Text style={styles.coverEmoji}>{item.emoji}</Text>
      </View>
      <View style={styles.ideaBody}>
        <Text style={styles.ideaTitle}>{item.title}</Text>
        <Text style={styles.ideaDestination}>📍 {item.destination}</Text>
        <View style={styles.tagRow}>
          {item.tags.map((tag) => (
            <View key={`${item.id}-${tag}`} style={styles.tagBadge}>
              <Text style={styles.tagText}>#{tag}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.comingSoon}>詳細は準備中</Text>
      </View>
    </PremiumCard>
  );
}

// MVP static screen only: no Supabase / OpenAI calls, no fetch, no useEffect on mount.
function DiscoverMvpScreen() {
  const insets = useSafeAreaInsets();

  return (
    <ScreenBackground>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + Spacing.four,
            paddingBottom: insets.bottom + BottomTabInset + Spacing.five,
          },
        ]}
        showsVerticalScrollIndicator={false}>
        <FadeInView>
          <Text style={styles.eyebrow}>✨ DISCOVER</Text>
          <Text style={styles.title}>発見</Text>
          <Text style={styles.subtitle}>みんなの旅行アイデアを見つけよう</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>MVP準備中</Text>
          </View>
        </FadeInView>

        <FadeInView delay={60}>
          <Text style={styles.sectionLabel}>旅行アイデア</Text>
          <View style={styles.cardList}>
            {STATIC_IDEAS.map((item) => (
              <DiscoverIdeaCard key={item.id} item={item} />
            ))}
          </View>
        </FadeInView>

        <FadeInView delay={120}>
          <PremiumCard variant="flat" style={styles.noticeCard}>
            <Text style={styles.noticeText}>{MVP_NOTICE}</Text>
          </PremiumCard>
        </FadeInView>
      </ScrollView>
    </ScreenBackground>
  );
}

export default function DiscoverScreen() {
  if (LOOP_TEST_RESTORE.screenExplore) {
    loopTestLogOnce('restore:Discover', 'restoring Discover');
    const DiscoverScreenReal = require('@/archive/loop-test/tabs/explore.real').default;
    return <DiscoverScreenReal />;
  }

  loopTestLogOnce('screen:Discover', 'MVP static discover screen');
  return <DiscoverMvpScreen />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    paddingHorizontal: NS.layout.screenPadding,
    maxWidth: NS.layout.maxWidth,
    width: '100%',
    alignSelf: 'center',
  },
  eyebrow: {
    color: NS.colors.accent,
    ...NS.typography.eyebrow,
    marginBottom: Spacing.two,
  },
  title: {
    color: NS.colors.text,
    ...NS.typography.title,
    marginBottom: Spacing.two,
  },
  subtitle: {
    color: NS.colors.textSecondary,
    ...NS.typography.bodySm,
    marginBottom: Spacing.three,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: NS.colors.warningSoft,
    borderRadius: NS.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    marginBottom: Spacing.five,
  },
  badgeText: {
    color: NS.colors.warning,
    fontSize: 12,
    fontWeight: '700',
  },
  sectionLabel: {
    color: NS.colors.text,
    ...NS.typography.titleSm,
    marginBottom: Spacing.three,
  },
  cardList: {
    gap: Spacing.three,
    marginBottom: Spacing.four,
  },
  ideaCard: {
    overflow: 'hidden',
    padding: 0,
  },
  cover: {
    height: 120,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    padding: Spacing.three,
    borderBottomWidth: 4,
  },
  coverEmoji: {
    fontSize: 32,
  },
  ideaBody: {
    padding: Spacing.three,
    gap: Spacing.one,
  },
  ideaTitle: {
    color: NS.colors.text,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  ideaDestination: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    marginTop: Spacing.one,
  },
  tagBadge: {
    backgroundColor: NS.colors.accentSoft,
    borderRadius: NS.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: {
    color: NS.colors.accent,
    fontSize: 11,
    fontWeight: '800',
  },
  comingSoon: {
    color: NS.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: Spacing.one,
  },
  noticeCard: {
    marginBottom: Spacing.four,
  },
  noticeText: {
    color: NS.colors.textMuted,
    ...NS.typography.bodySm,
    textAlign: 'center',
    lineHeight: 22,
  },
});
