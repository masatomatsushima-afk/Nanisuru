import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenBackground } from '@/components/ui/screen-background';
import { LoadingState } from '@/components/ui/state-cards';
import { PremiumCard, PrimaryButton } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { countPlansInFolder, formatPlanUpdatedAt } from '@/lib/my-trips';
import { savedTripPayloadToPlanParams, savedTripToPlanParams, getTripById } from '@/lib/saved-trips';
import { getTripFolderById } from '@/lib/trip-folders';
import { buildTripDayModeFolderParams } from '@/lib/trip-day-mode-nav';
import { buildTripMemoriesFolderParams } from '@/lib/trip-memories-nav';
import { formatTripDateRangeLabel } from '@/lib/trip-schedule';
import type { SavedTrip } from '@/types/trip';
import type { TripFolder } from '@/types/trip-folder';

type FolderPlanEntry = {
  id: string;
  title: string;
  subtitle: string;
  savedTripId?: string | null;
  payload?: SavedTrip['payload'];
};

function buildFolderPlanEntries(folder: TripFolder, linkedTrip: SavedTrip | null): FolderPlanEntry[] {
  const entries: FolderPlanEntry[] = [];

  if (linkedTrip) {
    entries.push({
      id: linkedTrip.id,
      title: linkedTrip.title,
      subtitle: `${linkedTrip.payload.location} · 更新 ${formatPlanUpdatedAt(linkedTrip.payload.updatedAt ?? linkedTrip.createdAt)}`,
      savedTripId: linkedTrip.id,
      payload: linkedTrip.payload,
    });
    return entries;
  }

  if (folder.planPayload?.days?.length) {
    entries.push({
      id: `${folder.id}-payload`,
      title: folder.title,
      subtitle: `${folder.planPayload.location} · ${folder.durationLabel || 'プラン'}`,
      savedTripId: folder.savedTripId,
      payload: folder.planPayload,
    });
  }

  return entries;
}

export default function TripFolderDetailScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [folder, setFolder] = useState<TripFolder | null>(null);
  const [linkedTrip, setLinkedTrip] = useState<SavedTrip | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFolder = useCallback(async () => {
    if (!id?.trim()) {
      setError('フォルダが見つかりません');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const loaded = await getTripFolderById(id.trim());
      if (!loaded) {
        setError('旅行秘書フォルダが見つかりません');
        setFolder(null);
        setLinkedTrip(null);
        return;
      }

      setFolder(loaded);
      if (loaded.savedTripId && session) {
        const trip = await getTripById(loaded.savedTripId);
        setLinkedTrip(trip);
      } else {
        setLinkedTrip(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '読み込みに失敗しました');
      setFolder(null);
      setLinkedTrip(null);
    } finally {
      setIsLoading(false);
    }
  }, [id, session]);

  useEffect(() => {
    void loadFolder();
  }, [loadFolder]);

  const planEntries = useMemo(
    () => (folder ? buildFolderPlanEntries(folder, linkedTrip) : []),
    [folder, linkedTrip],
  );

  const openAssistant = () => {
    if (!folder) return;
    router.push(`/trip-assistant/${folder.id}`);
  };

  const openPlanEntry = (entry: FolderPlanEntry) => {
    if (linkedTrip && entry.savedTripId === linkedTrip.id) {
      router.push({
        pathname: '/plan-detail',
        params: savedTripToPlanParams(linkedTrip),
      });
      return;
    }

    if (entry.payload) {
      router.push({
        pathname: '/plan-detail',
        params: savedTripPayloadToPlanParams(entry.payload, entry.savedTripId),
      });
    }
  };

  const dateLabel = folder
    ? formatTripDateRangeLabel(folder.departureDate, folder.returnDate) ?? '日程未設定'
    : '';

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

        {isLoading ? (
          <LoadingState message="フォルダを読み込み中…" />
        ) : error || !folder ? (
          <Text style={styles.errorText}>{error ?? 'フォルダが見つかりません'}</Text>
        ) : (
          <>
            <Text style={styles.eyebrow}>🧳 旅行秘書フォルダ</Text>
            <Text style={styles.title}>{folder.title}</Text>
            <Text style={styles.subtitle}>{folder.destination}</Text>

            <PremiumCard style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>日程</Text>
              <Text style={styles.summaryValue}>{dateLabel}</Text>
              {folder.durationLabel ? (
                <>
                  <Text style={styles.summaryLabel}>期間</Text>
                  <Text style={styles.summaryValue}>{folder.durationLabel}</Text>
                </>
              ) : null}
              <Text style={styles.summaryLabel}>保存プラン</Text>
              <Text style={styles.summaryValue}>{countPlansInFolder(folder)}件</Text>
            </PremiumCard>

            <View style={styles.actions}>
              <PrimaryButton label="旅行秘書を開く" onPress={openAssistant} variant="primary" />
              <PrimaryButton
                label="当日モードを開く"
                onPress={() =>
                  router.push({
                    pathname: '/trip-day-mode',
                    params: buildTripDayModeFolderParams(folder.id, folder.title),
                  })
                }
                variant="secondary"
              />
              <PrimaryButton
                label="思い出を残す"
                onPress={() =>
                  router.push({
                    pathname: '/trip-memories',
                    params: buildTripMemoriesFolderParams(folder.id, {
                      tripTitle: folder.title,
                    }),
                  })
                }
                variant="secondary"
              />
              <PrimaryButton label="新しいプランを追加" onPress={() => router.push('/')} variant="secondary" />
            </View>

            <Text style={styles.sectionTitle}>このフォルダのプラン</Text>
            {planEntries.length === 0 ? (
              <Text style={styles.emptyPlans}>まだプランがありません。旅行プランを作成して追加してください。</Text>
            ) : (
              <View style={styles.planList}>
                {planEntries.map((entry) => (
                  <PremiumCard key={entry.id} style={styles.planCard}>
                    <Pressable
                      style={({ pressed }) => [styles.planCardBody, pressed && styles.cardPressed]}
                      onPress={() => openPlanEntry(entry)}>
                      <Text style={styles.planTitle}>{entry.title}</Text>
                      <Text style={styles.planSubtitle}>{entry.subtitle}</Text>
                    </Pressable>
                    <View style={styles.planAction}>
                      <PrimaryButton label="開く" onPress={() => openPlanEntry(entry)} variant="secondary" />
                    </View>
                  </PremiumCard>
                ))}
              </View>
            )}
          </>
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
    marginBottom: Spacing.one,
  },
  subtitle: {
    color: NS.colors.textSecondary,
    ...NS.typography.bodySm,
    marginBottom: Spacing.four,
  },
  summaryCard: {
    gap: Spacing.one,
    marginBottom: Spacing.four,
  },
  summaryLabel: {
    color: NS.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  summaryValue: {
    color: NS.colors.text,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: Spacing.two,
  },
  actions: {
    gap: Spacing.two,
    marginBottom: Spacing.five,
  },
  sectionTitle: {
    color: NS.colors.text,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: Spacing.three,
  },
  emptyPlans: {
    color: NS.colors.textSecondary,
    ...NS.typography.bodySm,
    lineHeight: 22,
  },
  planList: {
    gap: Spacing.three,
  },
  planCard: {
    padding: 0,
    overflow: 'hidden',
  },
  planCardBody: {
    padding: Spacing.four,
    gap: Spacing.one,
  },
  cardPressed: {
    opacity: 0.92,
  },
  planTitle: {
    color: NS.colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  planSubtitle: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  planAction: {
    padding: Spacing.four,
    paddingTop: 0,
  },
  errorText: {
    color: NS.colors.danger,
    ...NS.typography.bodySm,
    textAlign: 'center',
    marginTop: Spacing.five,
  },
});
