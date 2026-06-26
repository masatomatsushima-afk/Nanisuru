import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { getPreTripCardUrl } from '@/lib/pre-trip-links';
import { PRE_TRIP_CARD_OPTIONS } from '@/types/pre-trip';

type PreTripPlanningSectionProps = {
  destination: string;
  departureDate?: string;
  returnDate?: string;
  currencyCode?: string;
};

export function PreTripPlanningSection({
  destination,
  departureDate,
  returnDate,
  currencyCode,
}: PreTripPlanningSectionProps) {
  const [expanded, setExpanded] = useState(false);

  const openCard = async (cardId: (typeof PRE_TRIP_CARD_OPTIONS)[number]['id']) => {
    const url = getPreTripCardUrl(cardId, {
      destination,
      departureDate,
      returnDate,
      currencyCode,
    });
    await Linking.openURL(url);
  };

  return (
    <View style={styles.wrap}>
      <Pressable
        style={({ pressed }) => [styles.expandButton, pressed && styles.expandButtonPressed]}
        onPress={() => setExpanded((prev) => !prev)}>
        <Text style={styles.expandIcon}>{expanded ? '▾' : '▸'}</Text>
        <Text style={styles.expandLabel}>旅行前の準備</Text>
        <Text style={styles.expandHint}>外部検索リンク</Text>
      </Pressable>

      {expanded ? (
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>旅行前に決めること</Text>
          <Text style={styles.sectionSubtitle}>
            予約API連携前の準備機能です。Google検索・Google Flights等を開きます。
          </Text>
          <View style={styles.cardGrid}>
            {PRE_TRIP_CARD_OPTIONS.map((card) => (
              <Pressable
                key={card.id}
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                onPress={() => openCard(card.id)}>
                <Text style={styles.cardIcon}>{card.icon}</Text>
                <Text style={styles.cardLabel}>{card.label}</Text>
                <Text style={styles.cardArrow}>↗</Text>
              </Pressable>
            ))}
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
    fontSize: 15,
    fontWeight: '700',
  },
  sectionSubtitle: {
    color: NS.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  cardGrid: {
    gap: Spacing.two,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: NS.colors.bgCard,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.border,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 4,
  },
  cardPressed: {
    opacity: 0.88,
  },
  cardIcon: {
    fontSize: 18,
    width: 24,
    textAlign: 'center',
  },
  cardLabel: {
    flex: 1,
    color: NS.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  cardArrow: {
    color: NS.colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
});
