import { Pressable, StyleSheet, Text, View } from 'react-native';

import { VisualCover } from '@/components/ui/visual-cover';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import type { TripMemory } from '@/types/trip-memory';

type ProfileMemoryGridCardProps = {
  memory: TripMemory;
  onPress: () => void;
};

export function ProfileMemoryGridCard({ memory, onPress }: ProfileMemoryGridCardProps) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <VisualCover
        height={132}
        imageUrl={memory.coverImageUrl}
        theme="memory"
        seed={memory.id}
        overlay="bottom"
        showEmoji={!memory.coverImageUrl}
        borderRadius={NS.lifestyle.tileRadius}>
        <Text style={styles.overlayTitle} numberOfLines={2}>
          {memory.title || memory.destination}
        </Text>
      </VisualCover>
      <View style={styles.body}>
        <Text style={styles.destination} numberOfLines={1}>
          📍 {memory.destination}
        </Text>
        {memory.dateLabel ? (
          <Text style={styles.date} numberOfLines={1}>
            {memory.dateLabel}
          </Text>
        ) : null}
        <View style={styles.statsRow}>
          <Text style={styles.stat}>♥ {memory.likeCount}</Text>
          <Text style={styles.stat}>💬 {memory.commentCount}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '47%',
    maxWidth: '48%',
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.lifestyle.tileRadius,
    overflow: 'hidden',
    ...NS.shadow.cardLg,
    shadowOpacity: 0.1,
  },
  overlayTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 16,
    textShadowColor: 'rgba(15, 23, 42, 0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  body: {
    padding: Spacing.two,
    gap: 3,
  },
  destination: {
    fontSize: 11,
    fontWeight: '700',
    color: NS.colors.textSecondary,
  },
  date: {
    fontSize: 10,
    color: NS.colors.textMuted,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  stat: {
    fontSize: 10,
    fontWeight: '700',
    color: NS.colors.textMuted,
  },
});
