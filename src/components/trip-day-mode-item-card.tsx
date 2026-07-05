import { StyleSheet, Text, View } from 'react-native';

import { PremiumCard } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import type { ItineraryItem } from '@/types/plan';

type TripDayModeItemCardProps = {
  item: ItineraryItem;
  variant: 'current' | 'next';
  weatherNote?: string | null;
  location?: string;
};

export function TripDayModeItemCard({ item, variant, weatherNote }: TripDayModeItemCardProps) {
  const isCurrent = variant === 'current';

  return (
    <PremiumCard style={styles.card}>
      <View style={styles.timeRow}>
        <Text style={styles.time}>{item.time}</Text>
        {item.activityCategory ? (
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{item.activityCategory}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.placeName}>{item.activity}</Text>

      {isCurrent && item.reason?.trim() ? (
        <Text style={styles.note}>{item.reason.trim()}</Text>
      ) : null}

      {!isCurrent && (item.transportation?.trim() || item.travelTimeToNext?.trim()) ? (
        <Text style={styles.note}>
          {item.transportation?.trim() || item.travelTimeToNext?.trim()}
        </Text>
      ) : null}

      {!isCurrent && item.travelTimeToNext?.trim() && item.transportation?.trim() ? (
        <Text style={styles.travelTime}>移動目安: {item.travelTimeToNext.trim()}</Text>
      ) : null}

      {isCurrent && item.estimatedCost?.trim() ? (
        <Text style={styles.budget}>予算目安: {item.estimatedCost.trim()}</Text>
      ) : null}

      {weatherNote ? <Text style={styles.weatherNote}>☔ {weatherNote}</Text> : null}
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  time: {
    color: NS.colors.accent,
    fontSize: 15,
    fontWeight: '800',
  },
  categoryBadge: {
    backgroundColor: NS.colors.accentSoft,
    borderRadius: NS.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: NS.colors.accent,
  },
  categoryText: {
    color: NS.colors.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  placeName: {
    color: NS.colors.text,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 26,
  },
  note: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  travelTime: {
    color: NS.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  budget: {
    color: NS.colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  weatherNote: {
    color: NS.colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    fontStyle: 'italic',
  },
});
