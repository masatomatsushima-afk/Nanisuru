import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
      <View style={styles.coverWrap}>
        {memory.coverImageUrl ? (
          <Image source={{ uri: memory.coverImageUrl }} style={styles.cover} contentFit="cover" />
        ) : (
          <View style={styles.coverPlaceholder}>
            <Text style={styles.coverEmoji}>📸</Text>
          </View>
        )}
        <View style={styles.overlay}>
          <Text style={styles.overlayTitle} numberOfLines={2}>
            {memory.title || memory.destination}
          </Text>
        </View>
      </View>
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
    borderRadius: NS.radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: NS.colors.border,
    ...NS.shadow.card,
  },
  coverWrap: {
    height: 150,
    position: 'relative',
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    flex: 1,
    backgroundColor: NS.colors.coralSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverEmoji: {
    fontSize: 28,
  },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: Spacing.two,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  overlayTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 16,
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
