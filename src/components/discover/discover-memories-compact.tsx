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
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { fetchPublicTripMemories } from '@/lib/trip-memories';
import { safeKey } from '@/lib/safe-text';
import type { TripMemory } from '@/types/trip-memory';

export function DiscoverMemoriesCompact() {
  const [memories, setMemories] = useState<TripMemory[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setMemories(await fetchPublicTripMemories(8));
    } catch {
      setMemories([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (isLoading) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>みんなの思い出</Text>
        <ActivityIndicator color={NS.colors.coral} style={styles.loader} />
      </View>
    );
  }

  if (memories.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>みんなの思い出</Text>
        <Text style={styles.subtitle}>旅のアルバム</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}>
        {memories.map((memory, index) => (
          <Pressable
            key={`${safeKey(memory.id, `memory-${index}`)}-${index}`}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            onPress={() => router.push(`/memory/${memory.id}`)}>
            <VisualCover
              height={96}
              imageUrl={memory.coverImageUrl}
              theme="memory"
              seed={memory.id}
              overlay="bottom"
              showEmoji={!memory.coverImageUrl}
              borderRadius={NS.radius.md}
              style={styles.cover}>
              <Text style={styles.coverTitle} numberOfLines={2}>
                {memory.title || memory.destination}
              </Text>
            </VisualCover>
            <Text style={styles.memoryMeta} numberOfLines={1}>
              📍 {memory.destination}
            </Text>
            {memory.dateLabel ? (
              <Text style={styles.date} numberOfLines={1}>
                {memory.dateLabel}
              </Text>
            ) : null}
            <Text style={styles.stats}>
              ♥ {memory.likeCount} · 💬 {memory.commentCount}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.two,
  },
  header: {
    paddingHorizontal: Spacing.one,
    gap: 2,
  },
  title: {
    color: NS.colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  subtitle: {
    color: NS.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  loader: {
    paddingVertical: Spacing.two,
  },
  scroll: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.one,
  },
  card: {
    width: 132,
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.lg,
    borderWidth: 1,
    borderColor: NS.colors.border,
    padding: Spacing.one + 2,
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
  coverTitle: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    lineHeight: 14,
    textShadowColor: 'rgba(15, 23, 42, 0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  memoryMeta: {
    fontSize: 10,
    fontWeight: '700',
    color: NS.colors.textSecondary,
  },
  date: {
    fontSize: 9,
    color: NS.colors.textMuted,
    fontWeight: '600',
  },
  stats: {
    fontSize: 9,
    fontWeight: '700',
    color: NS.colors.textMuted,
  },
});
