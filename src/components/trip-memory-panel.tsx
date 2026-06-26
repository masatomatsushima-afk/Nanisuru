import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { TripMemoryTimeline } from '@/components/trip-memory-timeline';
import { ProfileShowOnProfileButton } from '@/components/profile-show-on-profile-button';
import { PrimaryButton } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { generateTripMemoryAiSummary } from '@/lib/trip-memory-ai';
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

type TripMemoryPanelProps = {
  trip: SavedTrip;
  userId: string;
  isConfigured: boolean;
  compact?: boolean;
};

const VISIBILITY_OPTIONS: TripMemoryVisibility[] = ['private', 'unlisted', 'public'];

function AiSummaryCard({ summary }: { summary: TripMemoryAiSummary }) {
  return (
    <View style={styles.aiCard}>
      <Text style={styles.aiEyebrow}>✨ AIまとめ</Text>
      <Text style={styles.aiTitle}>{summary.memoryTitle}</Text>
      <Text style={styles.aiSummary}>{summary.oneLineSummary}</Text>
      <View style={styles.highlightList}>
        {summary.highlights.map((item) => (
          <View key={item} style={styles.highlightChip}>
            <Text style={styles.highlightText}>{item}</Text>
          </View>
        ))}
      </View>
      {summary.emotionalNote ? (
        <Text style={styles.aiNote}>{summary.emotionalNote}</Text>
      ) : null}
      {summary.nextTimeTips ? (
        <Text style={styles.aiTips}>💡 次回に活かすこと: {summary.nextTimeTips}</Text>
      ) : null}
    </View>
  );
}

export function TripMemoryPanel({ trip, userId, isConfigured, compact }: TripMemoryPanelProps) {
  const [memory, setMemory] = useState<TripMemoryWithMedia | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [slotPickerVisible, setSlotPickerVisible] = useState(false);
  const [pendingAction, setPendingAction] = useState<'photo' | 'video' | 'note' | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<ItineraryMemorySlot | null>(null);

  const itinerarySlots = extractItineraryMemorySlots(trip);

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

  const beginUpload = (action: 'photo' | 'video' | 'note') => {
    if (itinerarySlots.length > 0) {
      setPendingAction(action);
      setSlotPickerVisible(true);
      return;
    }
    if (action === 'note') {
      setSelectedSlot(null);
      setNoteModalVisible(true);
      return;
    }
    void runAction(action, async () => {
      if (!memory) return;
      const uploaded =
        action === 'photo'
          ? await pickAndUploadTripMemoryPhoto(memory.id, userId, null)
          : await pickAndUploadTripMemoryVideo(memory.id, userId, null);
      if (uploaded) await reload(memory.id);
    });
  };

  const confirmSlot = (slot: ItineraryMemorySlot | null) => {
    setSlotPickerVisible(false);
    setSelectedSlot(slot);
    if (pendingAction === 'note') {
      setNoteModalVisible(true);
      return;
    }
    const action = pendingAction;
    setPendingAction(null);
    if (!action || !memory) return;

    void runAction(action, async () => {
      const uploaded =
        action === 'photo'
          ? await pickAndUploadTripMemoryPhoto(memory.id, userId, slot)
          : await pickAndUploadTripMemoryVideo(memory.id, userId, slot);
      if (uploaded) await reload(memory.id);
    });
  };

  const handleSaveNote = () => {
    if (!memory) return;
    void runAction('note', async () => {
      await addTripMemoryNote(memory.id, noteDraft, selectedSlot);
      setNoteDraft('');
      setNoteModalVisible(false);
      setSelectedSlot(null);
      await reload(memory.id);
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
        <Text style={styles.noticeText}>思い出機能を使うには Supabase の設定が必要です</Text>
      </View>
    );
  }

  if (isLoading && !memory) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={NS.colors.accent} />
        <Text style={styles.loadingText}>思い出フォルダを準備中...</Text>
      </View>
    );
  }

  if (!memory) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>📔 思い出</Text>
          <Text style={styles.title}>{memory.title || trip.title}</Text>
          <View style={styles.tagRow}>
            <View style={[styles.tag, styles.tagMint]}>
              <Text style={styles.tagText}>{memory.destination}</Text>
            </View>
            {memory.companion ? (
              <View style={[styles.tag, styles.tagCoral]}>
                <Text style={styles.tagTextDark}>{memory.companion}</Text>
              </View>
            ) : null}
            {memory.durationLabel ? (
              <View style={[styles.tag, styles.tagSky]}>
                <Text style={styles.tagTextDark}>{memory.durationLabel}</Text>
              </View>
            ) : null}
          </View>
          {memory.dateLabel ? <Text style={styles.dateLabel}>{memory.dateLabel}</Text> : null}
        </View>
        {!compact ? (
          <Pressable style={styles.openLink} onPress={() => router.push(`/memory/${memory.id}`)}>
            <Text style={styles.openLinkText}>詳しく見る →</Text>
          </Pressable>
        ) : null}
      </View>

      {memory.coverImageUrl ? (
        <View style={styles.coverWrap}>
          <Image source={{ uri: memory.coverImageUrl }} style={styles.coverImage} contentFit="cover" />
        </View>
      ) : null}

      <View style={styles.uploadRow}>
        <Pressable
          style={styles.uploadButton}
          disabled={Boolean(busyAction)}
          onPress={() => beginUpload('photo')}>
          <Text style={styles.uploadEmoji}>📷</Text>
          <Text style={styles.uploadLabel}>写真を追加</Text>
        </Pressable>
        <Pressable
          style={styles.uploadButton}
          disabled={Boolean(busyAction)}
          onPress={() => beginUpload('video')}>
          <Text style={styles.uploadEmoji}>🎬</Text>
          <Text style={styles.uploadLabel}>動画を追加</Text>
        </Pressable>
        <Pressable
          style={styles.uploadButton}
          disabled={Boolean(busyAction)}
          onPress={() => beginUpload('note')}>
          <Text style={styles.uploadEmoji}>📝</Text>
          <Text style={styles.uploadLabel}>メモを書く</Text>
        </Pressable>
      </View>

      {memory.aiSummary ? <AiSummaryCard summary={memory.aiSummary} /> : null}

      <PrimaryButton
        label={busyAction === 'ai' ? 'AIがまとめ中...' : 'AIで思い出をまとめる'}
        onPress={handleAiSummary}
        disabled={Boolean(busyAction)}
      />

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
        <Text style={styles.privacyHint}>
          {TRIP_MEMORY_VISIBILITY_DESCRIPTIONS[memory.visibility]}
        </Text>
      </View>

      <TripMemoryTimeline
        media={memory.media}
        itinerarySlots={itinerarySlots}
        onToggleFavorite={handleToggleFavorite}
        compact={compact}
      />

      <Modal visible={slotPickerVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>どの予定に添付しますか？</Text>
            <ScrollView style={styles.slotList}>
              <Pressable style={styles.slotItem} onPress={() => confirmSlot(null)}>
                <Text style={styles.slotItemText}>特定の予定なし</Text>
              </Pressable>
              {itinerarySlots.map((slot) => (
                <Pressable
                  key={`${slot.dayNumber}-${slot.time}-${slot.activity}`}
                  style={styles.slotItem}
                  onPress={() => confirmSlot(slot)}>
                  <Text style={styles.slotItemText}>
                    {slot.time} {slot.activity}
                  </Text>
                  {slot.placeName ? (
                    <Text style={styles.slotItemSub}>{slot.placeName}</Text>
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={styles.modalCancel} onPress={() => setSlotPickerVisible(false)}>
              <Text style={styles.modalCancelText}>キャンセル</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={noteModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.noteSheet}>
            <Text style={styles.modalTitle}>メモを書く</Text>
            {selectedSlot ? (
              <Text style={styles.noteSlotHint}>
                {selectedSlot.time} {selectedSlot.activity}
              </Text>
            ) : null}
            <TextInput
              style={styles.noteInput}
              multiline
              placeholder="今日の気持ちや、忘れたくないこと..."
              placeholderTextColor={NS.colors.textMuted}
              value={noteDraft}
              onChangeText={setNoteDraft}
            />
            <View style={styles.noteActions}>
              <Pressable
                style={styles.modalCancel}
                onPress={() => {
                  setNoteModalVisible(false);
                  setNoteDraft('');
                }}>
                <Text style={styles.modalCancelText}>キャンセル</Text>
              </Pressable>
              <PrimaryButton label="保存" onPress={handleSaveNote} disabled={!noteDraft.trim()} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  headerText: {
    flex: 1,
    gap: Spacing.one,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    color: NS.colors.coral,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: NS.colors.text,
    lineHeight: 26,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    marginTop: 4,
  },
  tag: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: NS.radius.pill,
  },
  tagMint: {
    backgroundColor: NS.colors.mintSoft,
  },
  tagCoral: {
    backgroundColor: NS.colors.coralSoft,
  },
  tagSky: {
    backgroundColor: NS.colors.skySoft,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '700',
    color: NS.colors.mint,
  },
  tagTextDark: {
    fontSize: 11,
    fontWeight: '700',
    color: NS.colors.textSecondary,
  },
  dateLabel: {
    fontSize: 13,
    color: NS.colors.textMuted,
    marginTop: 2,
  },
  openLink: {
    paddingTop: 4,
  },
  openLinkText: {
    fontSize: 13,
    fontWeight: '700',
    color: NS.colors.accent,
  },
  coverWrap: {
    height: 180,
    borderRadius: NS.radius.xl,
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  uploadRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  uploadButton: {
    flex: 1,
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.lg,
    borderWidth: 1,
    borderColor: NS.colors.border,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    gap: 4,
    ...NS.shadow.card,
  },
  uploadEmoji: {
    fontSize: 20,
  },
  uploadLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: NS.colors.textSecondary,
    textAlign: 'center',
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
    lineHeight: 24,
  },
  aiSummary: {
    fontSize: 14,
    color: NS.colors.textSecondary,
    lineHeight: 20,
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
  aiNote: {
    fontSize: 13,
    color: NS.colors.text,
    lineHeight: 19,
  },
  aiTips: {
    fontSize: 12,
    color: NS.colors.textSecondary,
    lineHeight: 18,
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
    paddingVertical: Spacing.five,
    gap: Spacing.two,
  },
  loadingText: {
    fontSize: 13,
    color: NS.colors.textMuted,
  },
  notice: {
    padding: Spacing.three,
    backgroundColor: NS.colors.yellowSoft,
    borderRadius: NS.radius.lg,
  },
  noticeText: {
    fontSize: 13,
    color: NS.colors.textSecondary,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: NS.colors.overlay,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: NS.colors.bgElevated,
    borderTopLeftRadius: NS.radius.xxl,
    borderTopRightRadius: NS.radius.xxl,
    padding: Spacing.four,
    maxHeight: '70%',
    gap: Spacing.three,
  },
  noteSheet: {
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.xxl,
    margin: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: NS.colors.text,
  },
  slotList: {
    maxHeight: 320,
  },
  slotItem: {
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: NS.colors.border,
  },
  slotItemText: {
    fontSize: 15,
    fontWeight: '700',
    color: NS.colors.text,
  },
  slotItemSub: {
    fontSize: 12,
    color: NS.colors.textMuted,
    marginTop: 2,
  },
  modalCancel: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: NS.colors.textMuted,
  },
  noteSlotHint: {
    fontSize: 13,
    color: NS.colors.accent,
    fontWeight: '700',
  },
  noteInput: {
    minHeight: 120,
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.lg,
    padding: Spacing.three,
    fontSize: 15,
    color: NS.colors.text,
    textAlignVertical: 'top',
  },
  noteActions: {
    gap: Spacing.two,
  },
});
