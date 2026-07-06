import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LoginPromptCard } from '@/components/login-prompt-card';
import { ScreenBackground } from '@/components/ui/screen-background';
import { FadeInView } from '@/components/ui/fade-in-view';
import { ErrorStateCard, LoadingState } from '@/components/ui/state-cards';
import { PremiumCard, PrimaryButton } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import {
  countPlansInFolder,
  formatPlanUpdatedAt,
  getFolderWeatherNote,
  getUpcomingTripFolders,
  loadMyTripsData,
} from '@/lib/my-trips';
import { savedTripToPlanParams, savedTripPayloadToPlanParams } from '@/lib/saved-trips';
import { formatTripDateRangeLabel } from '@/lib/trip-schedule';
import { getDurationDisplayLabel } from '@/lib/trip-duration';
import type { SavedTrip } from '@/types/trip';
import type { TripFolder } from '@/types/trip-folder';

function MetaRow({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaIcon}>{icon}</Text>
      <Text style={styles.metaText}>{text}</Text>
    </View>
  );
}

function TripFolderCard({
  folder,
  onOpenFolder,
  onOpenAssistant,
  onOpenPlan,
}: {
  folder: TripFolder;
  onOpenFolder: () => void;
  onOpenAssistant: () => void;
  onOpenPlan: () => void;
}) {
  const dateLabel =
    formatTripDateRangeLabel(folder.departureDate, folder.returnDate) ??
    (folder.departureDate || '日程未設定');
  const planCount = countPlansInFolder(folder);
  const weatherNote = getFolderWeatherNote(folder);

  return (
    <PremiumCard style={styles.card}>
      <Pressable style={({ pressed }) => [styles.cardBody, pressed && styles.cardPressed]} onPress={onOpenFolder}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {folder.title}
        </Text>
        <MetaRow icon="📍" text={folder.destination || '未設定'} />
        <MetaRow icon="📅" text={dateLabel} />
        {folder.durationLabel ? <MetaRow icon="🗓" text={folder.durationLabel} /> : null}
        <MetaRow icon="📂" text={`保存プラン ${planCount}件`} />
        {weatherNote ? <Text style={styles.weatherNote}>{weatherNote}</Text> : null}
      </Pressable>
      <View style={styles.cardActions}>
        <PrimaryButton label="旅行秘書を開く" onPress={onOpenAssistant} variant="secondary" />
        <PrimaryButton label="プランを見る" onPress={onOpenPlan} variant="secondary" />
      </View>
    </PremiumCard>
  );
}

function SavedPlanCard({ trip, onOpen }: { trip: SavedTrip; onOpen: () => void }) {
  const { payload } = trip;
  const dateLabel =
    formatTripDateRangeLabel(payload.details.tripDate, payload.details.tripEndDate) ??
    getDurationDisplayLabel(payload.tripDuration, payload.customDuration);

  return (
    <PremiumCard style={styles.card}>
      <Pressable style={({ pressed }) => [styles.cardBody, pressed && styles.cardPressed]} onPress={onOpen}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {trip.title}
        </Text>
        <MetaRow icon="📍" text={payload.location || '未設定'} />
        <MetaRow icon="📅" text={dateLabel} />
        <MetaRow icon="👥" text={payload.companion} />
        <MetaRow icon="💰" text={`${payload.budget} ${payload.currency}`} />
        {payload.travelPurpose ? <MetaRow icon="✨" text={payload.travelPurpose} /> : null}
        <MetaRow icon="🕒" text={`更新: ${formatPlanUpdatedAt(payload.updatedAt ?? trip.createdAt)}`} />
      </Pressable>
      <View style={styles.cardActionsSingle}>
        <PrimaryButton label="開く" onPress={onOpen} variant="secondary" />
      </View>
    </PremiumCard>
  );
}

export default function MyTripsScreen() {
  const insets = useSafeAreaInsets();
  const { session, isConfigured } = useAuth();
  const [savedPlans, setSavedPlans] = useState<SavedTrip[]>([]);
  const [tripFolders, setTripFolders] = useState<TripFolder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const upcomingFolders = useMemo(() => getUpcomingTripFolders(tripFolders), [tripFolders]);
  const isEmpty = savedPlans.length === 0 && tripFolders.length === 0;

  const loadData = useCallback(async () => {
    if (!session) {
      setSavedPlans([]);
      setTripFolders([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await loadMyTripsData();
      setSavedPlans(data.savedPlans);
      setTripFolders(data.tripFolders);
    } catch (err) {
      const message = err instanceof Error ? err.message : '読み込みに失敗しました';
      setError(message);
      setSavedPlans([]);
      setTripFolders([]);
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );

  const openFolder = (folderId: string) => {
    console.log('[MyTrips] open trip folder', folderId);
    router.push(`/trip-folder/${folderId}`);
  };

  const openAssistant = (folder: TripFolder) => {
    router.push(`/trip-assistant/${folder.id}`);
  };

  const openFolderPlan = (folder: TripFolder) => {
    if (folder.savedTripId) {
      const linked = savedPlans.find((trip) => trip.id === folder.savedTripId);
      if (linked) {
        openSavedPlan(linked);
        return;
      }
    }

    if (folder.planPayload?.days?.length) {
      router.push({
        pathname: '/plan-detail',
        params: savedTripPayloadToPlanParams(folder.planPayload, folder.savedTripId),
      });
      return;
    }

    openFolder(folder.id);
  };

  const openSavedPlan = (trip: SavedTrip) => {
    console.log('[MyTrips] open saved plan', trip.id);
    router.push({
      pathname: '/plan-detail',
      params: savedTripToPlanParams(trip),
    });
  };

  return (
    <ScreenBackground>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + Spacing.three,
            paddingBottom: insets.bottom + Spacing.six,
          },
        ]}
        showsVerticalScrollIndicator={false}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← 戻る</Text>
        </Pressable>

        <FadeInView>
          <Text style={styles.eyebrow}>🧳 MY TRIPS</Text>
          <Text style={styles.title}>マイトリップ</Text>
          <Text style={styles.subtitle}>保存したプランと旅行秘書フォルダをまとめて確認</Text>
        </FadeInView>

        {!session ? (
          <LoginPromptCard
            icon="🧳"
            title="ログインが必要です"
            description="保存した旅行プランと旅行秘書フォルダはログイン後に表示されます。"
          />
        ) : !isConfigured ? (
          <Text style={styles.warningText}>
            クラウドに接続できないため、保存したプランが表示されない場合があります。
          </Text>
        ) : isLoading ? (
          <LoadingState message="マイトリップを読み込み中…" />
        ) : error ? (
          <ErrorStateCard message={error} onRetry={() => void loadData()} />
        ) : isEmpty ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>🗺️</Text>
            <Text style={styles.emptyTitle}>まだ保存された旅行はありません</Text>
            <Text style={styles.emptyText}>
              旅行プランを作ってみましょう。保存するとここに表示されます。
            </Text>
            <PrimaryButton label="旅行プランを作る" onPress={() => router.push('/(tabs)')} variant="primary" />
          </View>
        ) : (
          <View style={styles.sections}>
            {upcomingFolders.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>これからの旅行</Text>
                <View style={styles.list}>
                  {upcomingFolders.map((folder, index) => (
                    <FadeInView key={folder.id} delay={index * 50} direction="down">
                      <TripFolderCard
                        folder={folder}
                        onOpenFolder={() => openFolder(folder.id)}
                        onOpenAssistant={() => openAssistant(folder)}
                        onOpenPlan={() => openFolderPlan(folder)}
                      />
                    </FadeInView>
                  ))}
                </View>
              </View>
            ) : null}

            {savedPlans.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>保存したプラン</Text>
                <View style={styles.list}>
                  {savedPlans.map((trip, index) => (
                    <FadeInView key={trip.id} delay={index * 50} direction="down">
                      <SavedPlanCard trip={trip} onOpen={() => openSavedPlan(trip)} />
                    </FadeInView>
                  ))}
                </View>
              </View>
            ) : null}
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
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: Spacing.three,
    paddingVertical: Spacing.one,
  },
  backButtonText: {
    color: NS.colors.accent,
    fontSize: 15,
    fontWeight: '700',
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
  warningText: {
    color: NS.colors.textMuted,
    ...NS.typography.bodySm,
    lineHeight: 22,
    marginTop: Spacing.four,
  },
  sections: {
    gap: Spacing.six,
  },
  section: {
    gap: Spacing.three,
  },
  sectionTitle: {
    color: NS.colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  list: {
    gap: Spacing.three,
  },
  card: {
    padding: 0,
    overflow: 'hidden',
  },
  cardBody: {
    padding: Spacing.four,
    gap: Spacing.two,
  },
  cardPressed: {
    opacity: 0.92,
  },
  cardTitle: {
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
  weatherNote: {
    color: NS.colors.sky,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: Spacing.one,
  },
  cardActions: {
    gap: Spacing.two,
    padding: Spacing.four,
    paddingTop: 0,
  },
  cardActionsSingle: {
    padding: Spacing.four,
    paddingTop: 0,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.six,
    gap: Spacing.three,
  },
  emptyIcon: {
    fontSize: 48,
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
