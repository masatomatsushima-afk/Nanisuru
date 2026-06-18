import { router, useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { buildPlanDetails } from '@/lib/plan-details';
import { COMPANION_SUBTITLES, getItineraryEyebrow } from '@/lib/itineraries';
import { Colors, Spacing } from '@/constants/theme';
import type { CompanionOption, ItineraryItem } from '@/types/plan';
import { COMPANION_OPTIONS } from '@/types/plan';

const theme = Colors.dark;
const accent = '#818CF8';

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
        <Text style={styles.errorText}>プラン情報を読み込めませんでした</Text>
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
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>← 戻る</Text>
      </Pressable>

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>{getItineraryEyebrow(companion, location)}</Text>
        <Text style={styles.title}>プラン詳細</Text>
        <Text style={styles.subtitle}>{COMPANION_SUBTITLES[companion]}</Text>
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

      <DetailCard icon="✨" title="おすすめポイント">
        <BulletList items={planDetails.highlights} />
      </DetailCard>

      <DetailCard icon="☔" title="雨の日の代替案">
        <BulletList items={planDetails.rainyDayAlternatives} />
      </DetailCard>

      <View style={styles.timelinePreview}>
        <Text style={styles.timelinePreviewTitle}>スケジュール</Text>
        {items.map((item, index) => (
          <View key={`${item.time}-${item.activity}`} style={styles.previewRow}>
            <Text style={styles.previewTime}>{item.time}</Text>
            <Text style={styles.previewActivity}>{item.activity}</Text>
            {index < items.length - 1 && <View style={styles.previewDivider} />}
          </View>
        ))}
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
  eyebrow: {
    color: accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: Spacing.two,
  },
  title: {
    color: theme.text,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  subtitle: {
    color: theme.textSecondary,
    fontSize: 15,
    lineHeight: 24,
    marginTop: Spacing.two,
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
  statLabel: {
    color: theme.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: Spacing.two,
  },
  statValue: {
    color: theme.text,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 24,
  },
  detailCard: {
    backgroundColor: '#121214',
    borderRadius: 24,
    padding: Spacing.four,
    marginBottom: Spacing.three,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 8,
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
    color: theme.text,
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
    color: theme.textSecondary,
    fontSize: 15,
    lineHeight: 24,
  },
  timelinePreview: {
    backgroundColor: '#161618',
    borderRadius: 20,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: theme.backgroundSelected,
    marginTop: Spacing.one,
  },
  timelinePreviewTitle: {
    color: theme.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: Spacing.three,
  },
  previewRow: {
    paddingVertical: Spacing.two,
  },
  previewTime: {
    color: accent,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  previewActivity: {
    color: theme.text,
    fontSize: 16,
    fontWeight: '600',
  },
  previewDivider: {
    height: 1,
    backgroundColor: theme.backgroundSelected,
    marginTop: Spacing.two,
  },
  errorText: {
    color: theme.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    marginTop: Spacing.five,
  },
});
