import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LoginPromptCard } from '@/components/login-prompt-card';
import { ScreenBackground } from '@/components/ui/screen-background';
import { FadeInView } from '@/components/ui/fade-in-view';
import { ErrorStateCard, LoadingState, EmptyStateCard } from '@/components/ui/state-cards';
import { PremiumCard } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { loopTestLogOnce } from '@/lib/loop-test-config';
import { formatSavedTripDate, deleteTrip } from '@/lib/saved-trips';
import { loadSavedTravelPlans } from '@/lib/supabase-persistence';
import { safeKey, safeText } from '@/lib/safe-text';
import { getDurationDisplayLabel } from '@/lib/trip-duration';
import type { SavedTrip } from '@/types/trip';

function sameTrips(left: SavedTrip[], right: SavedTrip[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

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
            {safeText(trip.title)}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaIcon}>📍</Text>
            <Text style={styles.metaText}>{safeText(payload.location) || '未指定'}</Text>
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
          <Text style={styles.tagText}>{safeText(payload.personality)}</Text>
        </View>
        <View style={styles.tag}>
          <Text style={styles.tagText}>{safeText(payload.companion)}</Text>
        </View>
        {payload.tripDuration ? (
          <View style={styles.tagMuted}>
            <Text style={styles.tagMutedText}>
              {getDurationDisplayLabel(payload.tripDuration, payload.customDuration)}
            </Text>
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
      icon="🗺️"
      title="保存したプランはまだありません"
      description="ホームでプランを作って、「プランを保存」でここに追加できます。次のお出かけの準備、始めましょう！"
      actionLabel="プランを作る"
      onAction={() => router.push('/(tabs)')}
    />
  );
}

export default function SavedTripsScreen() {
  loopTestLogOnce('restore:Favorites', 'restoring My Trips / saved plans');

  const insets = useSafeAreaInsets();
  const { session, isConfigured } = useAuth();
  const userId = session?.user?.id ?? null;
  const loadInFlightRef = useRef(false);

  const [trips, setTrips] = useState<SavedTrip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTrips = useCallback(async () => {
    if (!userId) {
      setTrips((prev) => (prev.length === 0 ? prev : []));
      setError((prev) => (prev ? null : prev));
      setIsLoading((prev) => (prev ? false : prev));
      return;
    }

    if (loadInFlightRef.current) return;
    loadInFlightRef.current = true;

    setIsLoading((prev) => (prev ? prev : true));
    setError((prev) => (prev ? null : prev));

    try {
      const loaded = await loadSavedTravelPlans();
      setTrips((prev) => (sameTrips(prev, loaded) ? prev : loaded));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'プランの読み込みに失敗しました';
      console.warn('[MyTrips] load failed', message);
      setError((prev) => (prev === message ? prev : message));
      setTrips((prev) => (prev.length === 0 ? prev : []));
    } finally {
      loadInFlightRef.current = false;
      setIsLoading((prev) => (prev ? false : prev));
    }
  }, [userId]);

  useEffect(() => {
    void loadTrips();
  }, [loadTrips]);

  const handleOpen = (trip: SavedTrip) => {
    const tripId = safeText(trip.id);
    if (!tripId) return;
    router.push(`/saved-trip/${tripId}`);
  };

  const handleDelete = (trip: SavedTrip) => {
    const title = safeText(trip.title) || 'このプラン';
    Alert.alert('プランを削除', `「${title}」を削除しますか？`, [
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
            console.warn('[MyTrips] delete failed', message);
            Alert.alert('エラー', message);
          }
        },
      },
    ]);
  };

  return (
    <ScreenBackground>
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
          <Text style={styles.eyebrow}>📌 MY TRIPS</Text>
          <Text style={styles.title}>保存したプラン</Text>
          <Text style={styles.subtitle}>いつでも見返せる、あなただけの旅のリスト</Text>
          {session ? (
            <Pressable style={styles.memoriesLink} onPress={() => router.push('/memories')}>
              <Text style={styles.memoriesLinkText}>📔 思い出アルバムを見る</Text>
            </Pressable>
          ) : null}
          {session ? (
            <Pressable style={styles.memoriesLink} onPress={() => router.push('/my-trips')}>
              <Text style={styles.memoriesLinkText}>🧳 マイトリップを見る</Text>
            </Pressable>
          ) : null}
        </FadeInView>

        {!session ? (
          <LoginPrompt />
        ) : !isConfigured ? (
          <Text style={styles.fallbackText}>
            クラウド保存は未設定です。ローカル表示のみ利用できます。
          </Text>
        ) : null}

        {!session ? null : isLoading ? (
          <LoadingState message="保存済みプランを読み込み中..." />
        ) : error ? (
          <ErrorStateCard message={error} onRetry={() => void loadTrips()} />
        ) : trips.length === 0 ? (
          <EmptyState />
        ) : (
          <View style={styles.list}>
            {trips.map((trip, index) => (
              <FadeInView
                key={`${safeKey(trip.id, `trip-${index}`)}-${index}`}
                delay={index * 60}
                direction="down">
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
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
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
    marginBottom: Spacing.two,
  },
  memoriesLink: {
    marginBottom: Spacing.five,
  },
  memoriesLinkText: {
    color: NS.colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  fallbackText: {
    color: NS.colors.textSecondary,
    ...NS.typography.bodySm,
    textAlign: 'center',
    marginTop: Spacing.two,
    marginBottom: Spacing.three,
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
});
