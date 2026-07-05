import { Pressable, StyleSheet, Text, View } from 'react-native';

import { VisualCover } from '@/components/ui/visual-cover';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import type { TripMemory } from '@/types/trip-memory';

type ProfileMemoryGridCardProps = {
  memory: TripMemory;
  onPress: () => void;
};

function getShortNote(memory: TripMemory): string {
  if (memory.summary?.trim()) return memory.summary.trim();
  if (memory.aiSummary?.oneLineSummary?.trim()) return memory.aiSummary.oneLineSummary.trim();
  if (memory.favoriteMoments[0]?.trim()) return memory.favoriteMoments[0].trim();
  return '旅の思い出';
}

export function ProfileMemoryGridCard({ memory, onPress }: ProfileMemoryGridCardProps) {
  const shortNote = getShortNote(memory);

  return (
    <View style={styles.card}>
      <Pressable onPress={onPress}>
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
          <Text style={styles.note} numberOfLines={2}>
            {shortNote}
          </Text>
        </View>
      </Pressable>
      <Pressable style={styles.viewBtn} onPress={onPress}>
        <Text style={styles.viewBtnText}>思い出を見る</Text>
      </Pressable>
    </View>
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
    gap: 4,
  },
  destination: {
    fontSize: 11,
    fontWeight: '700',
    color: NS.colors.textSecondary,
  },
  note: {
    fontSize: 11,
    color: NS.colors.textMuted,
    lineHeight: 15,
  },
  viewBtn: {
    marginHorizontal: Spacing.two,
    marginBottom: Spacing.two,
    backgroundColor: NS.colors.coralSoft,
    borderRadius: NS.radius.md,
    paddingVertical: Spacing.one + 2,
    alignItems: 'center',
  },
  viewBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: NS.colors.coral,
  },
});
