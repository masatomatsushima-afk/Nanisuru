import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { PrimaryButton } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { buildManualFolderDurationLabel, createTripFolder } from '@/lib/trip-folders';
import { COMPANION_OPTIONS, type CompanionOption } from '@/types/plan';
import type { TripFolder } from '@/types/trip-folder';

type TripFolderCreateSheetProps = {
  visible: boolean;
  onClose: () => void;
  onCreated: (folder: TripFolder) => void;
};

export function TripFolderCreateSheet({ visible, onClose, onCreated }: TripFolderCreateSheetProps) {
  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [companionType, setCompanionType] = useState<CompanionOption>('友達');
  const [budget, setBudget] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setTitle('');
    setDestination('');
    setDepartureDate('');
    setReturnDate('');
    setCompanionType('友達');
    setBudget('');
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleCreate = async () => {
    setBusy(true);
    setError(null);
    try {
      const folder = await createTripFolder({
        title,
        destination,
        departureDate,
        returnDate,
        durationLabel: buildManualFolderDurationLabel(departureDate, returnDate),
        companionType,
        budget,
      });
      onCreated(folder);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '作成に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>新しい旅行フォルダを作る</Text>
          <Text style={styles.subtitle}>この旅行専用のAI秘書チャットが始まります</Text>

          <ScrollView style={styles.form} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>旅行名</Text>
            <TextInput
              style={styles.input}
              placeholder="例: 韓国旅行 2026年7月"
              placeholderTextColor={NS.colors.textMuted}
              value={title}
              onChangeText={setTitle}
            />

            <Text style={styles.label}>行き先</Text>
            <TextInput
              style={styles.input}
              placeholder="例: ソウル"
              placeholderTextColor={NS.colors.textMuted}
              value={destination}
              onChangeText={setDestination}
            />

            <Text style={styles.label}>出発日</Text>
            <TextInput
              style={styles.input}
              placeholder="2026-07-10"
              placeholderTextColor={NS.colors.textMuted}
              value={departureDate}
              onChangeText={setDepartureDate}
            />

            <Text style={styles.label}>帰宅日</Text>
            <TextInput
              style={styles.input}
              placeholder="2026-07-14"
              placeholderTextColor={NS.colors.textMuted}
              value={returnDate}
              onChangeText={setReturnDate}
            />

            <Text style={styles.label}>誰と行く</Text>
            <View style={styles.chipRow}>
              {COMPANION_OPTIONS.map((option) => (
                <Pressable
                  key={option}
                  style={[styles.chip, companionType === option && styles.chipActive]}
                  onPress={() => setCompanionType(option)}>
                  <Text
                    style={[styles.chipText, companionType === option && styles.chipTextActive]}>
                    {option}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>予算</Text>
            <TextInput
              style={styles.input}
              placeholder="例: 80000"
              placeholderTextColor={NS.colors.textMuted}
              value={budget}
              onChangeText={setBudget}
              keyboardType="numeric"
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>

          <PrimaryButton
            label={busy ? '作成中...' : 'フォルダを作成'}
            onPress={() => void handleCreate()}
            disabled={busy || !title.trim() || !destination.trim()}
          />
          <Pressable style={styles.cancel} onPress={handleClose}>
            <Text style={styles.cancelText}>キャンセル</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: NS.colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: NS.colors.bgElevated,
    borderTopLeftRadius: NS.radius.xxl,
    borderTopRightRadius: NS.radius.xxl,
    padding: Spacing.four,
    maxHeight: '88%',
    gap: Spacing.three,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: NS.colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: NS.colors.textSecondary,
    lineHeight: 19,
  },
  form: {
    maxHeight: 420,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: NS.colors.textSecondary,
    marginBottom: Spacing.one,
    marginTop: Spacing.two,
  },
  input: {
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.lg,
    borderWidth: 1,
    borderColor: NS.colors.border,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 15,
    color: NS.colors.text,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: NS.radius.pill,
    backgroundColor: NS.colors.bgInput,
    borderWidth: 1,
    borderColor: NS.colors.border,
  },
  chipActive: {
    backgroundColor: NS.colors.accentSoft,
    borderColor: NS.colors.accentBorder,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: NS.colors.textMuted,
  },
  chipTextActive: {
    color: NS.colors.accent,
  },
  error: {
    color: NS.colors.danger,
    fontSize: 13,
    marginTop: Spacing.two,
  },
  cancel: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: NS.colors.textMuted,
  },
});
