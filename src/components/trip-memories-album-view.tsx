import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { TripMemoryAddSheet } from '@/components/trip-memory-add-sheet';
import { TripMemoryDayTimeline } from '@/components/trip-memory-day-timeline';
import { ProfileShowOnProfileButton } from '@/components/profile-show-on-profile-button';
import { PrimaryButton } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { generateTripMemoryAiSummary } from '@/lib/trip-memory-ai';
import {
  filterFavoriteMemories,
  filterNoteMemories,
  filterTodayMemories,
  groupMemoriesByItineraryDay,
} from '@/lib/trip-memories-album';
import {
  addTripMemoryNote,
  ensureTripMemoryForSavedTrip,
  extractItineraryMemorySlots,
  fetchTripMemoryWithMedia,
  pickAndUploadTripMemoryPhoto,
  pickAndUploadTripMemoryVideo,
  toggleTripMemoryMediaFavorite,
  toggleTripMemoryShowOnProfile,
  TRIP_MEMORY_VISIBILITY_DESCRIPTIONS,
  TRIP_MEMORY_VISIBILITY_LABELS,
  updateTripMemoryVisibility,
} from '@/lib/trip-memories';
import type { SavedTrip } from '@/types/trip';
import type {
  ItineraryMemorySlot,
  TripMemoryAiSummary,
  TripMemoryVisibility,
  TripMemoryWithMedia,
} from '@/types/trip-memory';

const VISIBILITY_OPTIONS: TripMemoryVisibility[] = ['private', 'unlisted', 'public'];

type TripMemoriesAlbumViewProps = {
  trip: SavedTrip;
  userId: string;
  isConfigured: boolean;
  initialLinkSlot?: ItineraryMemorySlot | null;
  onOpenAdd?: () => void;
};

function AiSummaryCard({ summary }: { summary: TripMemoryAiSummary }) {
  return (
    <View style={styles.aiCard}>
      <Text style={styles.aiEyebrow}>✨ AIで旅をまとめた</Text>
      <Text style={styles.aiTitle}>{summary.memoryTitle}</Text>
      <Text style={styles.aiSummary}>{summary.oneLineSummary}</Text>
      <View style={styles.highlightList}>
        {summary.highlights.map((item) => (
          <View key={item} style={styles.highlightChip}>
            <Text style={styles.highlightText}>{item}</Text>
          </View>
        ))}
      </View>
      {summary.recommendedPlaces?.length ? (
        <Text style={styles.aiList}>
          おすすめ: {summary.recommendedPlaces.join('、')}
        </Text>
      ) : null}
      {summary.nextVisitPlaces?.length ? (
        <Text style={styles.aiList}>
          次回行きたい: {summary.nextVisitPlaces.join('、')}
        </Text>
      ) : null}
      {summary.snsCaption ? (
        <Text style={styles.snsCaption}>📱 {summary.snsCaption}</Text>
      ) : null}
      {summary.emotionalNote ? <Text style={styles.aiNote}>{summary.emotionalNote}</Text> : null}
    </View>
  );
}

function MediaPreviewRow({
  media,
  onToggleFavorite,
}: {
  media: TripMemoryWithMedia['media'];
  onToggleFavorite?: (item: TripMemoryWithMedia['media'][number]) => void;
}) {
  if (!media.length) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previewRow}>
      {media.map((item) => (
        <View key={item.id} style={styles.previewTile}>
          {item.mediaType === 'note' ? (
            <View style={styles.previewNote}>
              <Text style={styles.previewNoteText} numberOfLines={4}>{item.caption}</Text>
            </View>
          ) : item.mediaType === 'photo' && item.mediaUrl ? (
            <Image source={{ uri: item.mediaUrl }} style={styles.previewImage} contentFit="cover" />
          ) : (
            <View style={styles.previewVideo}>
              <Text>🎬</Text>
            </View>
          )}
          {onToggleFavorite ? (
            <Pressable style={styles.previewFavorite} onPress={() => onToggleFavorite(item)}>
              <Text>{item.isFavorite ? '★' : '☆'}</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

export function TripMemoriesAlbumView({
  trip,
  userId,
  isConfigured,
  initialLinkSlot,
}: TripMemoriesAlbumViewProps) {
  const [memory, setMemory] = useState<TripMemoryWithMedia | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [showAddSheet, setShowAddSheet] = useState(false);

  const itinerarySlots = useMemo(() => extractItineraryMemorySlots(trip), [trip]);

  const reload = useCallback(async (memoryId: string) => {
    const loaded = await fetchTripMemoryWithMedia(memoryId);
    if (loaded) setMemory(loaded);
  }, []);

  const loadMemory = useCallback(async () => {
    if (!isConfigured) return;
    setIsLoading(true);
    try {
      const ensured = await ensureTripMemoryForSavedTrip(trip);
      await reload(ensured.id);
    } catch (error) {
      Alert.alert('エラー', error instanceof Error ? error.message : '思い出の読み込みに失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, [isConfigured, reload, trip]);

  useEffect(() => {
    void loadMemory();
  }, [loadMemory]);

  useEffect(() => {
    if (initialLinkSlot && memory) {
      setShowAddSheet(true);
    }
  }, [initialLinkSlot, memory]);

  const runAction = async (key: string, action: () => Promise<void>) => {
    setBusyAction(key);
    try {
      await action();
    } catch (error) {
      Alert.alert('エラー', error instanceof Error ? error.message : '操作に失敗しました');
    } finally {
      setBusyAction(null);
    }
  };

  const handleAddPhoto = (slot: ItineraryMemorySlot | null, placeName: string, note: string) => {
    if (!memory) return;
    void runAction('photo', async () => {
      const uploaded = await pickAndUploadTripMemoryPhoto(memory.id, userId, slot, {
        placeName: placeName || undefined,
        caption: note || undefined,
      });
      if (uploaded) {
        await reload(memory.id);
        setShowAddSheet(false);
      }
    });
  };

  const handleAddVideo = (slot: ItineraryMemorySlot | null, placeName: string, note: string) => {
    if (!memory) return;
    void runAction('video', async () => {
      const uploaded = await pickAndUploadTripMemoryVideo(memory.id, userId, slot, {
        placeName: placeName || undefined,
        caption: note || undefined,
      });
      if (uploaded) {
        await reload(memory.id);
        setShowAddSheet(false);
      }
    });
  };

  const handleAddNote = (slot: ItineraryMemorySlot | null, placeName: string, note: string) => {
    if (!memory || !note.trim()) return;
    void runAction('note', async () => {
      await addTripMemoryNote(memory.id, note, slot, placeName || undefined);
      await reload(memory.id);
      setShowAddSheet(false);
    });
  };

  const handleAiSummary = () => {
    if (!memory) return;
    void runAction('ai', async () => {
      const summary = await generateTripMemoryAiSummary(memory);
      setMemory({ ...memory, aiSummary: summary, title: summary.memoryTitle, summary: summary.oneLineSummary });
      await reload(memory.id);
    });
  };

  const handleVisibilityChange = (visibility: TripMemoryVisibility) => {
    if (!memory) return;
    void runAction('visibility', async () => {
      const updated = await updateTripMemoryVisibility(memory.id, visibility);
      setMemory({ ...memory, ...updated });
    });
  };

  const handleToggleFavorite = (item: TripMemoryWithMedia['media'][number]) => {
    if (!memory) return;
    void runAction(`fav-${item.id}`, async () => {
      await toggleTripMemoryMediaFavorite(item.id, !item.isFavorite);
      await reload(memory.id);
    });
  };

  if (!isConfigured) {
    return (
      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>思い出アルバム</Text>
        <Text style={styles.noticeText}>
          保存するにはログインが必要です。ログイン後、写真・動画・メモを残せます。
        </Text>
      </View>
    );
  }

  if (isLoading && !memory) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={NS.colors.accent} />
        <Text style={styles.loadingText}>思い出アルバムを準備中…</Text>
      </View>
    );
  }

  if (!memory) return null;

  const todayMemories = filterTodayMemories(trip, memory.media);
  const favoriteMemories = filterFavoriteMemories(memory.media);
  const noteMemories = filterNoteMemories(memory.media);
  const dayGroups = groupMemoriesByItineraryDay(memory.media, trip);
  const isEmpty = memory.media.length === 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>📔 思い出アルバム</Text>
        <Text style={styles.title}>{memory.title || trip.title}</Text>
        <Text style={styles.meta}>{memory.destination}</Text>
        {memory.dateLabel ? <Text style={styles.meta}>{memory.dateLabel}</Text> : null}
        <PrimaryButton
          label="写真を追加"
          onPress={() => setShowAddSheet(true)}
          disabled={Boolean(busyAction)}
        />
      </View>

      {memory.coverImageUrl ? (
        <Image source={{ uri: memory.coverImageUrl }} style={styles.cover} contentFit="cover" />
      ) : null}

      {isEmpty ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>まだ思い出がありません</Text>
          <Text style={styles.emptyText}>
            写真やメモを追加すると、この旅行のアルバムができます
          </Text>
          <PrimaryButton label="思い出を追加" onPress={() => setShowAddSheet(true)} />
        </View>
      ) : (
        <>
          {todayMemories.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>今日の思い出</Text>
              <MediaPreviewRow media={todayMemories} onToggleFavorite={handleToggleFavorite} />
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>旅のタイムライン</Text>
            <TripMemoryDayTimeline dayGroups={dayGroups} onToggleFavorite={handleToggleFavorite} />
          </View>

          {favoriteMemories.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>お気に入りの瞬間</Text>
              <MediaPreviewRow media={favoriteMemories} onToggleFavorite={handleToggleFavorite} />
            </View>
          ) : null}

          {noteMemories.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>メモ</Text>
              {noteMemories.map((item) => (
                <View key={item.id} style={styles.noteCard}>
                  {item.placeName ? <Text style={styles.notePlace}>{item.placeName}</Text> : null}
                  <Text style={styles.noteBody}>{item.caption}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </>
      )}

      {memory.aiSummary ? <AiSummaryCard summary={memory.aiSummary} /> : null}

      <PrimaryButton
        label={busyAction === 'ai' ? 'AIがまとめ中…' : 'AIで旅をまとめる'}
        variant="secondary"
        onPress={handleAiSummary}
        disabled={Boolean(busyAction) || memory.media.length === 0}
      />

      <View style={styles.privacySection}>
        <Text style={styles.privacyTitle}>🔒 公開設定</Text>
        <View style={styles.privacyRow}>
          {VISIBILITY_OPTIONS.map((option) => (
            <Pressable
              key={option}
              style={[styles.privacyChip, memory.visibility === option && styles.privacyChipActive]}
              onPress={() => handleVisibilityChange(option)}>
              <Text
                style={[
                  styles.privacyChipText,
                  memory.visibility === option && styles.privacyChipTextActive,
                ]}>
                {TRIP_MEMORY_VISIBILITY_LABELS[option]}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.privacyHint}>{TRIP_MEMORY_VISIBILITY_DESCRIPTIONS[memory.visibility]}</Text>
      </View>

      {memory.visibility === 'public' ? (
        <ProfileShowOnProfileButton
          visible
          showOnProfile={memory.showOnProfile !== false}
          busy={busyAction === 'profile'}
          onToggle={() => {
            void runAction('profile', async () => {
              const updated = await toggleTripMemoryShowOnProfile(
                memory.id,
                memory.showOnProfile === false,
              );
              setMemory({ ...memory, ...updated });
            });
          }}
        />
      ) : null}

      <TripMemoryAddSheet
        visible={showAddSheet}
        itinerarySlots={itinerarySlots}
        initialSlot={initialLinkSlot}
        busy={Boolean(busyAction)}
        onClose={() => setShowAddSheet(false)}
        onAddPhoto={handleAddPhoto}
        onAddVideo={handleAddVideo}
        onAddNote={handleAddNote}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.four,
  },
  header: {
    gap: Spacing.two,
  },
  eyebrow: {
    color: NS.colors.coral,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  title: {
    color: NS.colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  meta: {
    color: NS.colors.textSecondary,
    fontSize: 14,
  },
  cover: {
    width: '100%',
    height: 180,
    borderRadius: NS.radius.xl,
  },
  section: {
    gap: Spacing.two,
  },
  sectionTitle: {
    color: NS.colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  previewRow: {
    gap: Spacing.two,
  },
  previewTile: {
    width: 96,
    height: 96,
    borderRadius: NS.radius.lg,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: NS.colors.bgInput,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewVideo: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: NS.colors.purpleSoft,
  },
  previewNote: {
    flex: 1,
    padding: Spacing.two,
    backgroundColor: NS.colors.yellowSoft,
  },
  previewNoteText: {
    fontSize: 11,
    color: NS.colors.text,
  },
  previewFavorite: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteCard: {
    backgroundColor: NS.colors.yellowSoft,
    borderRadius: NS.radius.lg,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  notePlace: {
    fontSize: 12,
    fontWeight: '700',
    color: NS.colors.orange,
  },
  noteBody: {
    fontSize: 14,
    color: NS.colors.text,
    lineHeight: 20,
  },
  aiCard: {
    backgroundColor: NS.colors.purpleSoft,
    borderRadius: NS.radius.xl,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  aiEyebrow: {
    fontSize: 12,
    fontWeight: '800',
    color: NS.colors.purple,
  },
  aiTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: NS.colors.text,
  },
  aiSummary: {
    fontSize: 14,
    color: NS.colors.textSecondary,
    lineHeight: 22,
  },
  highlightList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  highlightChip: {
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderRadius: NS.radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
  },
  highlightText: {
    fontSize: 12,
    fontWeight: '700',
    color: NS.colors.text,
  },
  aiList: {
    fontSize: 13,
    color: NS.colors.text,
    lineHeight: 20,
  },
  snsCaption: {
    fontSize: 13,
    color: NS.colors.textSecondary,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  aiNote: {
    fontSize: 13,
    color: NS.colors.text,
    lineHeight: 20,
  },
  privacySection: {
    gap: Spacing.two,
  },
  privacyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: NS.colors.text,
  },
  privacyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  privacyChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: NS.radius.pill,
    backgroundColor: NS.colors.bgInput,
    borderWidth: 1,
    borderColor: NS.colors.border,
  },
  privacyChipActive: {
    backgroundColor: NS.colors.accentSoft,
    borderColor: NS.colors.accentBorder,
  },
  privacyChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: NS.colors.textMuted,
  },
  privacyChipTextActive: {
    color: NS.colors.accent,
  },
  privacyHint: {
    fontSize: 12,
    color: NS.colors.textMuted,
  },
  loading: {
    alignItems: 'center',
    paddingVertical: Spacing.six,
    gap: Spacing.two,
  },
  loadingText: {
    fontSize: 13,
    color: NS.colors.textMuted,
  },
  notice: {
    padding: Spacing.four,
    backgroundColor: NS.colors.yellowSoft,
    borderRadius: NS.radius.lg,
    gap: Spacing.two,
  },
  noticeTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: NS.colors.text,
  },
  noticeText: {
    fontSize: 13,
    color: NS.colors.textSecondary,
    lineHeight: 20,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing.five,
    gap: Spacing.three,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: NS.colors.text,
  },
  emptyText: {
    fontSize: 13,
    color: NS.colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
