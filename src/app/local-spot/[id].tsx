import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LocalHiddenSpotActions } from '@/components/local-hidden-spot-actions';
import { ReportReasonSheet } from '@/components/report-reason-sheet';
import { ScreenBackground } from '@/components/ui/screen-background';
import { PremiumCard } from '@/components/ui/premium-card';
import { NS, getChipPalette } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { reportLocalHiddenSpot } from '@/lib/content-reports';
import {
  fetchLocalHiddenSpotComments,
  formatLocalSpotCommentTime,
  postLocalHiddenSpotComment,
} from '@/lib/local-hidden-spot-comments';
import { getLocalHiddenSpotById } from '@/lib/local-hidden-spots';
import { PLAN_REPORT_REASONS } from '@/types/moderation';
import type { LocalHiddenSpot, LocalHiddenSpotComment } from '@/types/local-hidden-spot';
import { getLocalHiddenSpotCategoryIcon } from '@/types/local-hidden-spot';

export default function LocalSpotDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const [spot, setSpot] = useState<LocalHiddenSpot | null>(null);
  const [comments, setComments] = useState<LocalHiddenSpotComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isPosting, setIsPosting] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const [nextSpot, nextComments] = await Promise.all([
        getLocalHiddenSpotById(id),
        fetchLocalHiddenSpotComments(id),
      ]);
      setSpot(nextSpot);
      setComments(nextComments);
    } catch {
      setSpot(null);
      setComments([]);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handlePostComment = async () => {
    if (!session) {
      router.push('/login');
      return;
    }
    if (!spot) return;

    setIsPosting(true);
    try {
      const comment = await postLocalHiddenSpotComment(spot.id, commentText);
      setComments((prev) => [comment, ...prev]);
      setCommentText('');
      setSpot({ ...spot, commentCount: spot.commentCount + 1 });
    } catch (error) {
      Alert.alert('エラー', error instanceof Error ? error.message : 'コメントに失敗しました');
    } finally {
      setIsPosting(false);
    }
  };

  if (isLoading) {
    return (
      <ScreenBackground>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={NS.colors.accent} />
        </View>
      </ScreenBackground>
    );
  }

  if (!spot) {
    return (
      <ScreenBackground>
        <View style={styles.center}>
          <Text style={styles.errorText}>スポットが見つかりません</Text>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.backLink}>戻る</Text>
          </Pressable>
        </View>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.three, paddingBottom: insets.bottom + Spacing.five },
        ]}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>← 発見に戻る</Text>
        </Pressable>

        {spot.imageUrl.trim() ? (
          <Image source={{ uri: spot.imageUrl.trim() }} style={styles.heroImage} />
        ) : null}

        <PremiumCard style={styles.card}>
          <View style={styles.titleRow}>
            <Text style={styles.categoryIcon}>{getLocalHiddenSpotCategoryIcon(spot.category)}</Text>
            <View style={styles.titleText}>
              <Text style={styles.name}>{spot.name}</Text>
              <Text style={styles.area}>📍 {spot.area}</Text>
            </View>
          </View>

          {spot.isLocalContributor ? (
            <View style={styles.localBadge}>
              <Text style={styles.localBadgeText}>🌟 ローカル投稿者</Text>
            </View>
          ) : null}

          <Text style={styles.description}>{spot.description}</Text>

          {spot.tags.length > 0 ? (
            <View style={styles.tagRow}>
              {spot.tags.map((tag, index) => (
                <View
                  key={tag}
                  style={[styles.tagChip, { backgroundColor: getChipPalette(index).bg }]}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.infoGrid}>
            {spot.bestTime.trim() ? (
              <InfoRow label="ベスト時間" value={spot.bestTime} />
            ) : null}
            {spot.estimatedBudget.trim() ? (
              <InfoRow label="予算目安" value={spot.estimatedBudget} />
            ) : null}
            {spot.crowdTip.trim() ? (
              <InfoRow label="混雑" value={spot.crowdTip} />
            ) : null}
            {spot.caution.trim() ? (
              <InfoRow label="注意点" value={spot.caution} />
            ) : null}
          </View>

          <View style={styles.creatorBox}>
            <Text style={styles.creatorLabel}>投稿者</Text>
            <Text style={styles.creatorValue}>
              {spot.creatorDisplayName}
              {spot.creatorArea ? ` · ${spot.creatorArea}` : ''}
            </Text>
          </View>

          <LocalHiddenSpotActions
            spot={spot}
            isLoggedIn={Boolean(session)}
            onRequireLogin={() => router.push('/login')}
            onSpotUpdate={setSpot}
            onAddToPlan={() => router.push('/(tabs)')}
          />

          <Pressable style={styles.reportLink} onPress={() => setShowReport(true)}>
            <Text style={styles.reportLinkText}>不適切な内容を通報</Text>
          </Pressable>
        </PremiumCard>

        <PremiumCard style={styles.card}>
          <Text style={styles.sectionTitle}>コメント</Text>
          <View style={styles.commentInputRow}>
            <TextInput
              style={styles.commentInput}
              value={commentText}
              onChangeText={setCommentText}
              placeholder="行った感想や質問を..."
              placeholderTextColor={NS.colors.textMuted}
              multiline
            />
            <Pressable
              style={[styles.postButton, isPosting && styles.postButtonDisabled]}
              onPress={handlePostComment}
              disabled={isPosting || !commentText.trim()}>
              <Text style={styles.postButtonText}>{isPosting ? '...' : '送信'}</Text>
            </Pressable>
          </View>

          {comments.length === 0 ? (
            <Text style={styles.emptyComments}>まだコメントがありません</Text>
          ) : (
            comments.map((comment) => (
              <View key={comment.id} style={styles.commentRow}>
                <Text style={styles.commentAuthor}>{comment.displayName}</Text>
                <Text style={styles.commentText}>{comment.commentText}</Text>
                <Text style={styles.commentTime}>{formatLocalSpotCommentTime(comment.createdAt)}</Text>
              </View>
            ))
          )}
        </PremiumCard>
      </ScrollView>

      <ReportReasonSheet
        visible={showReport}
        title="穴場スポットを通報"
        subtitle="不適切・危険な内容を報告してください"
        reasons={PLAN_REPORT_REASONS}
        onClose={() => setShowReport(false)}
        onSubmit={async (reason, details) => {
          await reportLocalHiddenSpot(spot.id, reason, details);
          Alert.alert('送信しました', 'ご報告ありがとうございます。内容を確認します。');
          setShowReport(false);
        }}
      />
    </ScreenBackground>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  content: {
    paddingHorizontal: Spacing.four,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  back: {
    color: NS.colors.accent,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: Spacing.three,
  },
  backLink: {
    color: NS.colors.accent,
    marginTop: Spacing.two,
    fontWeight: '700',
  },
  heroImage: {
    width: '100%',
    height: 200,
    borderRadius: NS.radius.lg,
    marginBottom: Spacing.three,
    backgroundColor: NS.colors.bgInput,
  },
  card: {
    padding: Spacing.four,
    marginBottom: Spacing.three,
    gap: Spacing.three,
  },
  titleRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'flex-start',
  },
  categoryIcon: {
    fontSize: 28,
  },
  titleText: {
    flex: 1,
  },
  name: {
    color: NS.colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  area: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  localBadge: {
    alignSelf: 'flex-start',
    backgroundColor: NS.colors.yellowSoft,
    borderRadius: NS.radius.pill,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: NS.colors.yellow,
  },
  localBadgeText: {
    color: '#A16207',
    fontSize: 12,
    fontWeight: '800',
  },
  description: {
    color: NS.colors.text,
    fontSize: 15,
    lineHeight: 24,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  tagChip: {
    borderRadius: NS.radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '700',
    color: NS.colors.text,
  },
  infoGrid: {
    gap: Spacing.two,
  },
  infoRow: {
    gap: 2,
  },
  infoLabel: {
    color: NS.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  infoValue: {
    color: NS.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  creatorBox: {
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.md,
    padding: Spacing.three,
  },
  creatorLabel: {
    color: NS.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  creatorValue: {
    color: NS.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  reportLink: {
    alignSelf: 'center',
  },
  reportLinkText: {
    color: NS.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  sectionTitle: {
    color: NS.colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  commentInputRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'flex-end',
  },
  commentInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.borderStrong,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    color: NS.colors.text,
    fontSize: 14,
  },
  postButton: {
    backgroundColor: NS.colors.accent,
    borderRadius: NS.radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  postButtonDisabled: {
    opacity: 0.5,
  },
  postButtonText: {
    color: NS.colors.textOnAccent,
    fontWeight: '800',
    fontSize: 13,
  },
  emptyComments: {
    color: NS.colors.textMuted,
    fontSize: 13,
  },
  commentRow: {
    borderTopWidth: 1,
    borderTopColor: NS.colors.border,
    paddingTop: Spacing.two,
    gap: 4,
  },
  commentAuthor: {
    color: NS.colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  commentText: {
    color: NS.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  commentTime: {
    color: NS.colors.textMuted,
    fontSize: 11,
  },
  errorText: {
    color: NS.colors.textSecondary,
    fontSize: 15,
  },
});
