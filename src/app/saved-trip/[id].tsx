import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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
import { CurrentLocationButton } from '@/components/current-location-button';
import { PublishPlanSheet } from '@/components/publish-plan-sheet';
import { PrimaryButton } from '@/components/ui/premium-card';
import { WeatherSection } from '@/components/weather-section';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { COMPANION_SUBTITLES, PERSONALITY_SUBTITLES } from '@/lib/itineraries';
import { formatSavedTripDate, formatTripSchedule, getTripById } from '@/lib/saved-trips';
import { ShareTripSection } from '@/components/share-trip-section';
import { getPublishedPlanForTrip } from '@/lib/public-plans';
import { buildActiveTripContext, saveActiveTrip } from '@/lib/active-trip';

import type { SavedTrip } from '@/types/trip';
import type { PublicPlan } from '@/types/public-plan';

const accent = NS.colors.accent;

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function SavedTripDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, isLoading: authLoading } = useAuth();
  const [trip, setTrip] = useState<SavedTrip | null>(null);
  const [publishedPlan, setPublishedPlan] = useState<PublicPlan | null>(null);
  const [showPublishSheet, setShowPublishSheet] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTrip = useCallback(async () => {
    if (!id || !session) return;

    setIsLoading(true);
    setError(null);
    try {
      const loaded = await getTripById(id);
      if (!loaded) {
        setError('プランが見つかりませんでした');
        setTrip(null);
        return;
      }
      setTrip(loaded);
      setPublishedPlan(await getPublishedPlanForTrip(loaded.id));
      await saveActiveTrip(
        buildActiveTripContext({
          location: loaded.payload.location,
          budget: loaded.payload.budget,
          currency: loaded.payload.currency,
          people: loaded.payload.people,
          mood: loaded.payload.mood,
          companion: loaded.payload.companion,
          personality: loaded.payload.personality,
          tripDuration: loaded.payload.tripDuration,
          days: loaded.payload.days,
          details: loaded.payload.details,
        }),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'プランの読み込みに失敗しました';
      setError(message);
      setTrip(null);
    } finally {
      setIsLoading(false);
    }
  }, [id, session]);

  useEffect(() => {
    if (authLoading) return;

    if (!session) {
      router.replace('/login');
      return;
    }

    loadTrip();
  }, [authLoading, session, loadTrip]);

  if (authLoading || isLoading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={accent} />
        <Text style={styles.loadingText}>プランを読み込み中...</Text>
      </View>
    );
  }

  if (error || !trip) {
    return (
      <View style={[styles.centered, styles.container, { paddingTop: insets.top + Spacing.four }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← 戻る</Text>
        </Pressable>
        <Text style={styles.errorText}>{error ?? 'プランが見つかりませんでした'}</Text>
        <Pressable onPress={() => router.replace('/favorites')}>
          <Text style={styles.linkText}>保存済みプラン一覧へ</Text>
        </Pressable>
      </View>
    );
  }

  const { payload } = trip;
  const { details } = payload;
  const days = payload.days?.length > 0 ? payload.days : [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + Spacing.three,
          paddingBottom: insets.bottom + Spacing.five,
        },
      ]}
      showsVerticalScrollIndicator={false}>
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>← 保存済みプラン</Text>
      </Pressable>

      <View style={styles.hero}>
        <View style={styles.savedBadge}>
          <Text style={styles.savedBadgeText}>保存済みプラン</Text>
        </View>
        <Text style={styles.title}>{trip.title}</Text>
        <View style={styles.tagRow}>
          <View style={styles.tag}>
            <Text style={styles.tagText}>{payload.personality}</Text>
          </View>
          <View style={styles.tag}>
            <Text style={styles.tagText}>{payload.companion}</Text>
          </View>
          <View style={styles.tagMuted}>
            <Text style={styles.tagMutedText}>{payload.tripDuration}</Text>
          </View>
        </View>
        <Text style={styles.subtitle}>{PERSONALITY_SUBTITLES[payload.personality]}</Text>
        <Text style={styles.companionNote}>{COMPANION_SUBTITLES[payload.companion]}</Text>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>📍 場所</Text>
        <Text style={styles.sectionBody}>{payload.location.trim() || '未指定'}</Text>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>📅 日程</Text>
        <Text style={styles.sectionBody}>{formatTripSchedule(trip)}</Text>
        {payload.mood ? (
          <Text style={styles.moodText}>気分：{payload.mood}</Text>
        ) : null}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>💰 予算</Text>
        <View style={styles.budgetHero}>
          <Text style={styles.budgetLabel}>合計予算</Text>
          <Text style={styles.budgetValue}>{details.totalBudget}</Text>
        </View>
        {payload.budget ? (
          <InfoRow label="入力予算" value={`${payload.budget} ${payload.currency}`} />
        ) : null}
        {payload.people ? <InfoRow label="人数" value={`${payload.people}人`} /> : null}
        {details.budgetBreakdown ? (
          <View style={styles.budgetBreakdownWrap}>
            <BudgetBreakdownSection breakdown={details.budgetBreakdown} compact />
          </View>
        ) : null}
      </View>

      {details.weather ? (
        <View style={styles.weatherWrap}>
          <WeatherSection weather={details.weather} />
        </View>
      ) : null}

      {details.conciergeAnalysis ? (
        <View style={styles.analysisWrap}>
          <ConciergeAnalysisSection analysis={details.conciergeAnalysis} />
        </View>
      ) : null}

      {details.plannerMessage ? (
        <View style={styles.plannerCard}>
          <Text style={styles.plannerLabel}>プランナーより</Text>
          <Text style={styles.plannerText}>{details.plannerMessage}</Text>
        </View>
      ) : null}

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>🗓 行程</Text>
        {days.length > 0 ? (
          <>
            <CurrentLocationButton compact />
            <ItineraryDaysView days={days} variant="detail" location={payload.location} />
          </>
        ) : (
          <Text style={styles.emptySectionText}>行程データがありません</Text>
        )}
      </View>

      {details.aiAdvice ? (
        <View style={styles.adviceWrap}>
          <AiAdviceSection advice={details.aiAdvice} />
        </View>
      ) : null}

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>🎫 予約・アクセス</Text>
        {days.length > 0 ? (
          <ConciergeAccessSection days={days} location={payload.location} compact />
        ) : (
          <Text style={styles.emptySectionText}>予約・アクセス情報がありません</Text>
        )}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>🌍 コミュニティ公開</Text>
        <Text style={styles.publishLead}>
          発見タブに投稿して、他のユーザーとプランを共有できます。
        </Text>
        {publishedPlan?.visibility === 'public' ? (
          <Text style={styles.publishStatus}>公開中 · ♥ {publishedPlan.likeCount}</Text>
        ) : publishedPlan ? (
          <Text style={styles.publishStatusMuted}>
            {publishedPlan.visibility === 'unlisted' ? 'リンクのみ公開中' : '非公開'}
          </Text>
        ) : null}
        <PrimaryButton
          label="このプランを公開する"
          onPress={() => setShowPublishSheet(true)}
        />
        {publishedPlan?.visibility === 'public' ? (
          <Pressable
            style={styles.viewPublicLink}
            onPress={() => router.push(`/public-plan/${publishedPlan.id}`)}>
            <Text style={styles.viewPublicLinkText}>公開ページを見る →</Text>
          </Pressable>
        ) : null}
      </View>

      <PublishPlanSheet
        visible={showPublishSheet}
        trip={trip}
        onClose={() => setShowPublishSheet(false)}
        onPublished={() => {
          void getPublishedPlanForTrip(trip.id).then(setPublishedPlan);
        }}
      />

      <View style={styles.shareWrap}>
        <ShareTripSection
          location={payload.location}
          budget={payload.budget}
          currency={payload.currency}
          people={payload.people}
          mood={payload.mood}
          companion={payload.companion}
          personality={payload.personality}
          tripDuration={payload.tripDuration}
          days={days}
          items={payload.items}
          details={details}
        />
      </View>

      <View style={styles.footerMeta}>
        <Text style={styles.footerMetaText}>
          保存日: {formatSavedTripDate(trip.createdAt)}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NS.colors.bg,
  },
  centered: {
    flex: 1,
    backgroundColor: NS.colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  content: {
    paddingHorizontal: Spacing.four,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  loadingText: {
    color: NS.colors.textSecondary,
    marginTop: Spacing.three,
    fontSize: 14,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.two,
    paddingRight: Spacing.three,
    marginBottom: Spacing.two,
  },
  backButtonText: {
    color: accent,
    fontSize: 16,
    fontWeight: '600',
  },
  hero: {
    marginBottom: Spacing.four,
  },
  savedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: NS.colors.accentSoft,
    borderRadius: NS.radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
    marginBottom: Spacing.two,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
  },
  savedBadgeText: {
    color: accent,
    fontSize: 12,
    fontWeight: '800',
  },
  title: {
    color: NS.colors.text,
    ...NS.typography.title,
    marginBottom: Spacing.three,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  tag: {
    backgroundColor: NS.colors.accentSoft,
    borderRadius: NS.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
  },
  tagText: {
    color: accent,
    fontSize: 11,
    fontWeight: '700',
  },
  tagMuted: {
    backgroundColor: NS.colors.bgCard,
    borderRadius: NS.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: NS.colors.border,
  },
  tagMutedText: {
    color: NS.colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  subtitle: {
    color: NS.colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  companionNote: {
    color: NS.colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 4,
  },
  sectionCard: {
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.lg,
    borderWidth: 1,
    borderColor: NS.colors.border,
    padding: Spacing.four,
    marginBottom: Spacing.three,
    ...NS.shadow.card,
  },
  sectionTitle: {
    color: NS.colors.text,
    ...NS.typography.headline,
    marginBottom: Spacing.three,
  },
  sectionBody: {
    color: NS.colors.textSecondary,
    ...NS.typography.bodySm,
    lineHeight: 24,
  },
  moodText: {
    color: accent,
    fontSize: 14,
    fontWeight: '600',
    marginTop: Spacing.two,
  },
  budgetHero: {
    backgroundColor: NS.colors.bgCard,
    borderRadius: NS.radius.md,
    padding: Spacing.three,
    marginBottom: Spacing.three,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
  },
  budgetLabel: {
    color: NS.colors.textMuted,
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
  weatherWrap: {
    marginBottom: Spacing.three,
  },
  analysisWrap: {
    marginBottom: Spacing.three,
  },
  plannerCard: {
    backgroundColor: NS.colors.accentSoft,
    borderRadius: NS.radius.md,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
    marginBottom: Spacing.three,
  },
  plannerLabel: {
    color: accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: Spacing.two,
  },
  plannerText: {
    color: NS.colors.textSecondary,
    fontSize: 15,
    lineHeight: 24,
  },
  adviceWrap: {
    marginBottom: Spacing.three,
  },
  emptySectionText: {
    color: NS.colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
  shareWrap: {
    marginBottom: Spacing.three,
  },
  publishLead: {
    color: NS.colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: Spacing.three,
  },
  publishStatus: {
    color: NS.colors.accent,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: Spacing.two,
  },
  publishStatusMuted: {
    color: NS.colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: Spacing.two,
  },
  viewPublicLink: {
    marginTop: Spacing.three,
    alignSelf: 'flex-start',
  },
  viewPublicLinkText: {
    color: NS.colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  footerMeta: {
    alignItems: 'center',
    paddingVertical: Spacing.four,
  },
  footerMetaText: {
    color: NS.colors.textMuted,
    fontSize: 12,
  },
  errorText: {
    color: NS.colors.danger,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: Spacing.three,
    lineHeight: 24,
  },
  linkText: {
    color: accent,
    fontSize: 15,
    fontWeight: '700',
  },
});
