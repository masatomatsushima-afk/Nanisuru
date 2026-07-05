import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TripMemoriesAlbumView } from '@/components/trip-memories-album-view';
import { LoadingState } from '@/components/ui/state-cards';
import { ScreenBackground } from '@/components/ui/screen-background';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { buildItinerarySlotFromIndices } from '@/lib/trip-memories-album';
import { getTripById } from '@/lib/saved-trips';
import { getTripFolderById } from '@/lib/trip-folders';
import type { SavedTrip } from '@/types/trip';
import type { ItineraryMemorySlot } from '@/types/trip-memory';

export default function TripMemoriesScreen() {
  const insets = useSafeAreaInsets();
  const { session, isConfigured } = useAuth();
  const params = useLocalSearchParams<{
    tripId?: string;
    folderId?: string;
    linkDayIndex?: string;
    linkItemIndex?: string;
  }>();

  const [trip, setTrip] = useState<SavedTrip | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const linkDayIndex = params.linkDayIndex ? Number.parseInt(params.linkDayIndex, 10) : null;
  const linkItemIndex = params.linkItemIndex ? Number.parseInt(params.linkItemIndex, 10) : null;

  const initialLinkSlot = useMemo((): ItineraryMemorySlot | null => {
    if (!trip || linkDayIndex === null || linkItemIndex === null) return null;
    if (Number.isNaN(linkDayIndex) || Number.isNaN(linkItemIndex)) return null;
    return buildItinerarySlotFromIndices(trip, linkDayIndex, linkItemIndex);
  }, [trip, linkDayIndex, linkItemIndex]);

  const loadScreen = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const tripId = params.tripId?.trim();
    const folderId = params.folderId?.trim();

    console.log('[TripMemories] opened', { folderId, planId: tripId });

    try {
      if (tripId && session) {
        const loadedTrip = await getTripById(tripId);
        if (!loadedTrip) {
          setError('保存したプランが見つかりません');
          setTrip(null);
          return;
        }
        setTrip(loadedTrip);
        return;
      }

      if (folderId && session) {
        const folder = await getTripFolderById(folderId);
        if (!folder) {
          setError('旅行秘書フォルダが見つかりません');
          setTrip(null);
          return;
        }

        if (folder.savedTripId) {
          const loadedTrip = await getTripById(folder.savedTripId);
          if (loadedTrip) {
            setTrip(loadedTrip);
            return;
          }
        }

        setError('このフォルダには保存済みプランがありません。プランを保存してから思い出を残してください。');
        setTrip(null);
        return;
      }

      setError('プランを保存してから思い出アルバムを開いてください');
      setTrip(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '読み込みに失敗しました');
      setTrip(null);
    } finally {
      setIsLoading(false);
    }
  }, [params.folderId, params.tripId, session]);

  useEffect(() => {
    void loadScreen();
  }, [loadScreen]);

  if (!session) {
    return (
      <ScreenBackground>
        <View style={[styles.container, { paddingTop: insets.top + Spacing.four }]}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>← 戻る</Text>
          </Pressable>
          <Text style={styles.errorText}>思い出を残すにはログインが必要です</Text>
        </View>
      </ScreenBackground>
    );
  }

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
          <LoadingState message="思い出アルバムを読み込み中…" />
        ) : error || !trip ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error ?? 'プランが見つかりません'}</Text>
          </View>
        ) : (
          <TripMemoriesAlbumView
            trip={trip}
            userId={session.user.id}
            isConfigured={isConfigured}
            initialLinkSlot={initialLinkSlot}
          />
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
  errorBox: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
  },
  errorText: {
    color: NS.colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
});
