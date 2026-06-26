import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenBackground } from '@/components/ui/screen-background';
import { TripMemoryActions } from '@/components/trip-memory-actions';
import { TripMemoryPanel } from '@/components/trip-memory-panel';
import { TripMemoryTimeline } from '@/components/trip-memory-timeline';
import { ErrorStateCard } from '@/components/ui/state-cards';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { getTripById } from '@/lib/saved-trips';
import {
  fetchTripMemoryComments,
  fetchTripMemoryEngagement,
  fetchTripMemoryWithMedia,
} from '@/lib/trip-memories';
import type { SavedTrip } from '@/types/trip';
import type { TripMemoryComment, TripMemoryWithMedia } from '@/types/trip-memory';

export default function TripMemoryDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, isConfigured } = useAuth();
  const [memory, setMemory] = useState<TripMemoryWithMedia | null>(null);
  const [trip, setTrip] = useState<SavedTrip | null>(null);
  const [comments, setComments] = useState<TripMemoryComment[]>([]);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMemory = useCallback(async () => {
    if (!id || !isConfigured) return;
    setIsLoading(true);
    setError(null);
    try {
      const loaded = await fetchTripMemoryWithMedia(id);
      if (!loaded) {
        setError('思い出が見つかりませんでした');
        setMemory(null);
        return;
      }
      setMemory(loaded);

      if (loaded.tripId && session?.user.id === loaded.userId) {
        setTrip(await getTripById(loaded.tripId));
      }

      if (loaded.visibility === 'public') {
        const [loadedComments, engagement] = await Promise.all([
          fetchTripMemoryComments(loaded.id),
          fetchTripMemoryEngagement(loaded.id, session?.user.id ?? null),
        ]);
        setComments(loadedComments);
        setIsLiked(engagement.isLiked);
        setIsSaved(engagement.isSaved);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '読み込みに失敗しました');
      setMemory(null);
    } finally {
      setIsLoading(false);
    }
  }, [id, isConfigured, session?.user.id]);

  useEffect(() => {
    void loadMemory();
  }, [loadMemory]);

  const isOwner = Boolean(session?.user.id && memory?.userId === session.user.id);

  return (
    <ScreenBackground>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + Spacing.four,
            paddingBottom: insets.bottom + Spacing.six,
          },
        ]}
        showsVerticalScrollIndicator={false}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← 戻る</Text>
        </Pressable>

        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={NS.colors.accent} />
            <Text style={styles.loadingText}>思い出を読み込み中...</Text>
          </View>
        ) : error || !memory ? (
          <ErrorStateCard title="読み込みエラー" message={error ?? '思い出が見つかりません'} />
        ) : isOwner && trip && session ? (
          <>
            <TripMemoryPanel trip={trip} userId={session.user.id} isConfigured={isConfigured} />
            {memory.visibility === 'public' ? (
              <TripMemoryActions
                memory={memory}
                isLoggedIn={Boolean(session)}
                isOwner={isOwner}
                isLiked={isLiked}
                isSaved={isSaved}
                comments={comments}
                onRequireLogin={() => router.push('/login')}
                onMemoryUpdate={(patch) => setMemory({ ...memory, ...patch })}
                onEngagementUpdate={(patch) => {
                  if (patch.isLiked !== undefined) setIsLiked(patch.isLiked);
                  if (patch.isSaved !== undefined) setIsSaved(patch.isSaved);
                }}
                onCommentAdded={(comment) => setComments([...comments, comment])}
              />
            ) : null}
          </>
        ) : (
          <>
            <View style={styles.publicHeader}>
              <Text style={styles.eyebrow}>📔 思い出</Text>
              <Text style={styles.title}>{memory.title}</Text>
              <Text style={styles.meta}>
                📍 {memory.destination}
                {memory.dateLabel ? ` · ${memory.dateLabel}` : ''}
              </Text>
              {memory.companion ? (
                <Text style={styles.meta}>👥 {memory.companion}</Text>
              ) : null}
              {memory.summary ? <Text style={styles.summary}>{memory.summary}</Text> : null}
            </View>

            {memory.coverImageUrl ? (
              <Image source={{ uri: memory.coverImageUrl }} style={styles.coverImage} contentFit="cover" />
            ) : null}

            {memory.aiSummary ? (
              <View style={styles.aiCard}>
                <Text style={styles.aiTitle}>{memory.aiSummary.memoryTitle}</Text>
                <Text style={styles.summary}>{memory.aiSummary.oneLineSummary}</Text>
              </View>
            ) : null}

            <TripMemoryTimeline media={memory.media} />

            <TripMemoryActions
              memory={memory}
              isLoggedIn={Boolean(session)}
              isOwner={isOwner}
              isLiked={isLiked}
              isSaved={isSaved}
              comments={comments}
              onRequireLogin={() => router.push('/login')}
              onMemoryUpdate={(patch) => setMemory({ ...memory, ...patch })}
              onEngagementUpdate={(patch) => {
                if (patch.isLiked !== undefined) setIsLiked(patch.isLiked);
                if (patch.isSaved !== undefined) setIsSaved(patch.isSaved);
              }}
              onCommentAdded={(comment) => setComments([...comments, comment])}
            />
          </>
        )}
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  backButton: {
    marginBottom: Spacing.one,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: NS.colors.accent,
  },
  loading: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
    gap: Spacing.two,
  },
  loadingText: {
    fontSize: 13,
    color: NS.colors.textMuted,
  },
  publicHeader: {
    gap: Spacing.two,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    color: NS.colors.coral,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: NS.colors.text,
    lineHeight: 30,
  },
  meta: {
    fontSize: 14,
    color: NS.colors.textSecondary,
  },
  summary: {
    fontSize: 15,
    color: NS.colors.text,
    lineHeight: 22,
  },
  coverImage: {
    width: '100%',
    height: 220,
    borderRadius: NS.radius.xl,
  },
  aiCard: {
    backgroundColor: NS.colors.purpleSoft,
    borderRadius: NS.radius.xl,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  aiTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: NS.colors.text,
  },
});
