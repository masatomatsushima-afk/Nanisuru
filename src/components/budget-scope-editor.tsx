import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { SelectChip } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import {
  formatCustomBudgetItemsText,
  parseCustomBudgetItemsText,
  toggleAlreadyPaidItem,
  toggleBudgetScopeItem,
} from '@/lib/budget-scope';
import { BUDGET_SCOPE_OPTIONS, type BudgetScopeSettings } from '@/types/budget-scope';

type BudgetScopeEditorProps = {
  value: BudgetScopeSettings;
  onChange: (next: BudgetScopeSettings) => void;
};

export function BudgetScopeEditor({ value, onChange }: BudgetScopeEditorProps) {
  const [expanded, setExpanded] = useState(false);
  const customText = formatCustomBudgetItemsText(value.customItems);

  const update = (patch: Partial<BudgetScopeSettings>) => {
    onChange({ ...value, ...patch });
  };

  return (
    <View style={styles.wrap}>
      <Pressable
        style={({ pressed }) => [styles.expandButton, pressed && styles.expandButtonPressed]}
        onPress={() => setExpanded((prev) => !prev)}>
        <Text style={styles.expandIcon}>{expanded ? '▾' : '▸'}</Text>
        <Text style={styles.expandLabel}>予算の詳細を設定</Text>
        <Text style={styles.expandHint}>
          {value.includedItems.length}項目を含める
        </Text>
      </Pressable>

      {expanded ? (
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>予算に含めるもの</Text>
          <Text style={styles.sectionSubtitle}>複数選択できます</Text>
          <View style={styles.chipGrid}>
            {BUDGET_SCOPE_OPTIONS.map((item) => (
              <SelectChip
                key={item}
                label={item}
                selected={value.includedItems.includes(item)}
                onPress={() => update(toggleBudgetScopeItem(value, item))}
              />
            ))}
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleTextWrap}>
              <Text style={styles.toggleLabel}>すでに支払い済みのものは除外する</Text>
              <Text style={styles.toggleHint}>宿泊・航空券など予約済みの費用を予算計算から外します</Text>
            </View>
            <Switch
              value={value.excludeAlreadyPaid}
              onValueChange={(next) => update({ excludeAlreadyPaid: next })}
              trackColor={{ false: NS.colors.border, true: NS.colors.accentSoft }}
              thumbColor={value.excludeAlreadyPaid ? NS.colors.accent : NS.colors.textMuted}
            />
          </View>

          {value.excludeAlreadyPaid ? (
            <View style={styles.paidSection}>
              <Text style={styles.sectionTitle}>支払い済みの項目</Text>
              <View style={styles.chipGrid}>
                {value.includedItems.map((item) => (
                  <SelectChip
                    key={`paid-${item}`}
                    label={`${item}（済）`}
                    selected={value.alreadyPaidItems.includes(item)}
                    onPress={() => update(toggleAlreadyPaidItem(value, item))}
                  />
                ))}
              </View>
              <View style={styles.bookedRow}>
                <Pressable
                  style={[styles.bookedChip, value.flightsBooked && styles.bookedChipActive]}
                  onPress={() => update({ flightsBooked: !value.flightsBooked })}>
                  <Text style={[styles.bookedChipText, value.flightsBooked && styles.bookedChipTextActive]}>
                    飛行機は予約済み
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.bookedChip, value.hotelsBooked && styles.bookedChipActive]}
                  onPress={() => update({ hotelsBooked: !value.hotelsBooked })}>
                  <Text style={[styles.bookedChipText, value.hotelsBooked && styles.bookedChipTextActive]}>
                    ホテルは予約済み
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <View style={styles.customField}>
            <Text style={styles.sectionTitle}>その他の予算項目を追加</Text>
            <TextInput
              style={styles.input}
              value={customText}
              onChangeText={(text) =>
                update({ customItems: parseCustomBudgetItemsText(text) })
              }
              placeholder="例）テーマパークチケット、ライブチケット、SIMカード"
              placeholderTextColor={NS.colors.textMuted}
              multiline
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: Spacing.two,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: NS.colors.bgCard,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.border,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  expandButtonPressed: {
    opacity: 0.88,
  },
  expandIcon: {
    color: NS.colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  expandLabel: {
    flex: 1,
    color: NS.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  expandHint: {
    color: NS.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  panel: {
    marginTop: Spacing.two,
    gap: Spacing.three,
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.border,
    padding: Spacing.three,
  },
  sectionTitle: {
    color: NS.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  sectionSubtitle: {
    color: NS.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  toggleTextWrap: {
    flex: 1,
    gap: 4,
  },
  toggleLabel: {
    color: NS.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  toggleHint: {
    color: NS.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  paidSection: {
    gap: Spacing.two,
  },
  bookedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  bookedChip: {
    borderRadius: NS.radius.pill,
    borderWidth: 1,
    borderColor: NS.colors.border,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    backgroundColor: NS.colors.bgInput,
  },
  bookedChipActive: {
    borderColor: NS.colors.accentBorder,
    backgroundColor: NS.colors.accentSoft,
  },
  bookedChipText: {
    color: NS.colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  bookedChipTextActive: {
    color: NS.colors.accent,
  },
  customField: {
    gap: Spacing.one,
  },
  input: {
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.borderStrong,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    color: NS.colors.text,
    fontSize: 14,
    lineHeight: 22,
    minHeight: 72,
    textAlignVertical: 'top',
  },
});
