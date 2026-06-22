import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AiAdviceSection } from '@/components/ai-advice-section';
import { BudgetBreakdownSection } from '@/components/budget-breakdown-section';
import { ItineraryDaysView } from '@/components/itinerary-days-view';
import { FadeInView } from '@/components/ui/fade-in-view';
import { PremiumCard } from '@/components/ui/premium-card';
import { COMPANION_SUBTITLES, getItineraryEyebrow, PERSONALITY_SUBTITLES } from '@/lib/itineraries';
import { getSharedTrip } from '@/lib/trip-sharing';
import { getDurationBadgeLabel } from '@/lib/trip-duration';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import type { SharedTrip } from '@/types/share';
import { isDateRelatedCompanion } from '@/types/plan';

export default function SharedTripScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [trip, setTrip] = useState<SharedTrip | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) {
      setNotFound(true);
      setIsLoading(false);
      return;
    }

    getSharedTrip(id)
      .then((result) => {
        if (!result) {
          setNotFound(true);
          return;
        }
        setTrip(result);
      })
      .finally(() => setIsLoading(false));
  }, [id]);

  if (isLoading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={NS.colors.accent} />
        <Text style={styles.loadingText}>共有プランを読み込み中...</Text>
      </View>
    );
  }

  if (notFound || !trip) {
    return (
      <View style={[styles.centered, styles.container, { paddingTop: insets.top + Spacing.four }]}>
        <Text style={styles.errorTitle}>プランが見つかりません</Text>
        <Text style={styles.errorText}>
          リンクが無効か、削除された可能性があります。
        </Text>
        <Pressable style={styles.homeButton} onPress={() => router.replace('/')}>
          <Text style={styles.homeButtonText}>ホームへ戻る</Text>
        </Pressable>
      </View>
    );
  }

  const { payload } = trip;
  const { location, companion, personality, tripDuration, days, details } = payload;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + Spacing.four,
          paddingBottom: insets.bottom + Spacing.six,
        },
      ]}
      showsVerticalScrollIndicator={false}>
      <FadeInView>
        <Text style={styles.eyebrow}>SHARED TRIP</Text>
        <Text style={styles.title}>{trip.title}</Text>
        <Text style={styles.subtitle}>{getItineraryEyebrow(companion, location)}</Text>

        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{personality}</Text>
          </View>
          <View style={styles.badgeMuted}>
            <Text style={styles.badgeMutedText}>{getDurationBadgeLabel(tripDuration)}</Text>
          </View>
        </View>

        <Text style={styles.companionNote}>{PERSONALITY_SUBTITLES[personality]}</Text>
        <Text style={styles.companionSubnote}>{COMPANION_SUBTITLES[companion]}</Text>
      </FadeInView>

      <FadeInView delay={60}>
        {details.budgetBreakdown ? (
          <BudgetBreakdownSection breakdown={details.budgetBreakdown} />
        ) : (
          <PremiumCard style={styles.summaryCard}>
            <Text style={styles.sectionTitle}>予算</Text>
            <View style={styles.budgetPill}>
              <Text style={styles.budgetLabel}>合計予算</Text>
              <Text style={styles.budgetValue}>{details.totalBudget}</Text>
            </View>
          </PremiumCard>
        )}
        <PremiumCard style={styles.summaryCard}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>所要時間</Text>
            <Text style={styles.metaValue}>{details.duration}</Text>
          </View>
        </PremiumCard>
      </FadeInView>

      <FadeInView delay={120}>
        <PremiumCard style={styles.itineraryCard}>
          <Text style={styles.sectionTitle}>行程</Text>
          <ItineraryDaysView days={days} variant="detail" />
        </PremiumCard>
      </FadeInView>

      {isDateRelatedCompanion(companion) && details.aiAdvice ? (
        <FadeInView delay={180}>
          <AiAdviceSection advice={details.aiAdvice} />
        </FadeInView>
      ) : null}

      <FadeInView delay={220}>
        <Text style={styles.sharedAt}>
          共有日:{' '}
          {new Date(trip.createdAt).toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </Text>
        <Pressable style={styles.homeButton} onPress={() => router.replace('/')}>
          <Text style={styles.homeButtonText}>Nanisuruでプランを作る</Text>
        </Pressable>
      </FadeInView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NS.colors.bg,
  },
  content: {
    paddingHorizontal: NS.layout.screenPadding,
    maxWidth: NS.layout.maxWidth,
    width: '100%',
    alignSelf: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: NS.colors.bg,
    paddingHorizontal: NS.layout.screenPadding,
  },
  loadingText: {
    color: NS.colors.textSecondary,
    marginTop: Spacing.three,
    fontSize: 14,
  },
  eyebrow: {
    color: NS.colors.accent,
    ...NS.typography.eyebrow,
    marginBottom: Spacing.two,
  },
  title: {
    color: NS.colors.text,
    ...NS.typography.title,
    marginBottom: Spacing.two,
  },
  subtitle: {
    color: NS.colors.textSecondary,
    ...NS.typography.bodySm,
    marginBottom: Spacing.two,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  badge: {
    backgroundColor: NS.colors.accentSoft,
    borderRadius: NS.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
  },
  badgeText: {
    color: NS.colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  badgeMuted: {
    backgroundColor: NS.colors.bgCard,
    borderRadius: NS.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: NS.colors.border,
  },
  badgeMutedText: {
    color: NS.colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  companionNote: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  companionSubnote: {
    color: NS.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
    marginBottom: Spacing.four,
  },
  summaryCard: {
    padding: Spacing.four,
    marginBottom: Spacing.three,
  },
  itineraryCard: {
    padding: Spacing.four,
    marginBottom: Spacing.four,
  },
  sectionTitle: {
    color: NS.colors.text,
    ...NS.typography.headline,
    marginBottom: Spacing.three,
  },
  budgetPill: {
    backgroundColor: NS.colors.accentSoft,
    borderRadius: NS.radius.md,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
    marginBottom: Spacing.three,
  },
  budgetLabel: {
    color: NS.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  budgetValue: {
    color: NS.colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: NS.colors.border,
  },
  metaLabel: {
    color: NS.colors.textSecondary,
    fontSize: 14,
  },
  metaValue: {
    color: NS.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  sharedAt: {
    color: NS.colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: Spacing.three,
  },
  errorTitle: {
    color: NS.colors.text,
    ...NS.typography.headline,
    marginBottom: Spacing.two,
    textAlign: 'center',
  },
  errorText: {
    color: NS.colors.textSecondary,
    ...NS.typography.bodySm,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.four,
  },
  homeButton: {
    alignSelf: 'center',
    backgroundColor: NS.colors.accentSoft,
    borderRadius: NS.radius.pill,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.three,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
  },
  homeButtonText: {
    color: NS.colors.accent,
    fontSize: 15,
    fontWeight: '700',
  },
});
