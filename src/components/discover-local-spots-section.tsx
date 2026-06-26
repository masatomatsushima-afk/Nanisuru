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

import { LocalHiddenSpotCard } from '@/components/local-hidden-spot-card';
import { PremiumCard, PrimaryButton } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { fetchLocalHiddenSpots } from '@/lib/local-hidden-spots';
import type { LocalHiddenSpot } from '@/types/local-hidden-spot';

type DiscoverLocalSpotsSectionProps = {
  isConfigured: boolean;
  isLoggedIn: boolean;
  areaHint?: string;
  onRequireLogin: () => void;
};

export function DiscoverLocalSpotsSection({
  isConfigured,
  isLoggedIn,
  areaHint,
  onRequireLogin,
}: DiscoverLocalSpotsSectionProps) {
  const [spots, setSpots] = useState<LocalHiddenSpot[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadSpots = useCallback(async () => {
    if (!isConfigured) {
      setSpots([]);
      return;
    }

    setIsLoading(true);
    try {
      setSpots(await fetchLocalHiddenSpots({ area: areaHint, limit: 12 }));
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
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>🗺 LOCAL PICKS</Text>
          <Text style={styles.title}>ローカルの穴場</Text>
          <Text style={styles.subtitle}>
            地元の人が教えてくれる、観光ガイドに載らないスポット
          </Text>
        </View>
        <Pressable style={styles.submitLink} onPress={handleSubmit}>
          <Text style={styles.submitLinkText}>＋ 投稿</Text>
        </Pressable>
      </View>

      {!isConfigured ? (
        <PremiumCard style={styles.notice}>
          <Text style={styles.noticeText}>
            Supabase に local_hidden_spots.sql を実行すると、穴場投稿が使えます。
          </Text>
        </PremiumCard>
      ) : isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={NS.colors.accent} />
        </View>
      ) : spots.length === 0 ? (
        <PremiumCard style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>🌿</Text>
          <Text style={styles.emptyTitle}>まだ穴場がありません</Text>
          <Text style={styles.emptyText}>
            あなたの知っているおすすめスポットを最初に投稿してみませんか？
          </Text>
          <View style={styles.buttonWrap}>
            <PrimaryButton label="穴場を投稿する" onPress={handleSubmit} />
          </View>
        </PremiumCard>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carousel}>
          {spots.map((spot, index) => (
            <LocalHiddenSpotCard
              key={spot.id}
              spot={spot}
              index={index}
              compact
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
    marginBottom: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  headerText: {
    flex: 1,
  },
  eyebrow: {
    color: NS.colors.mint,
    ...NS.typography.eyebrow,
    marginBottom: Spacing.one,
  },
  title: {
    color: NS.colors.text,
    ...NS.typography.headline,
    marginBottom: 4,
  },
  subtitle: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  submitLink: {
    backgroundColor: NS.colors.mintSoft,
    borderRadius: NS.radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderWidth: 1,
    borderColor: NS.colors.mint,
  },
  submitLinkText: {
    color: '#047857',
    fontSize: 12,
    fontWeight: '800',
  },
  carousel: {
    paddingRight: Spacing.four,
  },
  loadingWrap: {
    paddingVertical: Spacing.five,
    alignItems: 'center',
  },
  notice: {
    padding: Spacing.three,
  },
  noticeText: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  emptyCard: {
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
  },
  emptyIcon: {
    fontSize: 36,
  },
  emptyTitle: {
    color: NS.colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  emptyText: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: Spacing.two,
  },
  buttonWrap: {
    alignSelf: 'stretch',
    width: '100%',
  },
});
