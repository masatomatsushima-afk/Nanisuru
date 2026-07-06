import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { LocalGemCard } from '@/components/local-gem-card';
import { PrimaryButton } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { loadLocalGemsFeed } from '@/lib/local-gems-feed';
import type { LocalHiddenSpot } from '@/types/local-hidden-spot';

type DiscoverLocalCompactProps = {
  isConfigured: boolean;
  isLoggedIn: boolean;
  areaHint?: string;
  onRequireLogin: () => void;
};

export function DiscoverLocalCompact({
  isConfigured,
  isLoggedIn,
  areaHint,
  onRequireLogin,
}: DiscoverLocalCompactProps) {
  const [spots, setSpots] = useState<LocalHiddenSpot[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadSpots = useCallback(async () => {
    setIsLoading(true);
    try {
      const feed = await loadLocalGemsFeed(areaHint);
      const popular = feed.sections.find((section) => section.id === 'popular');
      setSpots((popular?.spots ?? feed.spots).slice(0, 6));
    } catch {
      setSpots([]);
    } finally {
      setIsLoading(false);
    }
  }, [areaHint]);

  useEffect(() => {
    void loadSpots();
  }, [loadSpots]);

  const handleSubmit = () => {
    if (!isLoggedIn) {
      onRequireLogin();
      return;
    }
    router.push('/local-spot/submit');
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>ローカルの穴場</Text>
        <Pressable onPress={() => router.push('/local-gems')} hitSlop={8}>
          <Text style={styles.link}>すべて見る</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator color={NS.colors.mint} style={styles.loader} />
      ) : spots.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>まだ穴場がありません</Text>
          <PrimaryButton label="穴場を投稿する" onPress={handleSubmit} variant="mint" />
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scroll}>
          {spots.map((spot, index) => (
            <View key={`${spot.id}-${index}`} style={styles.cardWrap}>
              <LocalGemCard
                spot={spot}
                isLoggedIn={isLoggedIn}
                layout="carousel"
                onPress={() => router.push(`/local-spot/${spot.id}`)}
                onRequireLogin={onRequireLogin}
              />
            </View>
          ))}
        </ScrollView>
      )}

      <PrimaryButton label="穴場を投稿" onPress={handleSubmit} variant="secondary" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.one,
  },
  title: {
    color: NS.colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  link: {
    color: NS.colors.mint,
    fontSize: 12,
    fontWeight: '800',
  },
  loader: {
    paddingVertical: Spacing.three,
  },
  scroll: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.one,
  },
  cardWrap: {
    width: 168,
  },
  empty: {
    alignItems: 'center',
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.lg,
    borderWidth: 1,
    borderColor: NS.colors.border,
    padding: Spacing.three,
    gap: Spacing.two,
    marginHorizontal: Spacing.one,
  },
  emptyTitle: {
    color: NS.colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
});
