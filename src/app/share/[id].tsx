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
import { ConciergeAccessSection } from '@/components/concierge-access-section';
import { ConciergeAnalysisSection } from '@/components/concierge-analysis-section';
import { ItineraryDaysView } from '@/components/itinerary-days-view';
import { SharedTripReactions } from '@/components/shared-trip-reactions';
import { WeatherSection } from '@/components/weather-section';
import { FadeInView } from '@/components/ui/fade-in-view';
import { PremiumCard } from '@/components/ui/premium-card';
import { COMPANION_SUBTITLES, PERSONALITY_SUBTITLES } from '@/lib/itineraries';
import { getSharedTrip } from '@/lib/trip-sharing';
import { getDurationBadgeLabel } from '@/lib/trip-duration';
import { formatTripDateRangeLabel } from '@/lib/trip-schedule';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import type { SharedTrip } from '@/types/share';
import { isDateRelatedCompanion } from '@/types/plan';

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function HighlightList({ items }: { items: string[] }) {
  if (items.length === 0) return null;

  return (
    <View style={styles.highlightList}>
      {items.map((item, index) => (
        <View key={`${item}-${index}`} style={styles.highlightRow}>
          <View style={styles.highlightDot}>
            <Text style={styles.highlightDotText}>✦</Text>
          </View>
          <Text style={styles.highlightText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function BackupList({ items }: { items: string[] }) {
  if (items.length === 0) return null;

  return (
    <View style={styles.backupList}>
      {items.map((item, index) => (
        <View key={`${item}-${index}`} style={styles.backupRow}>
          <Text style={styles.backupIcon}>☔</Text>
          <Text style={styles.backupText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

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
        <Text style={styles.notFoundIcon}>🔗</Text>
        <Text style={styles.errorTitle}>共有プランが見つかりません</Text>
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
  const { location, companion, personality, tripDuration, customDuration, days, details } = payload;
  const scheduleLabel = formatTripDateRangeLabel(details.tripDate, details.tripEndDate);
  const durationLabel = getDurationBadgeLabel(tripDuration, customDuration);
  const budgetInput =
    payload.budget && payload.currency
      ? `${payload.budget} ${payload.currency}`
      : payload.budget ?? null;

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
        <View style={styles.heroGlow} />
        <View style={styles.readOnlyBanner}>
          <Text style={styles.readOnlyBannerText}>閲覧専用 — このプランは編集できません</Text>
        </View>

        <Text style={styles.eyebrow}>SHARED PLAN</Text>
        <Text style={styles.title}>{trip.title}</Text>

        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{personality}</Text>
          </View>
          <View style={styles.badgeMuted}>
            <Text style={styles.badgeMutedText}>{companion}</Text>
          </View>
          <View style={styles.badgeMuted}>
            <Text style={styles.badgeMutedText}>{durationLabel}</Text>
          </View>
        </View>

        <Text style={styles.companionNote}>{PERSONALITY_SUBTITLES[personality]}</Text>
        <Text style={styles.companionSubnote}>{COMPANION_SUBTITLES[companion]}</Text>
      </FadeInView>

      <FadeInView delay={20}>
        <SharedTripReactions sharedPlanId={trip.id} />
      </FadeInView>

      <FadeInView delay={40}>
        <PremiumCard style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>📍 目的地</Text>
          <Text style={styles.locationValue}>{location.trim() || '未指定'}</Text>
          {payload.mood ? <Text style={styles.moodText}>気分: {payload.mood}</Text> : null}
        </PremiumCard>
      </FadeInView>

      <FadeInView delay={60}>
        <PremiumCard style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>📅 期間</Text>
          {scheduleLabel ? <InfoRow label="日程" value={scheduleLabel} /> : null}
          <InfoRow label="旅行期間" value={durationLabel} />
          <InfoRow label="所要時間" value={details.duration} />
        </PremiumCard>
      </FadeInView>

      <FadeInView delay={80}>
        <PremiumCard style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>💰 予算</Text>
          <View style={styles.budgetPill}>
            <Text style={styles.budgetLabel}>合計予算</Text>
            <Text style={styles.budgetValue}>{details.totalBudget}</Text>
          </View>
          {budgetInput ? <InfoRow label="入力予算" value={budgetInput} /> : null}
          {payload.people ? <InfoRow label="人数" value={`${payload.people}人`} /> : null}
          {details.budgetBreakdown ? (
            <View style={styles.budgetBreakdownWrap}>
              <BudgetBreakdownSection breakdown={details.budgetBreakdown} compact />
            </View>
          ) : null}
        </PremiumCard>
      </FadeInView>

      {details.weather ? (
        <FadeInView delay={100}>
          <WeatherSection weather={details.weather} />
        </FadeInView>
      ) : null}

      {details.plannerMessage ? (
        <FadeInView delay={120}>
          <PremiumCard style={styles.conciergeCard}>
            <Text style={styles.conciergeLabel}>AIコンシェルジュから一言</Text>
            <Text style={styles.conciergeMessage}>{details.plannerMessage}</Text>
          </PremiumCard>
        </FadeInView>
      ) : null}

      {details.conciergeAnalysis ? (
        <FadeInView delay={140}>
          <ConciergeAnalysisSection analysis={details.conciergeAnalysis} compact />
        </FadeInView>
      ) : null}

      {details.highlights.length > 0 ? (
        <FadeInView delay={160}>
          <PremiumCard style={styles.summaryCard}>
            <Text style={styles.sectionTitle}>⭐ ハイライト</Text>
            <HighlightList items={details.highlights} />
          </PremiumCard>
        </FadeInView>
      ) : null}

      <FadeInView delay={180}>
        <PremiumCard style={styles.itineraryCard}>
          <Text style={styles.sectionTitle}>🗓 タイムライン</Text>
          <Text style={styles.sectionHint}>各スポットから Google Maps で開けます</Text>
          {days.length > 0 ? (
            <ItineraryDaysView
              days={days}
              variant="detail"
              location={location}
              transportContext={{
                location,
                weather: details.weather,
                travelTiming: details.travelTiming,
                companion,
                budget: payload.budget,
              }}
            />
          ) : (
            <Text style={styles.emptyText}>行程データがありません</Text>
          )}
        </PremiumCard>
      </FadeInView>

      {days.length > 0 ? (
        <FadeInView delay={200}>
          <PremiumCard style={styles.summaryCard}>
            <Text style={styles.sectionTitle}>🗺 アクセス・予約</Text>
            <ConciergeAccessSection
              days={days}
              location={location}
              compact
              transportContext={{
                location,
                weather: details.weather,
                travelTiming: details.travelTiming,
                companion,
                budget: payload.budget,
              }}
            />
          </PremiumCard>
        </FadeInView>
      ) : null}

      {details.rainyDayAlternatives.length > 0 ? (
        <FadeInView delay={220}>
          <PremiumCard style={styles.summaryCard}>
            <Text style={styles.sectionTitle}>☔ 天候バックアップ</Text>
            <Text style={styles.sectionHint}>雨や天候変化時の代替案</Text>
            <BackupList items={details.rainyDayAlternatives} />
          </PremiumCard>
        </FadeInView>
      ) : null}

      {isDateRelatedCompanion(companion) && details.aiAdvice ? (
        <FadeInView delay={240}>
          <AiAdviceSection advice={details.aiAdvice} />
        </FadeInView>
      ) : null}

      <FadeInView delay={260}>
        <Text style={styles.sharedAt}>
          共有日:{' '}
          {new Date(trip.createdAt).toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </Text>
        <Pressable style={styles.ctaButton} onPress={() => router.replace('/')}>
          <Text style={styles.ctaButtonText}>Nanisuruで自分のプランを作る</Text>
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
  heroGlow: {
    position: 'absolute',
    top: -40,
    alignSelf: 'center',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: NS.colors.accentGlow,
  },
  readOnlyBanner: {
    backgroundColor: NS.colors.bgCard,
    borderRadius: NS.radius.md,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderColor: NS.colors.borderStrong,
    marginBottom: Spacing.three,
  },
  readOnlyBannerText: {
    color: NS.colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  eyebrow: {
    color: NS.colors.accent,
    ...NS.typography.eyebrow,
    marginBottom: Spacing.two,
  },
  title: {
    color: NS.colors.text,
    ...NS.typography.title,
    marginBottom: Spacing.three,
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
    marginBottom: Spacing.three,
  },
  sectionTitle: {
    color: NS.colors.text,
    ...NS.typography.headline,
    marginBottom: Spacing.two,
  },
  sectionHint: {
    color: NS.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: Spacing.three,
  },
  locationValue: {
    color: NS.colors.text,
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '700',
  },
  moodText: {
    color: NS.colors.accent,
    fontSize: 14,
    fontWeight: '600',
    marginTop: Spacing.two,
  },
  budgetPill: {
    backgroundColor: NS.colors.accentSoft,
    borderRadius: NS.radius.md,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
    marginBottom: Spacing.two,
  },
  budgetLabel: {
    color: NS.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  budgetValue: {
    color: NS.colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: NS.colors.border,
  },
  infoLabel: {
    color: NS.colors.textSecondary,
    fontSize: 14,
  },
  infoValue: {
    color: NS.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  budgetBreakdownWrap: {
    marginTop: Spacing.two,
  },
  conciergeCard: {
    padding: Spacing.four,
    marginBottom: Spacing.three,
    backgroundColor: NS.colors.accentSoft,
    borderColor: NS.colors.accentBorder,
  },
  conciergeLabel: {
    color: NS.colors.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: Spacing.two,
  },
  conciergeMessage: {
    color: NS.colors.text,
    fontSize: 16,
    lineHeight: 26,
    fontWeight: '600',
  },
  highlightList: {
    gap: Spacing.two,
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  highlightDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: NS.colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  highlightDotText: {
    color: NS.colors.accent,
    fontSize: 10,
    fontWeight: '800',
  },
  highlightText: {
    flex: 1,
    color: NS.colors.textSecondary,
    fontSize: 15,
    lineHeight: 24,
  },
  backupList: {
    gap: Spacing.two,
  },
  backupRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.md,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: NS.colors.border,
  },
  backupIcon: {
    fontSize: 16,
    marginTop: 2,
  },
  backupText: {
    flex: 1,
    color: NS.colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  emptyText: {
    color: NS.colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
  sharedAt: {
    color: NS.colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: Spacing.three,
  },
  notFoundIcon: {
    fontSize: 48,
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
  ctaButton: {
    alignSelf: 'center',
    backgroundColor: NS.colors.accent,
    borderRadius: NS.radius.pill,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.three + 2,
    marginBottom: Spacing.two,
  },
  ctaButtonText: {
    color: NS.colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
});
