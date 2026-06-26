import { router, useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { buildPlanDetails } from '@/lib/plan-details';
import { COMPANION_SUBTITLES, getItineraryEyebrow, PERSONALITY_SUBTITLES } from '@/lib/itineraries';
import { AddTripSecretaryFolderButton } from '@/components/add-trip-secretary-folder-button';
import { AiAdviceSection } from '@/components/ai-advice-section';
import { BudgetBreakdownSection } from '@/components/budget-breakdown-section';
import { ConciergeAccessSection } from '@/components/concierge-access-section';
import { TourExperienceSection } from '@/components/tour-experience-section';
import { ConciergeAnalysisSection } from '@/components/concierge-analysis-section';
import { WeatherSection } from '@/components/weather-section';
import { OutfitPackingSection } from '@/components/outfit-packing-section';
import { generateOutfitPackingAdvice } from '@/lib/outfit-packing-advice';
import { ShareTripSection } from '@/components/share-trip-section';
import { SaveTripButton } from '@/components/save-trip-button';
import { AfterPlanLaunchButton } from '@/components/after-plan-launch-button';
import { ItineraryDaysView } from '@/components/itinerary-days-view';
import { ItineraryItemEditSheet } from '@/components/itinerary-item-edit-sheet';
import { CurrentLocationButton } from '@/components/current-location-button';
import { Spacing } from '@/constants/theme';
import { NS } from '@/constants/nanisuru-ui';
import { parseCurrencyCode } from '@/constants/currency';
import { applyPartialEditResult } from '@/lib/itinerary-partial-edit';
import { parseItineraryDays, isTripDurationOption } from '@/lib/trip-duration';
import type { ItineraryEditTarget, PartialItineraryEditResult } from '@/types/itinerary-edit';
import type { CompanionOption, ItineraryItem, PersonalityOption, PlanDetails, TripDurationOption } from '@/types/plan';
import { COMPANION_OPTIONS, isDateRelatedCompanion, PERSONALITY_OPTIONS } from '@/types/plan';
import type { SavedTripPayload } from '@/types/trip';

const accent = NS.colors.accent;

function DetailCard({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.detailCard}>
      <View style={styles.detailCardHeader}>
        <Text style={styles.detailCardIcon}>{icon}</Text>
        <Text style={styles.detailCardTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <View style={styles.bulletList}>
      {items.map((item) => (
        <View key={item} style={styles.bulletRow}>
          <View style={styles.bulletDot} />
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

export default function PlanDetailScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    location: string;
    budget: string;
    currency: string;
    people: string;
    mood: string;
    companion: string;
    personality: string;
    tripDuration: string;
    days: string;
    items: string;
    details: string;
  }>();

  const companion = COMPANION_OPTIONS.includes(params.companion as CompanionOption)
    ? (params.companion as CompanionOption)
    : null;

  const personality = PERSONALITY_OPTIONS.includes(params.personality as PersonalityOption)
    ? (params.personality as PersonalityOption)
    : null;

  let items: ItineraryItem[] = [];
  try {
    items = params.items ? JSON.parse(params.items) : [];
  } catch {
    items = [];
  }

  const location = params.location ?? '';
  const budget = params.budget ?? '';
  const currency = parseCurrencyCode(params.currency);
  const people = params.people ?? '';
  const mood = params.mood ?? '';

  let details = null;
  try {
    details = params.details ? JSON.parse(params.details) : null;
  } catch {
    details = null;
  }

  const parsedDays = parseItineraryDays(params.days, items);
  const [days, setDays] = useState(parsedDays);
  const [localItems, setLocalItems] = useState(items);
  const [editTarget, setEditTarget] = useState<ItineraryEditTarget | null>(null);
  const [showEditSheet, setShowEditSheet] = useState(false);
  const [editDetails, setEditDetails] = useState<PlanDetails | null>(details);
  const tripDuration = isTripDurationOption(params.tripDuration ?? '')
    ? (params.tripDuration as TripDurationOption)
    : details?.tripDuration ?? '1日';

  const planDetails =
    editDetails ??
    details ??
    buildPlanDetails({
      location,
      budget,
      currency,
      people,
      mood,
      companion: companion ?? '一人',
      items: localItems,
    });

  const handleApplyEdit = async (result: PartialItineraryEditResult, _editRequest: string) => {
    const basePayload: SavedTripPayload = {
      location,
      budget,
      currency,
      people,
      mood,
      companion: companion!,
      personality: personality ?? 'のんびり',
      tripDuration,
      days,
      items: localItems,
      details: planDetails,
    };
    const nextPayload = applyPartialEditResult(basePayload, result);
    setDays(nextPayload.days);
    setLocalItems(nextPayload.items);
    setEditDetails(nextPayload.details);
  };

  if (!companion || days.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + Spacing.four }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← 戻る</Text>
        </Pressable>
        <Text style={styles.errorText}>プラン情報を読み込めませんでした</Text>
      </View>
    );
  }

  const planPayload: SavedTripPayload = {
    location,
    budget,
    currency,
    people,
    mood,
    companion,
    personality: personality ?? 'のんびり',
    tripDuration,
    days,
    items: localItems,
    details: planDetails,
  };

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
        <Text style={styles.backButtonText}>← 戻る</Text>
      </Pressable>

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>{getItineraryEyebrow(companion, location)}</Text>
        <Text style={styles.title}>プラン詳細</Text>
        {personality ? (
          <View style={styles.personalityBadge}>
            <Text style={styles.personalityBadgeText}>{personality}</Text>
          </View>
        ) : null}
        <View style={styles.durationBadge}>
          <Text style={styles.durationBadgeText}>{tripDuration}</Text>
        </View>
        <Text style={styles.subtitle}>
          {personality ? PERSONALITY_SUBTITLES[personality] : COMPANION_SUBTITLES[companion]}
        </Text>
        <Text style={styles.companionNote}>{COMPANION_SUBTITLES[companion]}</Text>
        {mood ? <Text style={styles.moodText}>気分：{mood}</Text> : null}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>合計予算</Text>
          <Text style={styles.statValue}>{planDetails.totalBudget}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>所要時間</Text>
          <Text style={styles.statValue}>{planDetails.duration}</Text>
        </View>
      </View>

      {planDetails.budgetBreakdown ? (
        <BudgetBreakdownSection breakdown={planDetails.budgetBreakdown} />
      ) : null}

      {planDetails.conciergeAnalysis ? (
        <ConciergeAnalysisSection analysis={planDetails.conciergeAnalysis} />
      ) : null}

      {planDetails.weather ? <WeatherSection weather={planDetails.weather} /> : null}

      {planDetails.outfitAdvice ? (
        <OutfitPackingSection advice={planDetails.outfitAdvice} />
      ) : planDetails.weather ? (
        <OutfitPackingSection
          advice={generateOutfitPackingAdvice({
            days,
            weather: planDetails.weather,
            location,
            companion,
            dayCount: days.length,
            tripDate: planDetails.tripDate,
          })}
        />
      ) : null}

      <DetailCard icon="✨" title="おすすめポイント">
        <BulletList items={planDetails.highlights} />
      </DetailCard>

      <DetailCard icon="☔" title="天候変化時のバックアップ">
        <BulletList items={planDetails.rainyDayAlternatives} />
      </DetailCard>

      {planDetails.plannerMessage ? (
        <View style={styles.plannerCard}>
          <Text style={styles.plannerCardLabel}>プランナーより</Text>
          <Text style={styles.plannerCardText}>{planDetails.plannerMessage}</Text>
        </View>
      ) : null}

      <View style={styles.timelinePreview}>
        <Text style={styles.timelinePreviewTitle}>スケジュール</Text>
        <AfterPlanLaunchButton location={location} />
        <CurrentLocationButton compact />
        <ItineraryDaysView
          days={days}
          variant="detail"
          location={location}
          editable
          onEditItem={(target) => {
            setEditTarget(target);
            setShowEditSheet(true);
          }}
          transportContext={{
            location,
            weather: planDetails.weather,
            travelTiming: planDetails.travelTiming,
            companion,
            budget,
          }}
        />
      </View>

      <ConciergeAccessSection
        days={days}
        location={location}
        transportContext={{
          location,
          weather: planDetails.weather,
          travelTiming: planDetails.travelTiming,
          companion,
          budget,
        }}
      />

      {days.length >= 2 ? (
        <TourExperienceSection
          destination={location}
          tourSuggestions={planDetails.tourSuggestions}
        />
      ) : null}

      {isDateRelatedCompanion(companion) && planDetails.aiAdvice ? (
        <AiAdviceSection advice={planDetails.aiAdvice} />
      ) : null}

      {personality && tripDuration ? (
        <View style={styles.actionButtons}>
          <View style={styles.shareButtonWrap}>
            <SaveTripButton
              location={location}
              budget={budget}
              currency={currency}
              people={people}
              mood={mood}
              companion={companion}
              personality={personality}
              tripDuration={tripDuration}
              days={days}
              items={localItems}
              details={planDetails}
            />
          </View>
          <View style={styles.shareButtonWrap}>
            <AddTripSecretaryFolderButton variant="plan-payload" payload={planPayload} />
          </View>
          <View style={styles.shareButtonWrap}>
            <ShareTripSection
              location={location}
              budget={budget}
              currency={currency}
              people={people}
              mood={mood}
              companion={companion}
              personality={personality}
              tripDuration={tripDuration}
              days={days}
              items={localItems}
              details={planDetails}
            />
          </View>
        </View>
      ) : null}

      <ItineraryItemEditSheet
        visible={showEditSheet}
        target={editTarget}
        payload={planPayload}
        onClose={() => {
          setShowEditSheet(false);
          setEditTarget(null);
        }}
        onApply={handleApplyEdit}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NS.colors.bg,
  },
  content: {
    paddingHorizontal: Spacing.four,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
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
  eyebrow: {
    color: accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: Spacing.two,
  },
  title: {
    color: NS.colors.text,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  subtitle: {
    color: NS.colors.textSecondary,
    fontSize: 15,
    lineHeight: 24,
    marginTop: Spacing.two,
  },
  personalityBadge: {
    alignSelf: 'flex-start',
    backgroundColor: NS.colors.purpleSoft,
    borderRadius: NS.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: Spacing.two,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.35)',
  },
  personalityBadgeText: {
    color: accent,
    fontSize: 13,
    fontWeight: '700',
  },
  durationBadge: {
    alignSelf: 'flex-start',
    backgroundColor: NS.colors.bgCard,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: Spacing.two,
    borderWidth: 1,
    borderColor: NS.colors.border,
  },
  durationBadgeText: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  companionNote: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 4,
  },
  moodText: {
    color: accent,
    fontSize: 14,
    fontWeight: '600',
    marginTop: Spacing.two,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  statCard: {
    flex: 1,
    backgroundColor: NS.colors.bgCard,
    borderRadius: NS.radius.lg,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: NS.colors.border,
    ...NS.shadow.card,
  },
  statLabel: {
    color: NS.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: Spacing.two,
  },
  statValue: {
    color: NS.colors.text,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 24,
  },
  detailCard: {
    backgroundColor: NS.colors.bgCard,
    borderRadius: NS.radius.xl,
    padding: Spacing.four,
    marginBottom: Spacing.three,
    borderWidth: 1,
    borderColor: NS.colors.border,
    ...NS.shadow.card,
  },
  detailCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  detailCardIcon: {
    fontSize: 20,
  },
  detailCardTitle: {
    color: NS.colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  bulletList: {
    gap: Spacing.two,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: accent,
    marginTop: 8,
  },
  bulletText: {
    flex: 1,
    color: NS.colors.textSecondary,
    fontSize: 15,
    lineHeight: 24,
  },
  timelinePreview: {
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.lg,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: NS.colors.border,
    marginTop: Spacing.one,
  },
  timelinePreviewTitle: {
    color: NS.colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: Spacing.three,
  },
  plannerCard: {
    backgroundColor: NS.colors.skySoft,
    borderRadius: NS.radius.md,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.28)',
    marginBottom: Spacing.three,
  },
  plannerCardLabel: {
    color: accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: Spacing.two,
  },
  plannerCardText: {
    color: NS.colors.textSecondary,
    fontSize: 15,
    lineHeight: 24,
  },
  errorText: {
    color: NS.colors.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    marginTop: Spacing.five,
  },
  actionButtons: {
    gap: Spacing.three,
    marginTop: Spacing.four,
  },
  shareButtonWrap: {
    marginTop: Spacing.four,
    marginBottom: Spacing.two,
  },
});
