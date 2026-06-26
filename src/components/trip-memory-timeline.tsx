import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import type { ItineraryMemorySlot, TripMemoryMedia } from '@/types/trip-memory';

type TimelineGroup = {
  key: string;
  label: string;
  sublabel?: string;
  items: TripMemoryMedia[];
};

function buildTimelineGroups(
  media: TripMemoryMedia[],
  itinerarySlots: ItineraryMemorySlot[],
): TimelineGroup[] {
  const groups: TimelineGroup[] = [];
  const generalItems: TripMemoryMedia[] = [];

  for (const slot of itinerarySlots) {
    const key = `${slot.dayNumber}-${slot.time}-${slot.activity}`;
    const items = media.filter(
      (item) =>
        item.itineraryDayNumber === slot.dayNumber &&
        item.itineraryItemTime === slot.time &&
        item.itineraryItemActivity === slot.activity,
    );
    if (items.length > 0) {
      groups.push({
        key,
        label: `${slot.time} ${slot.activity}`,
        sublabel: slot.placeName,
        items,
      });
    }
  }

  for (const item of media) {
    if (!item.itineraryItemTime && !item.itineraryItemActivity) {
      generalItems.push(item);
      continue;
    }
    const matched = itinerarySlots.some(
      (slot) =>
        item.itineraryDayNumber === slot.dayNumber &&
        item.itineraryItemTime === slot.time &&
        item.itineraryItemActivity === slot.activity,
    );
    if (!matched) generalItems.push(item);
  }

  if (generalItems.length > 0) {
    groups.push({
      key: 'general',
      label: 'その他の思い出',
      items: generalItems,
    });
  }

  return groups;
}

function MediaTile({
  item,
  onToggleFavorite,
}: {
  item: TripMemoryMedia;
  onToggleFavorite?: (item: TripMemoryMedia) => void;
}) {
  if (item.mediaType === 'note') {
    return (
      <View style={styles.noteCard}>
        <Text style={styles.noteLabel}>📝 メモ</Text>
        <Text style={styles.noteText}>{item.caption}</Text>
        {onToggleFavorite ? (
          <Pressable onPress={() => onToggleFavorite(item)} style={styles.favoriteButton}>
            <Text style={styles.favoriteText}>{item.isFavorite ? '★ お気に入り' : '☆ ハイライトに追加'}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.mediaTile}>
      {item.mediaType === 'photo' && item.mediaUrl ? (
        <Image source={{ uri: item.mediaUrl }} style={styles.mediaImage} contentFit="cover" />
      ) : (
        <View style={styles.videoPlaceholder}>
          <Text style={styles.videoEmoji}>🎬</Text>
          <Text style={styles.videoLabel}>動画</Text>
        </View>
      )}
      {item.caption ? <Text style={styles.caption} numberOfLines={2}>{item.caption}</Text> : null}
      {onToggleFavorite ? (
        <Pressable onPress={() => onToggleFavorite(item)} style={styles.favoriteChip}>
          <Text style={styles.favoriteChipText}>{item.isFavorite ? '★' : '☆'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

type TripMemoryTimelineProps = {
  media: TripMemoryMedia[];
  itinerarySlots?: ItineraryMemorySlot[];
  onToggleFavorite?: (item: TripMemoryMedia) => void;
  compact?: boolean;
};

export function TripMemoryTimeline({
  media,
  itinerarySlots = [],
  onToggleFavorite,
  compact,
}: TripMemoryTimelineProps) {
  if (media.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyEmoji}>✨</Text>
        <Text style={styles.emptyTitle}>まだ思い出がありません</Text>
        <Text style={styles.emptyText}>写真・動画・メモを追加して、旅の記録を残しましょう</Text>
      </View>
    );
  }

  const favorites = media.filter((item) => item.isFavorite);
  const groups = buildTimelineGroups(media, itinerarySlots);

  return (
    <View style={styles.wrap}>
      {favorites.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⭐ お気に入りの瞬間</Text>
          <View style={[styles.mediaGrid, compact && styles.mediaGridCompact]}>
            {favorites.map((item) => (
              <MediaTile key={item.id} item={item} onToggleFavorite={onToggleFavorite} />
            ))}
          </View>
        </View>
      ) : null}

      {groups.map((group, groupIndex) => (
        <View key={group.key} style={styles.timelineGroup}>
          <View style={styles.timelineMarker}>
            <View style={styles.timelineDot} />
            {groupIndex < groups.length - 1 ? <View style={styles.timelineLine} /> : null}
          </View>
          <View style={styles.timelineContent}>
            <Text style={styles.groupLabel}>{group.label}</Text>
            {group.sublabel ? <Text style={styles.groupSublabel}>{group.sublabel}</Text> : null}
            <View style={[styles.mediaGrid, compact && styles.mediaGridCompact]}>
              {group.items.map((item) => (
                <MediaTile key={item.id} item={item} onToggleFavorite={onToggleFavorite} />
              ))}
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.four,
  },
  section: {
    gap: Spacing.two,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: NS.colors.text,
  },
  timelineGroup: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  timelineMarker: {
    width: 16,
    alignItems: 'center',
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: NS.colors.coral,
    marginTop: 4,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: NS.colors.coralSoft,
    marginTop: 4,
    minHeight: 24,
  },
  timelineContent: {
    flex: 1,
    gap: Spacing.two,
    paddingBottom: Spacing.two,
  },
  groupLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: NS.colors.text,
  },
  groupSublabel: {
    fontSize: 12,
    color: NS.colors.textMuted,
    marginTop: -4,
  },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  mediaGridCompact: {
    gap: Spacing.one,
  },
  mediaTile: {
    width: 100,
    borderRadius: NS.radius.lg,
    overflow: 'hidden',
    backgroundColor: NS.colors.bgInput,
    position: 'relative',
  },
  mediaImage: {
    width: 100,
    height: 100,
  },
  videoPlaceholder: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: NS.colors.purpleSoft,
    gap: 4,
  },
  videoEmoji: {
    fontSize: 24,
  },
  videoLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: NS.colors.purple,
  },
  caption: {
    fontSize: 10,
    color: NS.colors.textSecondary,
    padding: 6,
  },
  noteCard: {
    width: '100%',
    backgroundColor: NS.colors.yellowSoft,
    borderRadius: NS.radius.lg,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  noteLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: NS.colors.orange,
  },
  noteText: {
    fontSize: 14,
    color: NS.colors.text,
    lineHeight: 20,
  },
  favoriteButton: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  favoriteText: {
    fontSize: 12,
    fontWeight: '700',
    color: NS.colors.coral,
  },
  favoriteChip: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteChipText: {
    fontSize: 12,
    color: NS.colors.coral,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing.five,
    gap: Spacing.two,
  },
  emptyEmoji: {
    fontSize: 32,
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
});
