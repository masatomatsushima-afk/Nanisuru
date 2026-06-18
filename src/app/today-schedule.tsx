import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COMPANION_SUBTITLES, getItineraryEyebrow } from '@/lib/itineraries';
import { buildPlanDetails } from '@/lib/plan-details';
import { Colors, Spacing } from '@/constants/theme';
import type { CompanionOption, ItineraryItem } from '@/types/plan';
import { COMPANION_OPTIONS } from '@/types/plan';

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
    people: string;
    mood: string;
    companion: string;
    items: string;
    details: string;
  }>();

  const companion = COMPANION_OPTIONS.includes(params.companion as CompanionOption)
    ? (params.companion as CompanionOption)
    : null;

  let items: ItineraryItem[] = [];
  try {
    items = params.items ? JSON.parse(params.items) : [];
  } catch {
    items = [];
  }

  const location = params.location ?? '';
  const budget = params.budget ?? '';
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
    buildPlanDetails({ location, budget, people, mood, companion, items });

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
        <Text style={styles.companionNote}>{COMPANION_SUBTITLES[companion]}</Text>
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
        {items.map((item, index) => (
          <View key={`${item.time}-${item.activity}`} style={styles.planRow}>
            <View style={styles.planTimeBadge}>
              <Text style={styles.planTime}>{item.time}</Text>
            </View>
            <View style={styles.planActivityWrap}>
              <Text style={styles.planActivity}>{item.activity}</Text>
              {index < items.length - 1 && <View style={styles.planDivider} />}
            </View>
          </View>
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
    fontSize: 13,
    lineHeight: 20,
    marginTop: 4,
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
  planRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'flex-start',
  },
  planTimeBadge: {
    backgroundColor: 'rgba(129, 140, 248, 0.15)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 58,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.25)',
  },
  planTime: {
    color: accent,
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  planActivityWrap: {
    flex: 1,
    paddingBottom: Spacing.two,
  },
  planActivity: {
    color: theme.text,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
    paddingTop: 4,
  },
  planDivider: {
    height: 1,
    backgroundColor: theme.backgroundSelected,
    marginTop: Spacing.three,
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
