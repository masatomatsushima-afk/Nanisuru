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

import { TripMemoryFolderCard } from '@/components/trip-memory-folder-card';
import { PremiumCard, PrimaryButton } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { fetchPublicTripMemories } from '@/lib/trip-memories';
import type { TripMemory } from '@/types/trip-memory';

type DiscoverTripMemoriesSectionProps = {
  isConfigured: boolean;
  isLoggedIn: boolean;
  onRequireLogin: () => void;
};

export function DiscoverTripMemoriesSection({
  isConfigured,
  isLoggedIn: _isLoggedIn,
  onRequireLogin: _onRequireLogin,
}: DiscoverTripMemoriesSectionProps) {
  const [memories, setMemories] = useState<TripMemory[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadMemories = useCallback(async () => {
    if (!isConfigured) {
      setMemories([]);
      return;
    }

    setIsLoading(true);
    try {
      setMemories(await fetchPublicTripMemories(12));
    } catch {
      setMemories([]);
    } finally {
      setIsLoading(false);
    }
  }, [isConfigured]);

  useEffect(() => {
    void loadMemories();
  }, [loadMemories]);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>📔 MEMORIES</Text>
          <Text style={styles.title}>みんなの思い出</Text>
          <Text style={styles.subtitle}>
            旅のあとに残した写真やメモ。次の旅のヒントにもなります
          </Text>
        </View>
      </View>

      {!isConfigured ? (
        <PremiumCard style={styles.notice}>
          <Text style={styles.noticeText}>
            思い出機能を使うには Supabase の設定が必要です
          </Text>
        </PremiumCard>
      ) : isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={NS.colors.accent} />
        </View>
      ) : memories.length === 0 ? (
        <PremiumCard style={styles.empty}>
          <Text style={styles.emptyEmoji}>✨</Text>
          <Text style={styles.emptyTitle}>公開された思い出はまだありません</Text>
          <Text style={styles.emptyText}>
            あなたの旅の思い出を公開すると、ここに表示されます
          </Text>
          <View style={styles.buttonWrap}>
            <PrimaryButton
              label="思い出アルバムを見る"
              onPress={() => router.push('/memories')}
            />
          </View>
        </PremiumCard>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}>
          {memories.map((memory) => (
            <TripMemoryFolderCard
              key={memory.id}
              memory={memory}
              compact
              onPress={() => router.push(`/memory/${memory.id}`)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: NS.colors.coral,
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: NS.colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: NS.colors.textSecondary,
    lineHeight: 19,
    marginTop: 2,
  },
  scrollContent: {
    gap: Spacing.three,
    paddingRight: Spacing.two,
  },
  loading: {
    paddingVertical: Spacing.five,
    alignItems: 'center',
  },
  notice: {
    padding: Spacing.four,
  },
  noticeText: {
    fontSize: 13,
    color: NS.colors.textSecondary,
  },
  empty: {
    padding: Spacing.five,
    alignItems: 'center',
    gap: Spacing.two,
  },
  emptyEmoji: {
    fontSize: 28,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: NS.colors.text,
  },
  emptyText: {
    fontSize: 13,
    color: NS.colors.textMuted,
    textAlign: 'center',
    lineHeight: 19,
  },
  buttonWrap: {
    alignSelf: 'stretch',
    width: '100%',
    marginTop: Spacing.two,
  },
});
