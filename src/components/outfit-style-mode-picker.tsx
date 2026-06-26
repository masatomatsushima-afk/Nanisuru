import { StyleSheet, Text, View } from 'react-native';

import { SelectChip } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { OUTFIT_STYLE_MODE_OPTIONS, type OutfitStyleMode } from '@/types/outfit-advice';

type OutfitStyleModePickerProps = {
  value?: OutfitStyleMode;
  onChange: (value: OutfitStyleMode) => void;
};

export function OutfitStyleModePicker({ value = 'AIに任せる', onChange }: OutfitStyleModePickerProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>服装の雰囲気</Text>
      <Text style={styles.hint}>性別に依存しない、実用的なアドバイスを表示します</Text>
      <View style={styles.chipGrid}>
        {OUTFIT_STYLE_MODE_OPTIONS.map((option) => (
          <SelectChip
            key={option}
            label={option}
            selected={value === option}
            onPress={() => onChange(option)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.one,
    marginTop: Spacing.two,
  },
  label: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  hint: {
    color: NS.colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
});
