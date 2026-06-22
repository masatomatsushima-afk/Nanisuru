import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FadeInView } from '@/components/ui/fade-in-view';
import { PremiumCard } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { BottomTabInset, Spacing } from '@/constants/theme';

const CATEGORIES = [
  {
    emoji: '💑',
    title: 'デートプラン',
    description: 'ふたりの時間を特別に。会話もスムーズに。',
    tag: 'カップル',
  },
  {
    emoji: '🍜',
    title: 'グルメ巡り',
    description: '食べ歩きで満喫する、週末のご褒美。',
    tag: 'グルメ',
  },
  {
    emoji: '🌿',
    title: 'のんびり休日',
    description: 'カフェと散歩で、心を整える1日。',
    tag: 'のんびり',
  },
  {
    emoji: '📸',
    title: '映えスポット',
    description: '写真映えする場所を厳選して巡る。',
    tag: '映え重視',
  },
] as const;

const INSPIRATIONS = [
  { area: '渋谷', plan: 'カフェ → ショッピング → 夜景バー', mood: '初デート向け' },
  { area: '京都', plan: '朝の散歩 → ランチ → 寺社巡り', mood: 'のんびり' },
  { area: '大阪', plan: '道頓堀グルメ → 梅田スカイライン', mood: 'グルメ' },
] as const;

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();

  return (
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
        <View style={styles.heroGlow} />
        <Text style={styles.eyebrow}>DISCOVER</Text>
        <Text style={styles.title}>発見</Text>
        <Text style={styles.subtitle}>Nanisuruが提案する、お出かけのインスピレーション</Text>
      </FadeInView>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>カテゴリー</Text>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((category, index) => (
            <Animated.View
              key={category.title}
              entering={FadeInDown.delay(index * 70).duration(450).springify()}>
              <Pressable
                style={({ pressed }) => [styles.categoryCard, pressed && styles.pressed]}
                onPress={() => router.push('/')}>
                <View style={styles.categoryIconWrap}>
                  <Text style={styles.categoryEmoji}>{category.emoji}</Text>
                </View>
                <Text style={styles.categoryTitle}>{category.title}</Text>
                <Text style={styles.categoryDescription}>{category.description}</Text>
                <View style={styles.categoryTag}>
                  <Text style={styles.categoryTagText}>{category.tag}</Text>
                </View>
              </Pressable>
            </Animated.View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>人気エリアの1日</Text>
        <View style={styles.inspirationList}>
          {INSPIRATIONS.map((item, index) => (
            <FadeInView key={item.area} delay={index * 80} direction="down">
              <PremiumCard variant="flat" style={styles.inspirationCard}>
                <View style={styles.inspirationHeader}>
                  <Text style={styles.inspirationArea}>{item.area}</Text>
                  <View style={styles.inspirationBadge}>
                    <Text style={styles.inspirationBadgeText}>{item.mood}</Text>
                  </View>
                </View>
                <Text style={styles.inspirationPlan}>{item.plan}</Text>
              </PremiumCard>
            </FadeInView>
          ))}
        </View>
      </View>

      <FadeInView delay={200}>
        <PremiumCard variant="accent" style={styles.ctaCard} onPress={() => router.push('/')}>
          <Text style={styles.ctaTitle}>あなただけのプランを作る</Text>
          <Text style={styles.ctaText}>ホーム画面で条件を入力すると、AIが1日を提案します。</Text>
          <Text style={styles.ctaLink}>プランを生成 →</Text>
        </PremiumCard>
      </FadeInView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NS.colors.bg,
  },
  content: {
    paddingHorizontal: NS.layout.screenPadding,
    maxWidth: NS.layout.maxWidth,
    width: '100%',
    alignSelf: 'center',
  },
  heroGlow: {
    position: 'absolute',
    top: -20,
    left: -20,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: NS.colors.accentGlow,
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
    marginBottom: Spacing.five,
    maxWidth: 320,
  },
  section: {
    marginBottom: Spacing.five,
  },
  sectionTitle: {
    color: NS.colors.text,
    ...NS.typography.headline,
    marginBottom: Spacing.three,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: Spacing.two,
  },
  categoryCard: {
    width: '48%',
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.lg,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: NS.colors.border,
    minHeight: 168,
    ...NS.shadow.card,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  categoryIconWrap: {
    width: 44,
    height: 44,
    borderRadius: NS.radius.sm + 2,
    backgroundColor: NS.colors.accentSoft,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  categoryEmoji: {
    fontSize: 22,
  },
  categoryTitle: {
    color: NS.colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  categoryDescription: {
    color: NS.colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  categoryTag: {
    alignSelf: 'flex-start',
    marginTop: Spacing.two,
    backgroundColor: NS.colors.accentSoft,
    borderRadius: NS.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
  },
  categoryTagText: {
    color: NS.colors.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  inspirationList: {
    gap: Spacing.two,
  },
  inspirationCard: {
    padding: Spacing.three + 2,
  },
  inspirationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.two,
  },
  inspirationArea: {
    color: NS.colors.text,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  inspirationBadge: {
    backgroundColor: NS.colors.accentSoft,
    borderRadius: NS.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
  },
  inspirationBadgeText: {
    color: NS.colors.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  inspirationPlan: {
    color: NS.colors.textSecondary,
    ...NS.typography.bodySm,
  },
  ctaCard: {
    padding: Spacing.four,
    marginBottom: Spacing.two,
  },
  ctaTitle: {
    color: NS.colors.text,
    ...NS.typography.titleSm,
    marginBottom: Spacing.two,
  },
  ctaText: {
    color: NS.colors.textSecondary,
    ...NS.typography.bodySm,
    marginBottom: Spacing.three,
  },
  ctaLink: {
    color: NS.colors.accent,
    fontSize: 15,
    fontWeight: '700',
  },
});
