import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import type { TripMemoryDayGroup } from '@/lib/trip-memories-album';
import type { TripMemoryMedia } from '@/types/trip-memory';

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
        {item.placeName ? <Text style={styles.placeName}>{item.placeName}</Text> : null}
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

type TripMemoryDayTimelineProps = {
  dayGroups: TripMemoryDayGroup[];
  onToggleFavorite?: (item: TripMemoryMedia) => void;
};

export function TripMemoryDayTimeline({ dayGroups, onToggleFavorite }: TripMemoryDayTimelineProps) {
  if (!dayGroups.length) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      {dayGroups.map((dayGroup) => (
        <View key={`${dayGroup.dayNumber}-${dayGroup.dayLabel}`} style={styles.dayBlock}>
          <Text style={styles.dayLabel}>{dayGroup.dayLabel}</Text>
          {dayGroup.items.map((slot) => (
            <View key={`${slot.slotTime}-${slot.slotActivity}-${slot.slotLabel}`} style={styles.slotBlock}>
              {slot.slotTime ? (
                <Text style={styles.slotLabel}>
                  {slot.slotTime} {slot.slotActivity}
                </Text>
              ) : (
                <Text style={styles.slotLabel}>{slot.slotLabel}</Text>
              )}
              <View style={styles.mediaGrid}>
                {slot.media.map((item) => (
                  <MediaTile key={item.id} item={item} onToggleFavorite={onToggleFavorite} />
                ))}
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.four,
  },
  dayBlock: {
    gap: Spacing.three,
  },
  dayLabel: {
    fontSize: 16,
    fontWeight: '900',
    color: NS.colors.accent,
  },
  slotBlock: {
    gap: Spacing.two,
    paddingLeft: Spacing.two,
    borderLeftWidth: 2,
    borderLeftColor: NS.colors.coralSoft,
  },
  slotLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: NS.colors.text,
  },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
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
  placeName: {
    fontSize: 12,
    color: NS.colors.textMuted,
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
});
