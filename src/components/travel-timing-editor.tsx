import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { SelectChip } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import {
  TRAVEL_TIMING_PLACE_OPTIONS,
  type TravelTimingPlaceType,
  type TravelTimingSettings,
} from '@/types/travel-timing';

type TravelTimingEditorProps = {
  value: TravelTimingSettings;
  onChange: (value: TravelTimingSettings) => void;
};

function TimeField({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value?: string;
  onChangeText: (text: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value ?? ''}
        onChangeText={(text) => onChangeText(text.replace(/[^\d:]/g, '').slice(0, 5))}
        placeholder={placeholder}
        placeholderTextColor={NS.colors.textMuted}
        keyboardType="numbers-and-punctuation"
      />
    </View>
  );
}

function PlaceTypeRow({
  label,
  selected,
  onSelect,
}: {
  label: TravelTimingPlaceType;
  selected: boolean;
  onSelect: () => void;
}) {
  return <SelectChip label={label} selected={selected} onPress={onSelect} />;
}

export function TravelTimingEditor({ value, onChange }: TravelTimingEditorProps) {
  const [expanded, setExpanded] = useState(false);

  const patch = (partial: Partial<TravelTimingSettings>) => {
    onChange({ ...value, ...partial });
  };

  return (
    <View style={styles.wrap}>
      <Pressable
        style={({ pressed }) => [styles.expandButton, pressed && styles.expandButtonPressed]}
        onPress={() => setExpanded((prev) => !prev)}>
        <Text style={styles.expandIcon}>{expanded ? '▾' : '▸'}</Text>
        <Text style={styles.expandLabel}>到着・出発時間</Text>
        <Text style={styles.expandHint}>フライト・新幹線に合わせる</Text>
      </Pressable>

      {expanded ? (
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>到着（1日目）</Text>
          <View style={styles.row}>
            <TimeField
              label="到着時間"
              value={value.arrivalTime}
              onChangeText={(arrivalTime) => patch({ arrivalTime })}
              placeholder="例）14:30"
            />
            <TimeField
              label="チェックイン"
              value={value.hotelCheckInTime}
              onChangeText={(hotelCheckInTime) => patch({ hotelCheckInTime })}
              placeholder="例）15:00"
            />
          </View>
          <Text style={styles.subLabel}>到着場所</Text>
          <View style={styles.chipRow}>
            {TRAVEL_TIMING_PLACE_OPTIONS.map((option) => (
              <PlaceTypeRow
                key={`arrival-${option}`}
                label={option}
                selected={value.arrivalPlace === option}
                onSelect={() => patch({ arrivalPlace: option })}
              />
            ))}
          </View>
          <TextInput
            style={styles.input}
            value={value.arrivalPlaceDetail ?? ''}
            onChangeText={(arrivalPlaceDetail) => patch({ arrivalPlaceDetail })}
            placeholder="例）メルボルン空港 T2"
            placeholderTextColor={NS.colors.textMuted}
          />

          <Text style={[styles.sectionTitle, styles.sectionGap]}>出発（最終日）</Text>
          <View style={styles.row}>
            <TimeField
              label="出発時間"
              value={value.departureTime}
              onChangeText={(departureTime) => patch({ departureTime })}
              placeholder="例）18:00"
            />
          </View>
          <Text style={styles.subLabel}>出発場所</Text>
          <View style={styles.chipRow}>
            {TRAVEL_TIMING_PLACE_OPTIONS.map((option) => (
              <PlaceTypeRow
                key={`departure-${option}`}
                label={option}
                selected={value.departurePlace === option}
                onSelect={() => patch({ departurePlace: option })}
              />
            ))}
          </View>
          <TextInput
            style={styles.input}
            value={value.departurePlaceDetail ?? ''}
            onChangeText={(departurePlaceDetail) => patch({ departurePlaceDetail })}
            placeholder="例）シドニー国際空港"
            placeholderTextColor={NS.colors.textMuted}
          />

          <Text style={[styles.sectionTitle, styles.sectionGap]}>1日の行動時間</Text>
          <View style={styles.row}>
            <TimeField
              label="開始目安"
              value={value.dailyStartTime}
              onChangeText={(dailyStartTime) => patch({ dailyStartTime })}
              placeholder="例）09:00"
            />
            <TimeField
              label="終了目安"
              value={value.dailyEndTime}
              onChangeText={(dailyEndTime) => patch({ dailyEndTime })}
              placeholder="例）21:00"
            />
          </View>

          <Text style={styles.note}>
            到着・出発時間を入れると、1日目は軽め・最終日は帰路に間に合うプランを生成します。
          </Text>
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
    opacity: 0.9,
  },
  expandIcon: {
    color: NS.colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  expandLabel: {
    color: NS.colors.text,
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  expandHint: {
    color: NS.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  panel: {
    marginTop: Spacing.two,
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.border,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  sectionTitle: {
    color: NS.colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  sectionGap: {
    marginTop: Spacing.one,
  },
  subLabel: {
    color: NS.colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  field: {
    flex: 1,
    gap: Spacing.one,
  },
  label: {
    color: NS.colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  input: {
    backgroundColor: NS.colors.bgInput,
    borderColor: NS.colors.borderStrong,
    borderWidth: 1,
    borderRadius: NS.radius.sm + 2,
    color: NS.colors.text,
    fontSize: 15,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  note: {
    color: NS.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: Spacing.one,
  },
});
