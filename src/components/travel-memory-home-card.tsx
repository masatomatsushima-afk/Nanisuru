import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PremiumCard } from '@/components/ui/premium-card';
import { NS, getChipPalette, gradientStyle } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import type { MemoryDisplayChip } from '@/lib/travel-memory-display';

type TravelMemoryHomeCardProps = {
  preferenceChips: MemoryDisplayChip[];
  placeChips: MemoryDisplayChip[];
  totalPlaceCount: number;
  hasMemory: boolean;
  isLoading?: boolean;
};

function MemoryChip({
  chip,
  colorIndex,
}: {
  chip: MemoryDisplayChip;
  colorIndex: number;
}) {
  const palette = getChipPalette(colorIndex);

  return (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
        },
      ]}>
      <Text style={styles.chipIcon}>{chip.icon}</Text>
      <Text style={[styles.chipLabel, { color: palette.text }]} numberOfLines={1}>
        {chip.label}
      </Text>
    </View>
  );
}

export function TravelMemoryHomeCard({
  preferenceChips,
  placeChips,
  totalPlaceCount,
  hasMemory,
  isLoading = false,
}: TravelMemoryHomeCardProps) {
  const handleEdit = () => {
    router.push('/(tabs)/profile');
  };

  return (
    <PremiumCard style={styles.card} variant="accent">
      <View style={[styles.accentBar, gradientStyle('skyButton')]} />

      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>AI MEMORY</Text>
          <Text style={styles.title}>あなた向けに調整中 ✨</Text>
          <Text style={styles.helper}>
            この好みをもとに、AIがプランを少し調整します
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.editButton, pressed && styles.editButtonPressed]}
          onPress={handleEdit}
          accessibilityRole="button"
          accessibilityLabel="好みを編集">
          <Text style={styles.editButtonText}>好みを編集</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <Text style={styles.loadingText}>読み込み中...</Text>
      ) : !hasMemory ? (
        <Text style={styles.emptyText}>
          まだ好みは少ないです。プランを作るほどAIがあなたに合わせてくれます。
        </Text>
      ) : (
        <View style={styles.body}>
          {preferenceChips.length > 0 ? (
            <View style={styles.chipRow}>
              {preferenceChips.map((chip, index) => (
                <MemoryChip key={chip.id} chip={chip} colorIndex={index} />
              ))}
            </View>
          ) : null}

          {placeChips.length > 0 ? (
            <View style={styles.placeSection}>
              <Text style={styles.placeHeading}>
                最近気になった場所 {Math.max(totalPlaceCount, placeChips.length)}件
              </Text>
              <View style={styles.chipRow}>
                {placeChips.map((chip, index) => (
                  <MemoryChip
                    key={chip.id}
                    chip={chip}
                    colorIndex={preferenceChips.length + index}
                  />
                ))}
              </View>
            </View>
          ) : null}
        </View>
      )}
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.three + 2,
    marginBottom: Spacing.three,
  },
  accentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    opacity: 0.85,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  eyebrow: {
    color: NS.colors.accent,
    ...NS.typography.eyebrow,
    fontSize: 10,
  },
  title: {
    color: NS.colors.text,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  helper: {
    color: NS.colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  editButton: {
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.pill,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.one + 2,
    borderWidth: 1,
    borderColor: NS.colors.borderStrong,
    ...NS.shadow.card,
  },
  editButtonPressed: {
    opacity: 0.88,
  },
  editButtonText: {
    color: NS.colors.text,
    fontSize: 11,
    fontWeight: '800',
  },
  body: {
    gap: Spacing.two,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one + 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: NS.radius.pill,
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
    maxWidth: '100%',
  },
  chipIcon: {
    fontSize: 12,
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
  placeSection: {
    gap: Spacing.one,
    marginTop: Spacing.one,
  },
  placeHeading: {
    color: NS.colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  emptyText: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  loadingText: {
    color: NS.colors.textMuted,
    fontSize: 12,
  },
});
