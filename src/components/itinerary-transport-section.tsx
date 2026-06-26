import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import {
  buildTransportLinks,
  recommendTransport,
} from '@/lib/transport-guidance';
import type { ItineraryItem } from '@/types/plan';
import type { TransportGuidanceContext, TransportMode } from '@/types/transport-guidance';
import { TRANSPORT_MODE_LABELS } from '@/types/transport-guidance';

type ItineraryTransportSectionProps = {
  fromItem: ItineraryItem;
  toItem: ItineraryItem;
  context?: TransportGuidanceContext;
  dayIndex?: number;
  totalDays?: number;
  itemIndex?: number;
};

const MODE_ICONS: Record<TransportMode, string> = {
  walking: '🚶',
  transit: '🚃',
  driving: '🚗',
  taxi: '🚕',
};

export function ItineraryTransportSection({
  fromItem,
  toItem,
  context = {},
  dayIndex = 0,
  totalDays = 1,
  itemIndex = 0,
}: ItineraryTransportSectionProps) {
  const recommendation = recommendTransport({
    fromItem,
    toItem,
    context,
    dayIndex,
    totalDays,
    itemIndex,
  });
  const links = buildTransportLinks(fromItem, toItem);

  const openUrl = async (url: string) => {
    await Linking.openURL(url);
  };

  const showDetailText =
    fromItem.transportation?.trim() &&
    fromItem.transportation !== '—' &&
    fromItem.transportation !== '-';

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>次の場所への移動</Text>
      <Text style={styles.destination}>→ {toItem.activity}</Text>

      <View style={styles.recommendBox}>
        <Text style={styles.recommendBadge}>AIおすすめ · {TRANSPORT_MODE_LABELS[recommendation.recommendedMode]}</Text>
        <Text style={styles.recommendText}>{recommendation.recommendationText}</Text>
        {recommendation.estimatedMinutes != null ? (
          <Text style={styles.metaText}>
            目安 {recommendation.estimatedMinutes}分
            {recommendation.distanceLabel ? ` · ${recommendation.distanceLabel}` : ''}
          </Text>
        ) : null}
      </View>

      <View style={styles.modeRow}>
        {(['walking', 'transit', 'driving', 'taxi'] as TransportMode[]).map((mode) => {
          const selected = recommendation.recommendedMode === mode;
          return (
            <View
              key={mode}
              style={[styles.modeChip, selected && styles.modeChipSelected]}>
              <Text style={styles.modeChipIcon}>{MODE_ICONS[mode]}</Text>
              <Text style={[styles.modeChipText, selected && styles.modeChipTextSelected]}>
                {TRANSPORT_MODE_LABELS[mode]}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={styles.buttonGrid}>
        {links.map((link) => (
          <Pressable
            key={link.mode}
            style={({ pressed }) => [
              styles.openButton,
              recommendation.recommendedMode === link.mode && styles.openButtonRecommended,
              pressed && styles.openButtonPressed,
            ]}
            onPress={() => void openUrl(link.url)}>
            <Text style={styles.openButtonText}>{link.openLabel}</Text>
          </Pressable>
        ))}
      </View>

      {showDetailText ? (
        <Text style={styles.detailText}>プラン詳細: {fromItem.transportation}</Text>
      ) : null}
      {fromItem.travelTimeToNext && fromItem.travelTimeToNext !== '—' ? (
        <Text style={styles.detailText}>移動時間目安: {fromItem.travelTimeToNext}</Text>
      ) : null}

      <Text style={styles.futureNote}>
        将来: 路線名・乗り換え・運賃などの詳細案内（Routes API連携予定）
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.sm,
    padding: Spacing.two + 2,
    borderWidth: 1,
    borderColor: NS.colors.border,
    gap: Spacing.two,
  },
  title: {
    color: NS.colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  destination: {
    color: NS.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  recommendBox: {
    backgroundColor: NS.colors.accentSoft,
    borderRadius: NS.radius.sm,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
    padding: Spacing.two + 2,
    gap: 4,
  },
  recommendBadge: {
    color: NS.colors.accent,
    fontSize: 11,
    fontWeight: '800',
  },
  recommendText: {
    color: NS.colors.text,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
  },
  metaText: {
    color: NS.colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  modeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: NS.colors.bgElevated,
    borderWidth: 1,
    borderColor: NS.colors.border,
  },
  modeChipSelected: {
    borderColor: NS.colors.accentBorder,
    backgroundColor: NS.colors.accentSoft,
  },
  modeChipIcon: {
    fontSize: 12,
  },
  modeChipText: {
    color: NS.colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  modeChipTextSelected: {
    color: NS.colors.accent,
  },
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  openButton: {
    flexGrow: 1,
    flexBasis: '46%',
    borderRadius: NS.radius.sm,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: NS.colors.borderStrong,
    backgroundColor: NS.colors.bgElevated,
  },
  openButtonRecommended: {
    borderColor: NS.colors.accentBorder,
    backgroundColor: NS.colors.accentSoft,
  },
  openButtonPressed: {
    opacity: 0.88,
  },
  openButtonText: {
    color: NS.colors.text,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  detailText: {
    color: NS.colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  futureNote: {
    color: NS.colors.textMuted,
    fontSize: 10,
    lineHeight: 14,
  },
});
