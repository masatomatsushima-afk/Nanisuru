import { useState } from 'react';
import {
  ActivityIndicator,
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
import { isOpenAiConfigured } from '@/lib/generate-plan';
import { PLAN_AI_ADJUST_PRESETS } from '@/types/plan-copy';

type PlanCopyAiAdjustBarProps = {
  onAdjust: (instruction: string) => Promise<void>;
  isAdjusting: boolean;
};

export function PlanCopyAiAdjustBar({ onAdjust, isAdjusting }: PlanCopyAiAdjustBarProps) {
  const [customInstruction, setCustomInstruction] = useState('');

  const handlePreset = (instruction: string) => {
    void onAdjust(instruction);
  };

  const handleCustom = () => {
    const trimmed = customInstruction.trim();
    if (!trimmed || isAdjusting) return;
    void onAdjust(trimmed);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>AIに調整してもらう</Text>
        <Text style={styles.subtitle}>ワンタップでプラン全体を最適化</Text>
      </View>

      {!isOpenAiConfigured() ? (
        <Text style={styles.notice}>OpenAI APIキーを設定するとAI調整が使えます</Text>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.presetRow}>
        {PLAN_AI_ADJUST_PRESETS.map((preset) => (
          <Pressable
            key={preset.id}
            style={({ pressed }) => [
              styles.presetChip,
              pressed && styles.presetChipPressed,
              isAdjusting && styles.presetChipDisabled,
            ]}
            onPress={() => handlePreset(preset.instruction)}
            disabled={isAdjusting || !isOpenAiConfigured()}>
            <Text style={styles.presetLabel}>{preset.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <TextInput
        style={styles.input}
        value={customInstruction}
        onChangeText={setCustomInstruction}
        placeholder="例：子連れ向けにして、午前中は動物園を入れて"
        placeholderTextColor={NS.colors.textMuted}
        multiline
        textAlignVertical="top"
        editable={!isAdjusting}
      />

      <PrimaryButton
        label={isAdjusting ? 'AIが調整中...' : 'AIに調整してもらう'}
        onPress={handleCustom}
        disabled={isAdjusting || !customInstruction.trim() || !isOpenAiConfigured()}
      />

      {isAdjusting ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={NS.colors.accent} />
          <Text style={styles.loadingText}>行程と費用を調整しています...</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.lg,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
    padding: Spacing.four,
    gap: Spacing.three,
    ...NS.shadow.card,
  },
  header: {
    gap: 4,
  },
  title: {
    color: NS.colors.text,
    ...NS.typography.headline,
  },
  subtitle: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  notice: {
    color: NS.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  presetRow: {
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  presetChip: {
    backgroundColor: NS.colors.bgCard,
    borderRadius: NS.radius.pill,
    borderWidth: 1,
    borderColor: NS.colors.borderStrong,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  presetChipPressed: {
    opacity: 0.88,
    borderColor: NS.colors.accentBorder,
    backgroundColor: NS.colors.accentSoft,
  },
  presetChipDisabled: {
    opacity: 0.5,
  },
  presetLabel: {
    color: NS.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.borderStrong,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    color: NS.colors.text,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 72,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  loadingText: {
    color: NS.colors.textSecondary,
    fontSize: 13,
  },
});
