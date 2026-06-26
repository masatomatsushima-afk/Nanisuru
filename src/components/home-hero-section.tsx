import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FadeInView } from '@/components/ui/fade-in-view';
import { PrimaryButton } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';

type CompactActionCardProps = {
  title: string;
  accentColor: string;
  accentBg: string;
  accentBorder: string;
  onPress: () => void;
  delay?: number;
};

function CompactActionCard({
  title,
  accentColor,
  accentBg,
  accentBorder,
  onPress,
  delay = 0,
}: CompactActionCardProps) {
  return (
    <FadeInView delay={delay}>
      <Pressable
        style={({ pressed }) => [
          styles.compactCard,
          { backgroundColor: accentBg, borderColor: accentBorder },
          pressed && styles.compactCardPressed,
        ]}
        onPress={onPress}>
        <Text style={[styles.compactTitle, { color: accentColor }]}>{title}</Text>
        <Text style={[styles.compactArrow, { color: accentColor }]}>→</Text>
      </Pressable>
    </FadeInView>
  );
}

type HomeHeroSectionProps = {
  onPrimaryPress: () => void;
  onTravelPress?: () => void;
  afterPlanLocation?: string;
};

function isEveningHour(): boolean {
  return new Date().getHours() >= 18;
}

export function HomeHeroSection({
  onPrimaryPress,
  onTravelPress,
  afterPlanLocation,
}: HomeHeroSectionProps) {
  const isEvening = isEveningHour();

  const handleAfterPlan = () => {
    router.push({
      pathname: '/after-plan',
      params: afterPlanLocation?.trim() ? { location: afterPlanLocation.trim() } : {},
    });
  };

  return (
    <View style={styles.wrap}>
      <FadeInView>
        <View style={styles.hero}>
          <Text style={styles.brand}>Nanisuru</Text>
          <Text style={styles.headline}>次、どこ行く？</Text>
          <Text style={styles.subheadline}>
            気分・時間・予算に合わせて、ぴったりの過ごし方を見つけよう
          </Text>

          <View style={styles.primaryCtaWrap}>
            <PrimaryButton
              label="今の気分で探す"
              onPress={onPrimaryPress}
              variant="warm"
            />
          </View>
        </View>
      </FadeInView>

      <View style={styles.compactList}>
        <CompactActionCard
          title="今すぐ出かける"
          accentColor={NS.pop.imafima.accent}
          accentBg={NS.pop.imafima.bg}
          accentBorder={NS.pop.imafima.border}
          onPress={() => router.push('/imafima')}
          delay={60}
        />
        <CompactActionCard
          title="旅行プランを作る"
          accentColor={NS.pop.travel.accent}
          accentBg={NS.pop.travel.bg}
          accentBorder={NS.pop.travel.border}
          onPress={onTravelPress ?? (() => {})}
          delay={90}
        />
        <CompactActionCard
          title="人気プランを見る"
          accentColor={NS.pop.discover.accent}
          accentBg={NS.pop.discover.bg}
          accentBorder={NS.pop.discover.border}
          onPress={() => router.push('/explore')}
          delay={120}
        />
      </View>

      {isEvening ? (
        <FadeInView delay={150}>
          <View style={styles.nightSection}>
            <Text style={styles.nightTitle}>夜、まだ楽しむ？</Text>
            <Pressable
              style={({ pressed }) => [styles.nightButton, pressed && styles.nightButtonPressed]}
              onPress={handleAfterPlan}>
              <Text style={styles.nightButtonText}>2軒目・夜プランを探す</Text>
            </Pressable>
          </View>
        </FadeInView>
      ) : null}

      <Pressable
        style={({ pressed }) => [styles.secondaryLink, pressed && styles.secondaryLinkPressed]}
        onPress={() => router.push('/best-day')}>
        <Text style={styles.secondaryLinkText}>特別な日をつくる</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: Spacing.five,
    gap: Spacing.three,
  },
  hero: {
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  brand: {
    color: NS.colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: Spacing.three,
  },
  headline: {
    color: NS.colors.text,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.8,
    lineHeight: 38,
    marginBottom: Spacing.two,
  },
  subheadline: {
    color: NS.colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 23,
    marginBottom: Spacing.four,
  },
  primaryCtaWrap: {
    alignSelf: 'stretch',
  },
  compactList: {
    gap: Spacing.two,
  },
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: NS.radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.three + 2,
    paddingVertical: Spacing.two + 4,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  compactCardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.995 }],
  },
  compactTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  compactArrow: {
    fontSize: 16,
    fontWeight: '800',
  },
  nightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    backgroundColor: NS.pop.afterPlan.bg,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.pop.afterPlan.border,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  nightTitle: {
    flex: 1,
    color: NS.pop.afterPlan.accent,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.1,
  },
  nightButton: {
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.35)',
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.one + 2,
  },
  nightButtonPressed: {
    opacity: 0.88,
  },
  nightButtonText: {
    color: NS.pop.afterPlan.accent,
    fontSize: 12,
    fontWeight: '800',
  },
  secondaryLink: {
    alignSelf: 'center',
    paddingVertical: Spacing.one,
  },
  secondaryLinkPressed: {
    opacity: 0.7,
  },
  secondaryLinkText: {
    color: NS.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
});
