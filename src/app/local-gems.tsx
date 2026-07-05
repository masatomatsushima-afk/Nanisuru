import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LocalGemCard } from '@/components/local-gem-card';
import { LifestyleSectionHeader } from '@/components/ui/lifestyle-section-header';
import { PrimaryButton } from '@/components/ui/premium-card';
import { ScreenBackground } from '@/components/ui/screen-background';
import { NS } from '@/constants/nanisuru-ui';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useUserLocation } from '@/contexts/user-location-context';
import { loadLocalGemsFeed, type LocalGemsFeedResult } from '@/lib/local-gems-feed';
import type { LocalGemsFeedSection } from '@/types/local-hidden-spot';

export default function LocalGemsScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { location, fetchLocation } = useUserLocation();
  const areaHint = location?.city ?? location?.label;

  const [feed, setFeed] = useState<LocalGemsFeedResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setIsRefreshing(true);
      else setIsLoading(true);
      try {
        setFeed(await loadLocalGemsFeed(areaHint));
      } catch {
        setFeed(null);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [areaHint],
  );

  useFocusEffect(
    useCallback(() => {
      void fetchLocation();
      void load();
    }, [fetchLocation, load]),
  );

  const openDetail = (spotId: string) => {
    router.push(`/local-spot/${spotId}`);
  };

  const renderSection = (section: LocalGemsFeedSection) => (
    <View key={section.id} style={styles.section}>
      <LifestyleSectionHeader title={section.title} />
      <View style={styles.grid}>
        {section.spots.map((spot) => (
          <LocalGemCard
            key={spot.id}
            spot={spot}
            isLoggedIn={Boolean(session)}
            onPress={() => openDetail(spot.id)}
            onRequireLogin={() => router.push('/login')}
          />
        ))}
      </View>
    </View>
  );

  return (
    <ScreenBackground>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + Spacing.three,
            paddingBottom: insets.bottom + BottomTabInset + Spacing.five,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void load(true)}
            tintColor={NS.colors.accent}
          />
        }>
        <Text style={styles.screenTitle}>ローカルの穴場</Text>
        <Text style={styles.screenSubtitle}>地元の人だけが知る、特別なスポット</Text>

        <PrimaryButton
          label="穴場を投稿"
          onPress={() => {
            if (!session) router.push('/login');
            else router.push('/local-spot/submit');
          }}
          variant="mint"
        />

        {feed?.fromMock ? (
          <View style={styles.mockNotice}>
            <Text style={styles.mockNoticeText}>
              サンプルデータを表示しています。穴場を投稿すると、ここに表示されます。
            </Text>
          </View>
        ) : null}

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={NS.colors.accent} />
            <Text style={styles.loadingText}>読み込み中...</Text>
          </View>
        ) : feed?.sections.length ? (
          feed.sections.map(renderSection)
        ) : (
          <Text style={styles.empty}>まだ穴場がありません。最初の投稿者になりましょう。</Text>
        )}
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  content: {
    paddingHorizontal: NS.layout.screenPadding,
    maxWidth: NS.layout.maxWidth,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.three,
  },
  screenTitle: {
    color: NS.colors.text,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  screenSubtitle: {
    color: NS.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginTop: -Spacing.one,
  },
  mockNotice: {
    backgroundColor: NS.colors.yellowSoft,
    borderRadius: NS.radius.lg,
    padding: Spacing.three,
  },
  mockNoticeText: {
    color: NS.colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.six,
    gap: Spacing.two,
  },
  loadingText: { color: NS.colors.textSecondary, fontSize: 13 },
  section: { gap: Spacing.two },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  empty: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: Spacing.four,
  },
});
