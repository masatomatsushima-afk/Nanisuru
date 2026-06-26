import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import type { PlanCustomPreferences } from '@/types/plan-preferences';

import {
  SPOT_INTERESTS_LABEL,
  SPOT_INTERESTS_PLACEHOLDER,
} from '@/lib/location-input-copy';

type PlanCustomPreferencesFieldsProps = {
  value: PlanCustomPreferences;
  onChange: (next: PlanCustomPreferences) => void;
  showCustomMood?: boolean;
  showCustomTravelIntent?: boolean;
  hideDesiredPlaces?: boolean;
};

function PreferenceField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = true,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={NS.colors.textMuted}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
  );
}

export function PlanCustomPreferencesFields({
  value,
  onChange,
  showCustomMood = true,
  showCustomTravelIntent = false,
  hideDesiredPlaces = false,
}: PlanCustomPreferencesFieldsProps) {
  const [expanded, setExpanded] = useState(false);

  const update = (patch: Partial<PlanCustomPreferences>) => {
    onChange({ ...value, ...patch });
  };

  return (
    <View style={styles.wrap}>
      {showCustomMood ? (
        <PreferenceField
          label="その他の気分を入力"
          value={value.customMood ?? ''}
          onChangeText={(text) => update({ customMood: text })}
          placeholder="例：今日は静かに過ごしたい、刺激がほしい、失恋したから気分転換したい"
        />
      ) : null}

      {showCustomTravelIntent ? (
        <PreferenceField
          label="その他を入力"
          value={value.customTravelIntent ?? ''}
          onChangeText={(text) => update({ customTravelIntent: text })}
          placeholder="例：温泉旅、写真撮影がメイン、子ども向けの施設を中心に"
        />
      ) : null}

      <Pressable
        style={({ pressed }) => [styles.expandButton, pressed && styles.expandButtonPressed]}
        onPress={() => setExpanded((prev) => !prev)}>
        <Text style={styles.expandIcon}>{expanded ? '▾' : '▸'}</Text>
        <Text style={styles.expandLabel}>もっと詳しく希望を書く</Text>
        {!expanded &&
        ((!hideDesiredPlaces && value.desiredPlaces?.trim()) || value.avoidPreferences?.trim()) ? (
          <View style={styles.expandBadge}>
            <Text style={styles.expandBadgeText}>入力あり</Text>
          </View>
        ) : null}
      </Pressable>

      {expanded ? (
        <View style={styles.expandedBox}>
          {!hideDesiredPlaces ? (
            <PreferenceField
              label={SPOT_INTERESTS_LABEL}
              value={value.desiredPlaces ?? ''}
              onChangeText={(text) => update({ desiredPlaces: text })}
              placeholder={SPOT_INTERESTS_PLACEHOLDER}
            />
          ) : null}
          <PreferenceField
            label="避けたいこと（任意）"
            value={value.avoidPreferences ?? ''}
            onChangeText={(text) => update({ avoidPreferences: text })}
            placeholder="例：歩きすぎたくない、高い店は嫌、人混みは苦手"
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.three,
  },
  field: {
    gap: Spacing.one + 2,
  },
  fieldLabel: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.borderStrong,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    color: NS.colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  inputMultiline: {
    minHeight: 72,
    paddingTop: Spacing.three,
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
  expandBadge: {
    backgroundColor: NS.colors.accentSoft,
    borderRadius: NS.radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
  },
  expandBadgeText: {
    color: NS.colors.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  expandedBox: {
    gap: Spacing.three,
    paddingTop: Spacing.one,
  },
});
