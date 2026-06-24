import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LoginPromptCard } from '@/components/login-prompt-card';
import { FadeInView } from '@/components/ui/fade-in-view';
import { ErrorStateCard, LoadingState, EmptyStateCard } from '@/components/ui/state-cards';
import { PremiumCard, PrimaryButton } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import {
  deleteTrip,
  formatSavedTripDate,
  getUserTrips,
} from '@/lib/saved-trips';
import type { SavedTrip } from '@/types/trip';

function TripCard({
  trip,
  onOpen,
  onDelete,
}: {
  trip: SavedTrip;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const { payload } = trip;

  return (
    <PremiumCard style={styles.tripCard}>
      <View style={styles.tripHeader}>
        <Pressable
          style={({ pressed }) => [styles.tripHeaderText, pressed && styles.cardPressed]}
          onPress={onOpen}>
          <Text style={styles.tripTitle} numberOfLines={2}>
            {trip.title}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaIcon}>📍</Text>
            <Text style={styles.metaText}>{payload.location || '未指定'}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaIcon}>📅</Text>
            <Text style={styles.metaText}>{formatSavedTripDate(trip.createdAt)}</Text>
          </View>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.deleteButton, pressed && styles.deleteButtonPressed]}
          onPress={onDelete}
          hitSlop={8}>
          <Text style={styles.deleteButtonText}>削除</Text>
        </Pressable>
      </View>
      <Pressable
        style={({ pressed }) => [styles.tripFooter, pressed && styles.cardPressed]}
        onPress={onOpen}>
        <View style={styles.tag}>
          <Text style={styles.tagText}>{payload.personality}</Text>
        </View>
        <View style={styles.tag}>
          <Text style={styles.tagText}>{payload.companion}</Text>
        </View>
        {payload.tripDuration ? (
          <View style={styles.tagMuted}>
            <Text style={styles.tagMutedText}>{payload.tripDuration}</Text>
          </View>
        ) : null}
        <Text style={styles.openHint}>タップして詳細を見る →</Text>
      </Pressable>
    </PremiumCard>
  );
}

function LoginPrompt() {
  return (
    <LoginPromptCard
      icon="☁️"
      title="ログインが必要です"
      description="保存したプランはアカウントに紐づけてクラウドに保存されます。ログインしてからご利用ください。"
    />
  );
}

function EmptyState() {
  return (
    <EmptyStateCard
      icon="📋"
      title="保存済みプランはまだありません"
      description="ホームでプランを生成し、「プランを保存」から追加できます。"
      actionLabel="プランを作る"
      onAction={() => router.push('/')}
    />
  );
}

export default function SavedTripsScreen() {
  const insets = useSafeAreaInsets();
  const { session, isConfigured } = useAuth();
  const [trips, setTrips] = useState<SavedTrip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTrips = useCallback(async () => {
    if (!session) {
      setTrips([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      setTrips(await getUserTrips());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'プランの読み込みに失敗しました';
      setError(message);
      setTrips([]);
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      loadTrips();
    }, [loadTrips]),
  );

  const handleOpen = (trip: SavedTrip) => {
    router.push(`/saved-trip/${trip.id}`);
  };

  const handleDelete = (trip: SavedTrip) => {
    Alert.alert('プランを削除', `「${trip.title}」を削除しますか？`, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTrip(trip.id);
            await loadTrips();
          } catch (err) {
            const message = err instanceof Error ? err.message : '削除に失敗しました';
            Alert.alert('エラー', message);
          }
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + Spacing.four,
          paddingBottom: insets.bottom + BottomTabInset + Spacing.five,
        },
      ]}
      showsVerticalScrollIndicator={false}>
      <FadeInView>
        <Text style={styles.eyebrow}>MY TRIPS</Text>
        <Text style={styles.title}>保存済みプラン</Text>
        <Text style={styles.subtitle}>クラウドに保存したプランをいつでも見返せます</Text>
      </FadeInView>

      {!session ? (
        <LoginPrompt />
      ) : !isConfigured ? (
        <Text style={styles.errorText}>
          Supabaseの設定を確認し、trips テーブルを作成してください。
        </Text>
      ) : isLoading ? (
        <LoadingState message="保存済みプランを読み込み中..." />
      ) : error ? (
        <ErrorStateCard message={error} onRetry={() => void loadTrips()} />
      ) : trips.length === 0 ? (
        <EmptyState />
      ) : (
        <View style={styles.list}>
          {trips.map((trip, index) => (
            <FadeInView key={trip.id} delay={index * 60} direction="down">
              <TripCard
                trip={trip}
                onOpen={() => handleOpen(trip)}
                onDelete={() => handleDelete(trip)}
              />
            </FadeInView>
          ))}
        </View>
      )}
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
    marginBottom: Spacing.five,
  },
  loadingText: {
    color: NS.colors.textSecondary,
    ...NS.typography.bodySm,
    textAlign: 'center',
    marginTop: Spacing.five,
  },
  errorText: {
    color: NS.colors.danger,
    ...NS.typography.bodySm,
    textAlign: 'center',
    marginTop: Spacing.five,
    lineHeight: 22,
  },
  list: {
    gap: Spacing.three,
  },
  tripCard: {
    padding: 0,
    overflow: 'hidden',
  },
  cardPressed: {
    opacity: 0.92,
  },
  tripHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    padding: Spacing.four,
    paddingBottom: 0,
  },
  tripHeaderText: {
    flex: 1,
    gap: Spacing.two,
  },
  tripTitle: {
    color: NS.colors.text,
    ...NS.typography.titleSm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  metaIcon: {
    fontSize: 14,
  },
  metaText: {
    color: NS.colors.textSecondary,
    ...NS.typography.bodySm,
    flex: 1,
  },
  deleteButton: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: NS.radius.sm,
    backgroundColor: NS.colors.dangerSoft,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.2)',
  },
  deleteButtonPressed: {
    opacity: 0.8,
  },
  deleteButtonText: {
    color: NS.colors.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  tripFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.three,
    paddingTop: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    borderTopWidth: 1,
    borderTopColor: NS.colors.border,
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
    color: NS.colors.accent,
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
  openHint: {
    color: NS.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 'auto',
  },
  loginCard: {
    padding: Spacing.five,
    alignItems: 'center',
    gap: Spacing.three,
  },
  loginIcon: {
    fontSize: 48,
  },
  loginTitle: {
    color: NS.colors.text,
    ...NS.typography.headline,
  },
  loginText: {
    color: NS.colors.textSecondary,
    ...NS.typography.bodySm,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.two,
  },
  signUpLink: {
    paddingVertical: Spacing.two,
  },
  signUpLinkText: {
    color: NS.colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.six,
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: Spacing.two,
  },
  emptyTitle: {
    color: NS.colors.text,
    ...NS.typography.headline,
    textAlign: 'center',
  },
  emptyText: {
    color: NS.colors.textSecondary,
    ...NS.typography.bodySm,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.two,
  },
});
