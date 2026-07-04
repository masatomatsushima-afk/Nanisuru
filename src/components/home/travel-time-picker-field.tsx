import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  TIME_PERIOD_PRESETS,
  buildHalfHourTimeSlots,
  formatTimeDisplay,
} from '@/lib/normalize-user-input';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';

type TravelTimePickerFieldProps = {
  label: string;
  optional?: boolean;
  value?: string;
  onChange: (value: string | undefined) => void;
  error?: string;
};

export function TravelTimePickerField({
  label,
  optional,
  value,
  onChange,
  error,
}: TravelTimePickerFieldProps) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const slots = useMemo(() => buildHalfHourTimeSlots(), []);

  const selectTime = (next: string) => {
    onChange(next || undefined);
    setOpen(false);
  };

  return (
    <>
      <View style={styles.field}>
        <Text style={styles.label}>
          {label}
          {optional ? <Text style={styles.optional}>（任意）</Text> : null}
        </Text>
        <Pressable
          style={[styles.trigger, error && styles.triggerError]}
          onPress={() => setOpen(true)}>
          <Text style={[styles.triggerText, !value && styles.triggerPlaceholder]}>
            {formatTimeDisplay(value)}
          </Text>
          <Text style={styles.triggerChevron}>▼</Text>
        </Pressable>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{label}を選択</Text>
              <Pressable onPress={() => setOpen(false)}>
                <Text style={styles.closeText}>閉じる</Text>
              </Pressable>
            </View>

            <Text style={styles.sectionLabel}>クイック選択</Text>
            <View style={styles.presetRow}>
              {TIME_PERIOD_PRESETS.map((preset) => {
                const selected = (value ?? '') === preset.value;
                return (
                  <Pressable
                    key={preset.id}
                    style={[styles.presetChip, selected && styles.presetChipSelected]}
                    onPress={() => selectTime(preset.value)}>
                    <Text style={[styles.presetText, selected && styles.presetTextSelected]}>
                      {preset.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.sectionLabel}>時刻（30分刻み）</Text>
            <ScrollView style={styles.slotScroll} contentContainerStyle={styles.slotGrid}>
              {slots.map((slot) => {
                const selected = value === slot;
                return (
                  <Pressable
                    key={slot}
                    style={[styles.slotChip, selected && styles.slotChipSelected]}
                    onPress={() => selectTime(slot)}>
                    <Text style={[styles.slotText, selected && styles.slotTextSelected]}>{slot}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: { gap: Spacing.one + 2 },
  label: { color: NS.colors.text, fontSize: 14, fontWeight: '700' },
  optional: { color: NS.colors.textMuted, fontSize: 12, fontWeight: '600' },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: NS.colors.bgCard,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.border,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
  },
  triggerError: { borderColor: '#EF4444' },
  triggerText: { color: NS.colors.text, fontSize: 16, fontWeight: '600' },
  triggerPlaceholder: { color: NS.colors.textMuted, fontWeight: '500' },
  triggerChevron: { color: NS.colors.textMuted, fontSize: 12 },
  error: { color: '#DC2626', fontSize: 12, fontWeight: '600' },

  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(15,23,42,0.45)' },
  sheet: {
    maxHeight: '72%',
    backgroundColor: '#FFFCF8',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.two,
  },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: NS.colors.text },
  closeText: { fontSize: 14, fontWeight: '700', color: NS.colors.orange },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: NS.colors.textSecondary,
    marginBottom: Spacing.one,
    marginTop: Spacing.one,
  },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one + 2 },
  presetChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: NS.colors.border,
    backgroundColor: NS.colors.bgCard,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.one + 2,
  },
  presetChipSelected: {
    borderColor: NS.colors.orange,
    backgroundColor: NS.colors.orangeSoft,
  },
  presetText: { fontSize: 13, fontWeight: '700', color: NS.colors.textSecondary },
  presetTextSelected: { color: NS.colors.orange },
  slotScroll: { marginTop: Spacing.one },
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one + 2,
    paddingBottom: Spacing.three,
  },
  slotChip: {
    width: '23%',
    minWidth: 72,
    borderRadius: NS.radius.sm,
    borderWidth: 1,
    borderColor: NS.colors.border,
    backgroundColor: NS.colors.bgCard,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  slotChipSelected: {
    borderColor: NS.colors.orange,
    backgroundColor: NS.colors.orangeSoft,
  },
  slotText: { fontSize: 13, fontWeight: '700', color: NS.colors.textSecondary },
  slotTextSelected: { color: NS.colors.orange },
});
