import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FadeInView } from '@/components/ui/fade-in-view';
import { PremiumCard, PrimaryButton } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { BottomTabInset, Spacing } from '@/constants/theme';
import {
  deleteFavorite,
  favoriteToPlanParams,
  formatFavoriteDate,
  getFavorites,
} from '@/lib/favorites-storage';
import type { SavedFavorite } from '@/types/plan';

function FavoriteCard({
  favorite,
  onOpen,
  onDelete,
}: {
  favorite: SavedFavorite;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <PremiumCard style={styles.favoriteCard}>
      <Pressable style={({ pressed }) => pressed && styles.cardPressed} onPress={onOpen}>
        <View style={styles.favoriteHeader}>
          <View style={styles.favoriteHeaderText}>
            <Text style={styles.favoriteTitle} numberOfLines={2}>
              {favorite.title}
            </Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaIcon}>📍</Text>
              <Text style={styles.metaText}>{favorite.location}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaIcon}>📅</Text>
              <Text style={styles.metaText}>{formatFavoriteDate(favorite.createdAt)}</Text>
            </View>
          </View>
          <Pressable
            style={({ pressed }) => [styles.deleteButton, pressed && styles.deleteButtonPressed]}
            onPress={onDelete}
            hitSlop={8}>
            <Text style={styles.deleteButtonText}>削除</Text>
          </Pressable>
        </View>
        <View style={styles.favoriteFooter}>
          <View style={styles.tag}>
            <Text style={styles.tagText}>{favorite.personality}</Text>
          </View>
          <View style={styles.tag}>
            <Text style={styles.tagText}>{favorite.companion}</Text>
          </View>
          {favorite.tripDuration ? (
            <View style={styles.tagMuted}>
              <Text style={styles.tagMutedText}>{favorite.tripDuration}</Text>
            </View>
          ) : null}
          <Text style={styles.openHint}>タップして開く →</Text>
        </View>
      </Pressable>
    </PremiumCard>
  );
}

function EmptyState() {
  return (
    <FadeInView>
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>♡</Text>
        <Text style={styles.emptyTitle}>保存したプランはまだありません</Text>
        <Text style={styles.emptyText}>
          ホームでプランを生成し、「お気に入りに保存」から追加できます。
        </Text>
        <PrimaryButton label="プランを作る" onPress={() => router.push('/')} />
      </View>
    </FadeInView>
  );
}

export default function FavoritesScreen() {
  const insets = useSafeAreaInsets();
  const [favorites, setFavorites] = useState<SavedFavorite[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadFavorites = useCallback(async () => {
    setIsLoading(true);
    try {
      setFavorites(await getFavorites());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadFavorites();
    }, [loadFavorites]),
  );

  const handleOpen = (favorite: SavedFavorite) => {
    router.push({
      pathname: '/plan-detail',
      params: favoriteToPlanParams(favorite),
    });
  };

  const handleDelete = (favorite: SavedFavorite) => {
    Alert.alert('お気に入りを削除', `「${favorite.title}」を削除しますか？`, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          await deleteFavorite(favorite.id);
          await loadFavorites();
        },
      },
    ]);
  };

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
        <Text style={styles.eyebrow}>SAVED</Text>
        <Text style={styles.title}>お気に入り</Text>
        <Text style={styles.subtitle}>保存したプランをいつでも見返せます</Text>
      </FadeInView>

      {isLoading ? (
        <Text style={styles.loadingText}>読み込み中...</Text>
      ) : favorites.length === 0 ? (
        <EmptyState />
      ) : (
        <View style={styles.list}>
          {favorites.map((favorite, index) => (
            <FadeInView key={favorite.id} delay={index * 60} direction="down">
              <FavoriteCard
                favorite={favorite}
                onOpen={() => handleOpen(favorite)}
                onDelete={() => handleDelete(favorite)}
              />
            </FadeInView>
          ))}
        </View>
      )}
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
  },
  loadingText: {
    color: NS.colors.textSecondary,
    ...NS.typography.bodySm,
    textAlign: 'center',
    marginTop: Spacing.five,
  },
  list: {
    gap: Spacing.three,
  },
  favoriteCard: {
    padding: 0,
    overflow: 'hidden',
  },
  cardPressed: {
    opacity: 0.92,
  },
  favoriteHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    padding: Spacing.four,
    paddingBottom: 0,
  },
  favoriteHeaderText: {
    flex: 1,
    gap: Spacing.two,
  },
  favoriteTitle: {
    color: NS.colors.text,
    ...NS.typography.titleSm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  metaIcon: {
    fontSize: 14,
  },
  metaText: {
    color: NS.colors.textSecondary,
    ...NS.typography.bodySm,
    flex: 1,
  },
  deleteButton: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: NS.radius.sm,
    backgroundColor: NS.colors.dangerSoft,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.2)',
  },
  deleteButtonPressed: {
    opacity: 0.8,
  },
  deleteButtonText: {
    color: NS.colors.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  favoriteFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.three,
    paddingTop: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    borderTopWidth: 1,
    borderTopColor: NS.colors.border,
  },
  tag: {
    backgroundColor: NS.colors.accentSoft,
    borderRadius: NS.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
  },
  tagText: {
    color: NS.colors.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  tagMuted: {
    backgroundColor: NS.colors.bgCard,
    borderRadius: NS.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: NS.colors.border,
  },
  tagMutedText: {
    color: NS.colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  openHint: {
    color: NS.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 'auto',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.six,
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
  },
  emptyIcon: {
    fontSize: 48,
    color: NS.colors.accent,
    marginBottom: Spacing.two,
  },
  emptyTitle: {
    color: NS.colors.text,
    ...NS.typography.headline,
    textAlign: 'center',
  },
  emptyText: {
    color: NS.colors.textSecondary,
    ...NS.typography.bodySm,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.two,
  },
});
