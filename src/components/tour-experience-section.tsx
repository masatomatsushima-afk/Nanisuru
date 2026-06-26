import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import {
  buildTourSearchLinks,
  getPrimaryTourSearchUrl,
  type TourSearchKind,
} from '@/lib/tour-search-links';
import type { TourSuggestion } from '@/types/travel-timing';

type TourExperienceSectionProps = {
  destination: string;
  tourSuggestions?: TourSuggestion[];
};

export function TourExperienceSection({
  destination,
  tourSuggestions = [],
}: TourExperienceSectionProps) {
  const links = buildTourSearchLinks(destination);

  const openUrl = async (url: string) => {
    await Linking.openURL(url);
  };

  const openSearch = async (kind: TourSearchKind) => {
    await openUrl(getPrimaryTourSearchUrl(destination, kind));
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>ツアー・現地体験を探す</Text>
      <Text style={styles.subtitle}>
        予約API連携前の準備機能です。Google・GetYourGuide等の外部検索を開きます。
      </Text>

      <View style={styles.buttonGrid}>
        {links.map((link) => (
          <Pressable
            key={link.id}
            style={({ pressed }) => [styles.searchButton, pressed && styles.searchButtonPressed]}
            onPress={() => openSearch(link.id)}>
            <Text style={styles.searchIcon}>{link.icon}</Text>
            <Text style={styles.searchLabel}>{link.label}</Text>
            <Text style={styles.searchArrow}>↗</Text>
          </Pressable>
        ))}
      </View>

      {tourSuggestions.length > 0 ? (
        <View style={styles.suggestionsWrap}>
          <Text style={styles.suggestionsTitle}>AIからのツアー提案</Text>
          {tourSuggestions.map((suggestion, index) => (
            <View key={`${suggestion.title}-${index}`} style={styles.suggestionCard}>
              <Text style={styles.suggestionTitle}>
                {suggestion.dayNumber ? `Day ${suggestion.dayNumber}: ` : ''}
                {suggestion.title}
              </Text>
              <Text style={styles.suggestionDescription}>{suggestion.description}</Text>
              {suggestion.needsBooking ? (
                <Text style={styles.bookingHint}>ツアー予約が必要な可能性があります</Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.providerRow}>
        <Text style={styles.providerLabel}>検索先:</Text>
        <Pressable onPress={() => openUrl(links[0]?.urls.getYourGuide ?? '')}>
          <Text style={styles.providerLink}>GetYourGuide</Text>
        </Pressable>
        <Text style={styles.providerDot}>·</Text>
        <Pressable onPress={() => openUrl(links[0]?.urls.klook ?? '')}>
          <Text style={styles.providerLink}>Klook</Text>
        </Pressable>
        <Text style={styles.providerDot}>·</Text>
        <Pressable onPress={() => openUrl(links[0]?.urls.viator ?? '')}>
          <Text style={styles.providerLink}>Viator</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: Spacing.three,
    backgroundColor: NS.colors.bgCard,
    borderRadius: NS.radius.lg,
    borderWidth: 1,
    borderColor: NS.colors.border,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  title: {
    color: NS.colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  subtitle: {
    color: NS.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  buttonGrid: {
    gap: Spacing.two,
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  searchButtonPressed: {
    opacity: 0.88,
  },
  searchIcon: {
    fontSize: 18,
  },
  searchLabel: {
    color: NS.colors.text,
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  searchArrow: {
    color: NS.colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  suggestionsWrap: {
    marginTop: Spacing.one,
    gap: Spacing.two,
  },
  suggestionsTitle: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    fontWeight: '800',
  },
  suggestionCard: {
    backgroundColor: NS.colors.accentSoft,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
    padding: Spacing.three,
    gap: 6,
  },
  suggestionTitle: {
    color: NS.colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  suggestionDescription: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  bookingHint: {
    color: NS.colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: Spacing.one,
  },
  providerLabel: {
    color: NS.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  providerLink: {
    color: NS.colors.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  providerDot: {
    color: NS.colors.textMuted,
    fontSize: 11,
  },
});
