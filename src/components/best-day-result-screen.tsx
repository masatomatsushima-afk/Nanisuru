import type { ReactNode } from 'react';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BudgetBreakdownSection } from '@/components/budget-breakdown-section';
import { ItineraryDaysView } from '@/components/itinerary-days-view';
import { CurrentLocationButton } from '@/components/current-location-button';
import { PlanRatingSection } from '@/components/plan-rating-section';
import { SaveTripButton } from '@/components/save-trip-button';
import { PlacesNoticeBanner } from '@/components/places-notice-banner';
import { FadeInView } from '@/components/ui/fade-in-view';
import { PremiumCard } from '@/components/ui/premium-card';
import type { CurrencyCode } from '@/constants/currency';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { formatThemeQuote } from '@/lib/best-day-presentation';
import type { BestDayPresentation } from '@/lib/best-day-presentation';
import { getBestDayTripDuration } from '@/lib/best-day';
import { linkPlanRatingToTrip } from '@/lib/plan-rating';
import type { BestDayMoodOption, BestDayTimeOption } from '@/types/best-day';
import type { CompanionOption, ItineraryDay, ItineraryItem, PersonalityOption, PlanDetails } from '@/types/plan';
import type { PlanRatingContext } from '@/types/plan-rating';
import type { SavedTrip } from '@/types/trip';
import { BEST_DAY_MOOD_EMOJI, BEST_DAY_TIME_EMOJI } from '@/types/best-day';

const fireAccent = '#F97316';
const fireSoft = 'rgba(249, 115, 22, 0.12)';
const fireBorder = 'rgba(249, 115, 22, 0.35)';

type BestDayResultScreenProps = {
  location: string;
  budget: string;
  currency: CurrencyCode;
  people: string;
  mood: BestDayMoodOption;
  availableTime: BestDayTimeOption;
  companion: CompanionOption;
  personality: PersonalityOption;
  days: ItineraryDay[];
  items: ItineraryItem[];
  planDetails: PlanDetails;
  presentation: BestDayPresentation;
  usedTravelMemory?: boolean;
  placesNotice?: string;
};

function SectionCard({
  icon,
  title,
  children,
  delay = 0,
  variant = 'default',
  accentBorder: useAccentBorder = false,
}: {
  icon: string;
  title: string;
  children: ReactNode;
  delay?: number;
  variant?: 'default' | 'accent' | 'flat';
  accentBorder?: boolean;
}) {
  return (
    <FadeInView delay={delay}>
      <PremiumCard
        variant={variant}
        style={
          useAccentBorder
            ? { ...styles.sectionCard, ...styles.sectionCardAccent }
            : styles.sectionCard
        }>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconWrap}>
            <Text style={styles.sectionIcon}>{icon}</Text>
          </View>
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        {children}
      </PremiumCard>
    </FadeInView>
  );
}

function MetaChip({ emoji, label }: { emoji: string; label: string }) {
  return (
    <View style={styles.metaChip}>
      <Text style={styles.metaChipEmoji}>{emoji}</Text>
      <Text style={styles.metaChipLabel}>{label}</Text>
    </View>
  );
}

export function BestDayResultScreen({
  location,
  budget,
  currency,
  people,
  mood,
  availableTime,
  companion,
  personality,
  days,
  items,
  planDetails,
  presentation,
  usedTravelMemory = false,
  placesNotice,
}: BestDayResultScreenProps) {
  const themeQuote = formatThemeQuote(presentation.theme);
  const tripDuration = planDetails.tripDuration ?? getBestDayTripDuration(availableTime);
  const [savedTripId, setSavedTripId] = useState<string | null>(null);
  const [pendingRatingId, setPendingRatingId] = useState<string | null>(null);

  const ratingContext: PlanRatingContext = {
    source: 'best-day',
    location,
    budget,
    currency,
    people,
    mood,
    companion,
    personality,
    tripDuration,
    days,
    items,
    details: planDetails,
  };

  const handleTripSaved = (trip: SavedTrip) => {
    setSavedTripId(trip.id);
    if (pendingRatingId) {
      void linkPlanRatingToTrip(pendingRatingId, trip.id);
    }
  };

  return (
    <View style={styles.wrap}>
      <FadeInView>
        <View style={styles.hero}>
          <View style={styles.heroGlowOuter} />
          <View style={styles.heroGlowInner} />
          <Text style={styles.heroEyebrow}>PREMIUM AI CONCIERGE</Text>
          <Text style={styles.heroTitle}>🔥 最高の1日</Text>
          <Text style={styles.heroLocation}>📍 {location}</Text>
          <View style={styles.metaRow}>
            <MetaChip emoji={BEST_DAY_MOOD_EMOJI[mood]} label={mood} />
            <MetaChip emoji={BEST_DAY_TIME_EMOJI[availableTime]} label={availableTime} />
            <MetaChip emoji="👥" label={`${people}人`} />
          </View>
          {usedTravelMemory ? (
            <View style={styles.memoryBadge}>
              <Text style={styles.memoryBadgeText}>💾 旅行メモリーを反映しました</Text>
            </View>
          ) : null}
        </View>
      </FadeInView>

      {placesNotice ? (
        <FadeInView delay={40}>
          <PlacesNoticeBanner message={placesNotice} />
        </FadeInView>
      ) : null}

      <SectionCard icon="🎭" title="今日のテーマ" delay={80} variant="accent" accentBorder>
        <Text style={styles.themeQuote}>{themeQuote}</Text>
      </SectionCard>

      {presentation.whyThisPlan ? (
        <SectionCard icon="✨" title="このプランを選んだ理由" delay={160}>
          <Text style={styles.bodyText}>{presentation.whyThisPlan}</Text>
        </SectionCard>
      ) : null}

      {presentation.conciergeMessage ? (
        <FadeInView delay={240}>
          <View style={styles.conciergeBubbleWrap}>
            <View style={styles.conciergeAvatar}>
              <Text style={styles.conciergeAvatarEmoji}>🤖</Text>
            </View>
            <PremiumCard style={styles.conciergeBubble}>
              <Text style={styles.conciergeLabel}>AIコンシェルジュから一言</Text>
              <Text style={styles.conciergeMessage}>{presentation.conciergeMessage}</Text>
            </PremiumCard>
          </View>
        </FadeInView>
      ) : null}

      {presentation.highlights.length > 0 ? (
        <SectionCard icon="⭐" title="今日のハイライト" delay={320}>
          <View style={styles.highlightList}>
            {presentation.highlights.map((highlight, index) => (
              <View key={`${highlight}-${index}`} style={styles.highlightRow}>
                <View style={styles.highlightDot}>
                  <Text style={styles.highlightDotText}>✦</Text>
                </View>
                <Text style={styles.highlightText}>{highlight}</Text>
              </View>
            ))}
          </View>
        </SectionCard>
      ) : null}

      <SectionCard icon="📅" title="タイムライン" delay={400}>
        {days.length > 0 ? (
          <>
            <CurrentLocationButton compact />
            <ItineraryDaysView days={days} variant="detail" location={location} />
          </>
        ) : (
          <Text style={styles.emptyText}>タイムラインがありません</Text>
        )}
      </SectionCard>

      {planDetails.budgetBreakdown ? (
        <FadeInView delay={480}>
          <BudgetBreakdownSection breakdown={planDetails.budgetBreakdown} />
        </FadeInView>
      ) : planDetails.totalBudget ? (
        <SectionCard icon="💰" title="予算内訳" delay={480}>
          <Text style={styles.budgetTotal}>{planDetails.totalBudget}</Text>
        </SectionCard>
      ) : null}

      <FadeInView delay={520}>
        <PlanRatingSection
          context={ratingContext}
          savedTripId={savedTripId}
          onRated={setPendingRatingId}
        />
      </FadeInView>

      <FadeInView delay={560}>
        <View style={styles.saveWrap}>
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
            items={items}
            details={planDetails}
            onSaved={handleTripSaved}
          />
        </View>
      </FadeInView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 0,
  },
  hero: {
    alignItems: 'center',
    paddingVertical: Spacing.five,
    marginBottom: Spacing.three,
    overflow: 'hidden',
  },
  heroGlowOuter: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(249, 115, 22, 0.06)',
    top: -60,
  },
  heroGlowInner: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
    top: 10,
  },
  heroEyebrow: {
    color: fireAccent,
    ...NS.typography.eyebrow,
    marginBottom: Spacing.two,
  },
  heroTitle: {
    color: NS.colors.text,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.6,
    marginBottom: Spacing.one,
  },
  heroLocation: {
    color: NS.colors.textSecondary,
    fontSize: 15,
    marginBottom: Spacing.three,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: NS.colors.bgCard,
    borderRadius: NS.radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderWidth: 1,
    borderColor: NS.colors.border,
  },
  metaChipEmoji: { fontSize: 14 },
  metaChipLabel: {
    color: NS.colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  memoryBadge: {
    marginTop: Spacing.three,
    backgroundColor: fireSoft,
    borderRadius: NS.radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderWidth: 1,
    borderColor: fireBorder,
  },
  memoryBadgeText: {
    color: fireAccent,
    fontSize: 12,
    fontWeight: '700',
  },
  sectionCard: {
    padding: Spacing.four,
    marginBottom: Spacing.three,
  },
  sectionCardAccent: {
    borderColor: fireBorder,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  sectionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: fireSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionIcon: { fontSize: 18 },
  sectionTitle: {
    color: NS.colors.text,
    ...NS.typography.headline,
    flex: 1,
  },
  themeQuote: {
    color: NS.colors.text,
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 36,
    letterSpacing: -0.3,
  },
  bodyText: {
    color: NS.colors.textSecondary,
    fontSize: 15,
    lineHeight: 26,
  },
  conciergeBubbleWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    marginBottom: Spacing.three,
  },
  conciergeAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: NS.colors.bgCard,
    borderWidth: 1,
    borderColor: NS.colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  conciergeAvatarEmoji: { fontSize: 22 },
  conciergeBubble: {
    flex: 1,
    padding: Spacing.four,
    borderColor: 'rgba(129, 140, 248, 0.25)',
  },
  conciergeLabel: {
    color: NS.colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: Spacing.two,
    textTransform: 'uppercase',
  },
  conciergeMessage: {
    color: NS.colors.text,
    fontSize: 16,
    lineHeight: 26,
    fontWeight: '600',
    fontStyle: 'italic',
  },
  highlightList: { gap: Spacing.two },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.md,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: NS.colors.border,
  },
  highlightDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: fireSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  highlightDotText: {
    color: fireAccent,
    fontSize: 10,
    fontWeight: '800',
  },
  highlightText: {
    flex: 1,
    color: NS.colors.text,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  budgetTotal: {
    color: NS.colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  emptyText: { color: NS.colors.textMuted, fontSize: 14 },
  saveWrap: { marginTop: Spacing.two, marginBottom: Spacing.four },
});
