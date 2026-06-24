import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import type { ItineraryDay, ItineraryItem } from '@/types/plan';

type PlanTimelineEditorProps = {
  days: ItineraryDay[];
  onChange: (days: ItineraryDay[]) => void;
};

function TimelineItemEditor({
  item,
  index,
  onChange,
}: {
  item: ItineraryItem;
  index: number;
  onChange: (index: number, patch: Partial<ItineraryItem>) => void;
}) {
  return (
    <View style={styles.itemCard}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemIndex}>{index + 1}</Text>
        <TextInput
          style={styles.timeInput}
          value={item.time}
          onChangeText={(text) => onChange(index, { time: text })}
          placeholder="10:00"
          placeholderTextColor={NS.colors.textMuted}
        />
      </View>
      <TextInput
        style={styles.input}
        value={item.activity}
        onChangeText={(text) => onChange(index, { activity: text })}
        placeholder="スポット名"
        placeholderTextColor={NS.colors.textMuted}
      />
      <TextInput
        style={[styles.input, styles.inputMultiline]}
        value={item.reason ?? ''}
        onChangeText={(text) => onChange(index, { reason: text })}
        placeholder="選定理由"
        placeholderTextColor={NS.colors.textMuted}
        multiline
        textAlignVertical="top"
      />
      <TextInput
        style={styles.input}
        value={item.estimatedCost ?? ''}
        onChangeText={(text) => onChange(index, { estimatedCost: text })}
        placeholder="概算費用"
        placeholderTextColor={NS.colors.textMuted}
      />
    </View>
  );
}

export function PlanTimelineEditor({ days, onChange }: PlanTimelineEditorProps) {
  const [expandedDays, setExpandedDays] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(days.map((day) => [day.dayNumber, day.dayNumber === 1])),
  );

  const updateDayItems = (dayIndex: number, items: ItineraryItem[]) => {
    const next = days.map((day, index) => (index === dayIndex ? { ...day, items } : day));
    onChange(next);
  };

  const updateItem = (dayIndex: number, itemIndex: number, patch: Partial<ItineraryItem>) => {
    const items = days[dayIndex]?.items ?? [];
    const nextItems = items.map((item, index) =>
      index === itemIndex ? { ...item, ...patch } : item,
    );
    updateDayItems(dayIndex, nextItems);
  };

  if (days.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>行程がありません。AI調整で生成できます。</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {days.map((day, dayIndex) => {
        const isExpanded = expandedDays[day.dayNumber] ?? false;
        return (
          <View key={`${day.dayNumber}-${day.label}`} style={styles.dayBlock}>
            <Pressable
              style={({ pressed }) => [styles.dayHeader, pressed && styles.dayHeaderPressed]}
              onPress={() =>
                setExpandedDays((prev) => ({
                  ...prev,
                  [day.dayNumber]: !isExpanded,
                }))
              }>
              <Text style={styles.dayChevron}>{isExpanded ? '▾' : '▸'}</Text>
              <View style={styles.dayHeaderText}>
                <Text style={styles.dayLabel}>{day.label}</Text>
                {day.theme ? <Text style={styles.dayTheme}>{day.theme}</Text> : null}
              </View>
              <Text style={styles.dayCount}>{day.items.length}件</Text>
            </Pressable>

            {isExpanded ? (
              <View style={styles.itemsWrap}>
                {day.items.map((item, itemIndex) => (
                  <TimelineItemEditor
                    key={`${day.dayNumber}-${itemIndex}-${item.time}`}
                    item={item}
                    index={itemIndex}
                    onChange={(index, patch) => updateItem(dayIndex, index, patch)}
                  />
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.three,
  },
  empty: {
    padding: Spacing.three,
    backgroundColor: NS.colors.bgCard,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.border,
  },
  emptyText: {
    color: NS.colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
  dayBlock: {
    backgroundColor: NS.colors.bgCard,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.border,
    overflow: 'hidden',
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  dayHeaderPressed: {
    opacity: 0.88,
  },
  dayChevron: {
    color: NS.colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  dayHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  dayLabel: {
    color: NS.colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  dayTheme: {
    color: NS.colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  dayCount: {
    color: NS.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  itemsWrap: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: NS.colors.border,
    paddingTop: Spacing.three,
  },
  itemCard: {
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.borderStrong,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  itemIndex: {
    color: NS.colors.accent,
    fontSize: 12,
    fontWeight: '800',
    width: 20,
  },
  timeInput: {
    flex: 1,
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.sm,
    borderWidth: 1,
    borderColor: NS.colors.border,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one + 2,
    color: NS.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.sm,
    borderWidth: 1,
    borderColor: NS.colors.border,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.two,
    color: NS.colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  inputMultiline: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
});
