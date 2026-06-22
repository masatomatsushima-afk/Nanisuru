import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COMPANION_SUBTITLES, getItineraryEyebrow, PERSONALITY_SUBTITLES } from '@/lib/itineraries';
import { buildPlanDetails } from '@/lib/plan-details';
import { ItineraryTimelineCard } from '@/components/itinerary-timeline-card';
import { Colors, Spacing } from '@/constants/theme';
import { parseCurrencyCode } from '@/constants/currency';
import type { CompanionOption, ItineraryItem, PersonalityOption } from '@/types/plan';
import { COMPANION_OPTIONS, PERSONALITY_OPTIONS } from '@/types/plan';

const theme = Colors.dark;
const accent = '#818CF8';

function formatTodayDate(): string {
  return new Date().toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
}

export default function TodayScheduleScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    location: string;
    budget: string;
    currency: string;
    people: string;
    mood: string;
    companion: string;
    personality: string;
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

  if (!companion || items.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + Spacing.four }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← 戻る</Text>
        </Pressable>
        <Text style={styles.errorText}>予定情報を読み込めませんでした</Text>
      </View>
    );
  }

  const planDetails =
    details ??
    buildPlanDetails({ location, budget, currency, people, mood, companion, items });

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
      <Pressable style={styles.backButton} onPress={() => router.replace('/')}>
        <Text style={styles.backButtonText}>← ホーム</Text>
      </Pressable>

      <View style={styles.hero}>
        <View style={styles.heroBadge}>
          <Text style={styles.heroBadgeText}>CONFIRMED</Text>
        </View>
        <Text style={styles.title}>今日の予定</Text>
        <Text style={styles.date}>{formatTodayDate()}</Text>
        <Text style={styles.subtitle}>{getItineraryEyebrow(companion, location)}</Text>
        {personality ? (
          <View style={styles.personalityBadge}>
            <Text style={styles.personalityBadgeText}>{personality}</Text>
          </View>
        ) : null}
        <Text style={styles.companionNote}>
          {personality ? PERSONALITY_SUBTITLES[personality] : COMPANION_SUBTITLES[companion]}
        </Text>
        <Text style={styles.companionSubnote}>{COMPANION_SUBTITLES[companion]}</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>💰</Text>
          <Text style={styles.statLabel}>合計予算</Text>
          <Text style={styles.statValue}>{planDetails.totalBudget}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>⏱</Text>
          <Text style={styles.statLabel}>所要時間</Text>
          <Text style={styles.statValue}>{planDetails.duration}</Text>
        </View>
      </View>

      <View style={styles.planCard}>
        <Text style={styles.planCardTitle}>プラン内容</Text>
        {planDetails.plannerMessage ? (
          <View style={styles.plannerMessageBox}>
            <Text style={styles.plannerMessageLabel}>プランナーより</Text>
            <Text style={styles.plannerMessageText}>{planDetails.plannerMessage}</Text>
          </View>
        ) : null}
        {items.map((item, index) => (
          <ItineraryTimelineCard
            key={`${item.time}-${item.activity}`}
            item={item}
            index={index}
            isLast={index === items.length - 1}
            variant="detail"
          />
        ))}
      </View>

      <View style={styles.footerNote}>
        <Text style={styles.footerNoteText}>素敵な1日をお過ごしください ✨</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0B',
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
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: Spacing.three,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.3)',
  },
  heroBadgeText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  title: {
    color: theme.text,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  date: {
    color: accent,
    fontSize: 16,
    fontWeight: '600',
    marginTop: Spacing.two,
  },
  subtitle: {
    color: theme.textSecondary,
    fontSize: 14,
    marginTop: Spacing.two,
  },
  companionNote: {
    color: theme.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    marginTop: Spacing.two,
  },
  companionSubnote: {
    color: theme.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 4,
    opacity: 0.85,
  },
  personalityBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(129, 140, 248, 0.15)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: Spacing.two,
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.3)',
  },
  personalityBadgeText: {
    color: accent,
    fontSize: 13,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.four,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#121214',
    borderRadius: 20,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  },
  statIcon: {
    fontSize: 20,
    marginBottom: Spacing.two,
  },
  statLabel: {
    color: theme.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  statValue: {
    color: theme.text,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
  },
  planCard: {
    backgroundColor: '#121214',
    borderRadius: 24,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 8,
  },
  planCardTitle: {
    color: theme.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: Spacing.three,
  },
  plannerMessageBox: {
    backgroundColor: 'rgba(129, 140, 248, 0.08)',
    borderRadius: 14,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.18)',
    marginBottom: Spacing.three,
  },
  plannerMessageLabel: {
    color: accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  plannerMessageText: {
    color: theme.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  footerNote: {
    marginTop: Spacing.four,
    alignItems: 'center',
    paddingVertical: Spacing.three,
  },
  footerNoteText: {
    color: theme.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  errorText: {
    color: theme.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    marginTop: Spacing.five,
  },
});
