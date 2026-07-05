import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import type { ItineraryMemorySlot } from '@/types/trip-memory';

type TripMemoryAddSheetProps = {
  visible: boolean;
  itinerarySlots: ItineraryMemorySlot[];
  initialSlot?: ItineraryMemorySlot | null;
  busy?: boolean;
  onClose: () => void;
  onAddPhoto: (slot: ItineraryMemorySlot | null, placeName: string, note: string) => void;
  onAddVideo: (slot: ItineraryMemorySlot | null, placeName: string, note: string) => void;
  onAddNote: (slot: ItineraryMemorySlot | null, placeName: string, note: string) => void;
};

export function TripMemoryAddSheet({
  visible,
  itinerarySlots,
  initialSlot,
  busy,
  onClose,
  onAddPhoto,
  onAddVideo,
  onAddNote,
}: TripMemoryAddSheetProps) {
  const insets = useSafeAreaInsets();
  const [selectedSlot, setSelectedSlot] = useState<ItineraryMemorySlot | null>(initialSlot ?? null);
  const [placeName, setPlaceName] = useState(initialSlot?.placeName ?? '');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (visible) {
      setSelectedSlot(initialSlot ?? null);
      setPlaceName(initialSlot?.placeName ?? '');
      setNote('');
    }
  }, [visible, initialSlot]);

  const slotLabel = selectedSlot
    ? `${selectedSlot.time} ${selectedSlot.activity}`
    : '特定の予定なし';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.four }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>思い出を追加</Text>

          <Text style={styles.label}>写真・動画を追加</Text>
          <View style={styles.mediaRow}>
            <PrimaryButton
              label="写真を選ぶ"
              variant="secondary"
              disabled={busy}
              onPress={() => onAddPhoto(selectedSlot, placeName.trim(), note.trim())}
            />
            <PrimaryButton
              label="動画を選ぶ"
              variant="secondary"
              disabled={busy}
              onPress={() => onAddVideo(selectedSlot, placeName.trim(), note.trim())}
            />
          </View>

          <Text style={styles.label}>どこの思い出？</Text>
          <TextInput
            style={styles.input}
            value={placeName}
            onChangeText={setPlaceName}
            placeholder="例: 〇〇カフェ、〇〇ビーチ"
            placeholderTextColor={NS.colors.textMuted}
          />

          <Text style={styles.label}>メモを書く</Text>
          <TextInput
            style={[styles.input, styles.noteInput]}
            value={note}
            onChangeText={setNote}
            multiline
            placeholder="雰囲気めっちゃ良かった、など"
            placeholderTextColor={NS.colors.textMuted}
          />

          <Text style={styles.label}>この予定に紐づける</Text>
          <Text style={styles.selectedSlot}>{slotLabel}</Text>
          <ScrollView style={styles.slotList} nestedScrollEnabled>
            <Pressable
              style={[styles.slotItem, !selectedSlot && styles.slotItemActive]}
              onPress={() => {
                setSelectedSlot(null);
                setPlaceName('');
              }}>
              <Text style={styles.slotItemText}>特定の予定なし</Text>
            </Pressable>
            {itinerarySlots.map((slot) => (
              <Pressable
                key={`${slot.dayIndex}-${slot.itemIndex}`}
                style={[
                  styles.slotItem,
                  selectedSlot?.dayIndex === slot.dayIndex &&
                    selectedSlot?.itemIndex === slot.itemIndex &&
                    styles.slotItemActive,
                ]}
                onPress={() => {
                  setSelectedSlot(slot);
                  setPlaceName(slot.placeName ?? slot.activity);
                }}>
                <Text style={styles.slotItemText}>
                  {slot.dayLabel ? `${slot.dayLabel} · ` : ''}
                  {slot.time} {slot.activity}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.actions}>
            <PrimaryButton
              label={busy ? '保存中…' : 'メモだけ保存'}
              onPress={() => onAddNote(selectedSlot, placeName.trim(), note.trim())}
              disabled={busy || !note.trim()}
            />
            <PrimaryButton label="閉じる" variant="secondary" onPress={onClose} disabled={busy} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  sheet: {
    backgroundColor: NS.colors.bgElevated,
    borderTopLeftRadius: NS.radius.xl,
    borderTopRightRadius: NS.radius.xl,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    maxHeight: '90%',
    gap: Spacing.two,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: NS.colors.border,
    marginBottom: Spacing.one,
  },
  title: {
    color: NS.colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  label: {
    color: NS.colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginTop: Spacing.one,
  },
  mediaRow: {
    gap: Spacing.two,
  },
  input: {
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.lg,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 15,
    color: NS.colors.text,
    borderWidth: 1,
    borderColor: NS.colors.border,
  },
  noteInput: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  selectedSlot: {
    color: NS.colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  slotList: {
    maxHeight: 160,
  },
  slotItem: {
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: NS.colors.border,
  },
  slotItemActive: {
    backgroundColor: NS.colors.accentSoft,
  },
  slotItemText: {
    fontSize: 13,
    color: NS.colors.textSecondary,
  },
  actions: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
});
