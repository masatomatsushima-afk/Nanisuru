import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import type { TripMemory } from '@/types/trip-memory';

type TripMemoryFolderCardProps = {
  memory: TripMemory;
  onPress: () => void;
  compact?: boolean;
};

export function TripMemoryFolderCard({ memory, onPress, compact }: TripMemoryFolderCardProps) {
  const photoCount = memory.coverImageUrl ? 1 : 0;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, compact && styles.cardCompact, pressed && styles.cardPressed]}
      onPress={onPress}>
      <View style={[styles.coverWrap, compact && styles.coverWrapCompact]}>
        {memory.coverImageUrl ? (
          <Image source={{ uri: memory.coverImageUrl }} style={styles.coverImage} contentFit="cover" />
        ) : (
          <View style={styles.coverPlaceholder}>
            <Text style={styles.coverEmoji}>📸</Text>
          </View>
        )}
        <View style={styles.coverOverlay} />
        <View style={styles.tagRow}>
          <View style={[styles.tag, styles.tagSky]}>
            <Text style={styles.tagText}>{memory.companion || '旅'}</Text>
          </View>
        </View>
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {memory.title || memory.destination}
        </Text>
        <Text style={styles.destination} numberOfLines={1}>
          📍 {memory.destination}
        </Text>
        {memory.dateLabel ? (
          <Text style={styles.meta} numberOfLines={1}>
            {memory.dateLabel}
            {memory.durationLabel ? ` · ${memory.durationLabel}` : ''}
          </Text>
        ) : null}
        {memory.summary ? (
          <Text style={styles.summary} numberOfLines={2}>
            {memory.summary}
          </Text>
        ) : (
          <Text style={styles.summaryMuted}>
            {photoCount > 0 ? '思い出を記録中 ✨' : '写真やメモを追加してみよう'}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: NS.colors.border,
    ...NS.shadow.card,
  },
  cardCompact: {
    width: 168,
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  coverWrap: {
    height: 140,
    position: 'relative',
  },
  coverWrapCompact: {
    height: 110,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    flex: 1,
    backgroundColor: NS.colors.yellowSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverEmoji: {
    fontSize: 36,
  },
  coverOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.08)',
  },
  tagRow: {
    position: 'absolute',
    left: Spacing.two,
    bottom: Spacing.two,
    flexDirection: 'row',
    gap: Spacing.one,
  },
  tag: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: NS.radius.pill,
  },
  tagSky: {
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  tagText: {
    fontSize: 11,
    fontWeight: '700',
    color: NS.colors.accent,
  },
  body: {
    padding: Spacing.three,
    gap: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: NS.colors.text,
    lineHeight: 20,
  },
  destination: {
    fontSize: 12,
    color: NS.colors.textSecondary,
    fontWeight: '600',
  },
  meta: {
    fontSize: 11,
    color: NS.colors.textMuted,
  },
  summary: {
    fontSize: 12,
    color: NS.colors.textSecondary,
    lineHeight: 17,
    marginTop: 2,
  },
  summaryMuted: {
    fontSize: 12,
    color: NS.colors.textMuted,
    marginTop: 2,
  },
});
