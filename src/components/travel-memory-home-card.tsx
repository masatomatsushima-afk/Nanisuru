import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { HOME_PASTEL } from '@/constants/home-layout';
import { NS, getChipPalette } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import type { MemoryDisplayChip } from '@/lib/travel-memory-display';

const DEFAULT_CHIPS = ['映え', 'カフェ', 'のんびり', '海辺', '温泉'] as const;

type TravelMemoryHomeCardProps = {
  preferenceChips: MemoryDisplayChip[];
  hasMemory: boolean;
  isLoading?: boolean;
};

function PreferenceChip({ label, colorIndex }: { label: string; colorIndex: number }) {
  const palette = getChipPalette(colorIndex);

  return (
    <View style={[styles.chip, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <Text style={[styles.chipLabel, { color: palette.text }]}>{label}</Text>
    </View>
  );
}

export function TravelMemoryHomeCard({
  preferenceChips,
  hasMemory,
  isLoading = false,
}: TravelMemoryHomeCardProps) {
  const displayChips = hasMemory
    ? preferenceChips.slice(0, 5).map((chip) => chip.label)
    : [...DEFAULT_CHIPS];

  return (
    <View style={styles.card}>
      <View style={styles.bgDot} />
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>💛 あなたの好み</Text>
          <Text style={styles.subtitle}>
            これまでの保存や閲覧から、あなたの「好き」をまとめました
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.editBtn, pressed && styles.editBtnPressed]}
          onPress={() => router.push('/(tabs)/profile')}
          accessibilityLabel="好みを編集">
          <Text style={styles.editBtnText}>編集</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <Text style={styles.loadingText}>読み込み中...</Text>
      ) : (
        <View style={styles.chipRow}>
          {displayChips.map((label, index) => (
            <PreferenceChip key={`${label}-${index}`} label={label} colorIndex={index} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: HOME_PASTEL.cream,
    borderRadius: 18,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 4,
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: HOME_PASTEL.creamBorder,
    overflow: 'hidden',
    ...NS.shadow.card,
    shadowOpacity: 0.06,
  },
  bgDot: {
    position: 'absolute',
    top: -12,
    right: 24,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
    zIndex: 1,
  },
  headerText: {
    flex: 1,
    gap: 3,
  },
  title: {
    color: NS.colors.text,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  subtitle: {
    color: NS.colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 14,
  },
  editBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: NS.radius.pill,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.one + 2,
    borderWidth: 1,
    borderColor: 'rgba(251, 146, 60, 0.2)',
  },
  editBtnPressed: {
    opacity: 0.88,
  },
  editBtnText: {
    color: NS.colors.orange,
    fontSize: 11,
    fontWeight: '800',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one + 2,
    zIndex: 1,
  },
  chip: {
    borderRadius: NS.radius.pill,
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: 5,
  },
  chipLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  loadingText: {
    color: NS.colors.textMuted,
    fontSize: 12,
  },
});
