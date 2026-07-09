import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PremiumCard } from '@/components/ui/premium-card';
import { ScreenBackground } from '@/components/ui/screen-background';
import { FadeInView } from '@/components/ui/fade-in-view';
import { EmptyStateCard } from '@/components/ui/state-cards';
import { NS } from '@/constants/nanisuru-ui';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { LOOP_TEST_RESTORE, loopTestLogOnce } from '@/lib/loop-test-config';

const EMPTY_TITLE = 'まだ保存されたプランはありません';
const EMPTY_DESCRIPTION =
  '旅行プランを作成すると、ここから見返せるようになります';
const MVP_NOTICE =
  'クラウド保存は今後アップデート予定です。今は旅行プラン作成を優先しています。';

// MVP static screen only: no Supabase / OpenAI calls, no fetch, no useEffect on mount.
function SavedTripsMvpScreen() {
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
          <Text style={styles.eyebrow}>📌 SAVED PLANS</Text>
          <Text style={styles.title}>保存済み</Text>
          <Text style={styles.subtitle}>作成した旅行プランをここに保存できます</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>MVP準備中</Text>
          </View>
        </FadeInView>

        <FadeInView delay={60}>
          <EmptyStateCard
            icon="🗺️"
            title={EMPTY_TITLE}
            description={EMPTY_DESCRIPTION}
            actionLabel="プランを作る"
            onAction={() => router.push('/(tabs)')}
            variant="flat"
          />
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

export default function SavedTripsScreen() {
  if (LOOP_TEST_RESTORE.savedTripsReal) {
    loopTestLogOnce('restore:Favorites', 'restoring saved trips real screen');
    const FavoritesScreenReal = require('@/archive/loop-test/tabs/favorites.real').default;
    return <FavoritesScreenReal />;
  }

  loopTestLogOnce('screen:Favorites', 'MVP static saved trips screen');
  return <SavedTripsMvpScreen />;
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
  noticeCard: {
    marginTop: Spacing.four,
    marginBottom: Spacing.four,
  },
  noticeText: {
    color: NS.colors.textMuted,
    ...NS.typography.bodySm,
    textAlign: 'center',
    lineHeight: 22,
  },
});
