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

import { VisualCover } from '@/components/ui/visual-cover';
import { PrimaryButton } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { fetchLocalHiddenSpots } from '@/lib/local-hidden-spots';
import type { LocalHiddenSpot } from '@/types/local-hidden-spot';

type DiscoverLocalCompactProps = {
  isConfigured: boolean;
  isLoggedIn: boolean;
  areaHint?: string;
  onRequireLogin: () => void;
};

function SpotMiniCard({
  spot,
  onPress,
}: {
  spot: LocalHiddenSpot;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}>
      <VisualCover
        height={78}
        imageUrl={spot.imageUrl}
        category={spot.category}
        seed={spot.id}
        theme="local"
        overlay="bottom"
        showEmoji={!spot.imageUrl}
        borderRadius={NS.radius.md}
        style={styles.cover}
      />
      <Text style={styles.spotName} numberOfLines={1}>
        {spot.name}
      </Text>
      <Text style={styles.spotArea} numberOfLines={1}>
        📍 {spot.area}
      </Text>
      <View style={styles.tagRow}>
        <View style={styles.tag}>
          <Text style={styles.tagText}>{spot.category}</Text>
        </View>
        {spot.tags[0] ? (
          <View style={styles.tag}>
            <Text style={styles.tagText}>{spot.tags[0]}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.stats}>
        ♥ {spot.likeCount} · 📌 {spot.saveCount}
      </Text>
    </Pressable>
  );
}

export function DiscoverLocalCompact({
  isConfigured,
  isLoggedIn,
  areaHint,
  onRequireLogin,
}: DiscoverLocalCompactProps) {
  const [spots, setSpots] = useState<LocalHiddenSpot[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadSpots = useCallback(async () => {
    if (!isConfigured) {
      setSpots([]);
      return;
    }
    setIsLoading(true);
    try {
      setSpots(await fetchLocalHiddenSpots({ area: areaHint, limit: 8 }));
    } catch {
      setSpots([]);
    } finally {
      setIsLoading(false);
    }
  }, [areaHint, isConfigured]);

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
        <Pressable onPress={handleSubmit} hitSlop={8}>
          <Text style={styles.link}>＋ 投稿</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator color={NS.colors.mint} style={styles.loader} />
      ) : spots.length === 0 ? (
        <View style={styles.empty}>
          <VisualCover
            height={96}
            theme="local"
            overlay="full"
            showEmoji={false}
            borderRadius={NS.radius.lg}
            style={styles.emptyCover}>
            <Text style={styles.emptyCoverText}>地元のおすすめを見つけよう</Text>
          </VisualCover>
          <Text style={styles.emptyTitle}>まだ穴場がありません</Text>
          <PrimaryButton label="穴場を投稿する" onPress={handleSubmit} variant="mint" />
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scroll}>
          {spots.map((spot) => (
            <SpotMiniCard
              key={spot.id}
              spot={spot}
              onPress={() => router.push(`/local-spot/${spot.id}`)}
            />
          ))}
        </ScrollView>
      )}
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
  card: {
    width: 148,
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.lg,
    borderWidth: 1,
    borderColor: NS.colors.border,
    padding: Spacing.two,
    gap: 4,
    ...NS.shadow.card,
    shadowOpacity: 0.06,
  },
  cardPressed: {
    opacity: 0.92,
  },
  cover: {
    marginBottom: 2,
  },
  spotName: {
    fontSize: 13,
    fontWeight: '900',
    color: NS.colors.text,
  },
  spotArea: {
    fontSize: 10,
    color: NS.colors.textSecondary,
    fontWeight: '600',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  tag: {
    backgroundColor: NS.colors.mintSoft,
    borderRadius: NS.radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#047857',
  },
  stats: {
    fontSize: 9,
    fontWeight: '700',
    color: NS.colors.textMuted,
    marginTop: 2,
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
  emptyCover: {
    alignSelf: 'stretch',
  },
  emptyCoverText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptyTitle: {
    color: NS.colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
});
