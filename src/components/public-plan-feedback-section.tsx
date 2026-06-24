import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ReportReasonSheet } from '@/components/report-reason-sheet';
import { PremiumCard } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import {
  fetchPublicPlanComments,
  formatPublicPlanCommentTime,
  MAX_COMMENT_LENGTH,
  postPublicPlanComment,
} from '@/lib/public-plan-comments';
import {
  fetchPublicPlanRequestSummary,
  submitPublicPlanRequest,
} from '@/lib/public-plan-requests';
import { reportComment } from '@/lib/content-reports';
import {
  PUBLIC_PLAN_REQUEST_TYPES,
  type PublicPlanComment,
  type PublicPlanRequestSummary,
  type PublicPlanRequestType,
} from '@/types/public-plan-feedback';
import { COMMENT_REPORT_REASONS } from '@/types/moderation';
import { getProfileInitial } from '@/types/user-profile';

type PublicPlanFeedbackSectionProps = {
  publicPlanId: string;
  creatorUserId: string;
  currentUserId: string | null;
  isLoggedIn: boolean;
  onRequireLogin: () => void;
};

function RequestChip({
  label,
  count,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  count: number;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.requestChip,
        selected && styles.requestChipSelected,
        pressed && !disabled && styles.requestChipPressed,
        disabled && styles.requestChipDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}>
      <Text style={[styles.requestChipLabel, selected && styles.requestChipLabelSelected]}>
        {label}
      </Text>
      {count > 0 ? (
        <View style={[styles.requestCountBadge, selected && styles.requestCountBadgeSelected]}>
          <Text style={[styles.requestCountText, selected && styles.requestCountTextSelected]}>
            {count}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function CommentItem({
  comment,
  canReport,
  onReport,
}: {
  comment: PublicPlanComment;
  canReport: boolean;
  onReport: () => void;
}) {
  return (
    <View style={styles.commentItem}>
      <View style={styles.commentAvatar}>
        <Text style={styles.commentInitial}>{getProfileInitial(comment.displayName)}</Text>
      </View>
      <View style={styles.commentBody}>
        <View style={styles.commentMeta}>
          <Text style={styles.commentName}>{comment.displayName}</Text>
          <Text style={styles.commentTime}>{formatPublicPlanCommentTime(comment.createdAt)}</Text>
        </View>
        <Text style={styles.commentText}>{comment.commentText}</Text>
        {canReport ? (
          <Pressable style={styles.commentReportButton} onPress={onReport}>
            <Text style={styles.commentReportText}>コメントを通報</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function PublicPlanFeedbackSection({
  publicPlanId,
  creatorUserId,
  currentUserId,
  isLoggedIn,
  onRequireLogin,
}: PublicPlanFeedbackSectionProps) {
  const isCreator = Boolean(currentUserId && currentUserId === creatorUserId);

  const [comments, setComments] = useState<PublicPlanComment[]>([]);
  const [requestSummary, setRequestSummary] = useState<PublicPlanRequestSummary | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [submittingRequestType, setSubmittingRequestType] = useState<PublicPlanRequestType | null>(
    null,
  );
  const [reportingComment, setReportingComment] = useState<PublicPlanComment | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadFeedback = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [nextComments, nextRequests] = await Promise.all([
        fetchPublicPlanComments(publicPlanId),
        fetchPublicPlanRequestSummary(publicPlanId),
      ]);
      setComments(nextComments);
      setRequestSummary(nextRequests);
    } catch (err) {
      setError(err instanceof Error ? err.message : '読み込みに失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, [publicPlanId]);

  useEffect(() => {
    void loadFeedback();
  }, [loadFeedback]);

  const rankedRequests = useMemo(() => {
    if (!requestSummary) return [];
    return PUBLIC_PLAN_REQUEST_TYPES.map((item) => ({
      ...item,
      count: requestSummary.counts[item.id],
    }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'ja'));
  }, [requestSummary]);

  const handleSubmitComment = async () => {
    if (!isLoggedIn) {
      onRequireLogin();
      return;
    }

    const trimmed = commentDraft.trim();
    if (!trimmed) return;

    setIsSubmittingComment(true);
    setError(null);
    try {
      const created = await postPublicPlanComment(publicPlanId, trimmed);
      setComments((prev) => [created, ...prev]);
      setCommentDraft('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'コメントの投稿に失敗しました';
      setError(message);
      Alert.alert('エラー', message);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleSubmitRequest = async (requestType: PublicPlanRequestType) => {
    if (!isLoggedIn) {
      onRequireLogin();
      return;
    }

    if (requestSummary?.myRequestTypes.includes(requestType)) return;

    setSubmittingRequestType(requestType);
    setError(null);
    try {
      const nextSummary = await submitPublicPlanRequest(publicPlanId, requestType);
      setRequestSummary(nextSummary);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'リクエストの送信に失敗しました';
      setError(message);
      Alert.alert('エラー', message);
    } finally {
      setSubmittingRequestType(null);
    }
  };

  return (
    <PremiumCard style={styles.card}>
      <Text style={styles.sectionTitle}>💬 コメント</Text>
      <Text style={styles.sectionLead}>
        プランへの感想や、改善してほしいことを伝えましょう。
      </Text>

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={NS.colors.accent} />
          <Text style={styles.loadingText}>読み込み中...</Text>
        </View>
      ) : (
        <>
          <View style={styles.requestsBlock}>
            <Text style={styles.blockLabel}>改善リクエスト</Text>
            <Text style={styles.blockHint}>
              {isLoggedIn
                ? 'ワンタップで作成者にリクエストを送れます'
                : 'ログインするとリクエストを送れます'}
            </Text>
            <View style={styles.requestGrid}>
              {PUBLIC_PLAN_REQUEST_TYPES.map((item) => {
                const count = requestSummary?.counts[item.id] ?? 0;
                const selected = requestSummary?.myRequestTypes.includes(item.id) ?? false;
                const isSubmitting = submittingRequestType === item.id;
                return (
                  <RequestChip
                    key={item.id}
                    label={item.label}
                    count={count}
                    selected={selected}
                    disabled={isSubmitting || selected}
                    onPress={() => void handleSubmitRequest(item.id)}
                  />
                );
              })}
            </View>

            {rankedRequests.length > 0 ? (
              <View style={styles.requestSummaryList}>
                {rankedRequests.map((item) => (
                  <View key={item.id} style={styles.requestSummaryRow}>
                    <Text style={styles.requestSummaryLabel}>{item.label}</Text>
                    <Text style={styles.requestSummaryCount}>{item.count}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyRequestsText}>まだリクエストはありません</Text>
            )}
          </View>

          {isCreator && requestSummary && requestSummary.totalCount > 0 ? (
            <View style={styles.creatorBlock}>
              <Text style={styles.creatorTitle}>このプランへのリクエスト</Text>
              <Text style={styles.creatorHint}>
                みんなから届いた改善希望です。次のプラン更新の参考にしてください。
              </Text>
              {rankedRequests.map((item) => (
                <View key={item.id} style={styles.creatorRequestRow}>
                  <Text style={styles.creatorRequestLabel}>{item.label}</Text>
                  <View style={styles.creatorRequestBadge}>
                    <Text style={styles.creatorRequestCount}>{item.count}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.commentsBlock}>
            <Text style={styles.blockLabel}>みんなのコメント</Text>
            {comments.length > 0 ? (
              <View style={styles.commentList}>
                {comments.map((comment) => (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    canReport={
                      isLoggedIn &&
                      comment.userId !== currentUserId &&
                      comment.userId !== creatorUserId
                    }
                    onReport={() => {
                      if (!isLoggedIn) {
                        onRequireLogin();
                        return;
                      }
                      setReportingComment(comment);
                    }}
                  />
                ))}
              </View>
            ) : (
              <Text style={styles.emptyCommentsText}>
                最初のコメントを投稿して、作成者を応援しましょう。
              </Text>
            )}
          </View>

          {isLoggedIn ? (
            <View style={styles.composeBlock}>
              <TextInput
                style={styles.commentInput}
                value={commentDraft}
                onChangeText={setCommentDraft}
                placeholder="このプランについてコメント..."
                placeholderTextColor={NS.colors.textMuted}
                multiline
                maxLength={MAX_COMMENT_LENGTH}
                textAlignVertical="top"
                editable={!isSubmittingComment}
              />
              <View style={styles.composeFooter}>
                <Text style={styles.charCount}>
                  {commentDraft.length}/{MAX_COMMENT_LENGTH}
                </Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.postButton,
                    (!commentDraft.trim() || isSubmittingComment) && styles.postButtonDisabled,
                    pressed && commentDraft.trim() && !isSubmittingComment && styles.postButtonPressed,
                  ]}
                  onPress={() => void handleSubmitComment()}
                  disabled={!commentDraft.trim() || isSubmittingComment}>
                  <Text style={styles.postButtonText}>
                    {isSubmittingComment ? '送信中...' : 'コメントする'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.loginPrompt, pressed && styles.loginPromptPressed]}
              onPress={onRequireLogin}>
              <Text style={styles.loginPromptText}>ログインしてコメント・リクエストを送る</Text>
            </Pressable>
          )}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </>
      )}

      <ReportReasonSheet
        visible={reportingComment !== null}
        title="コメントを通報"
        subtitle="問題の内容に最も近い理由を選んでください。"
        reasons={COMMENT_REPORT_REASONS}
        onClose={() => setReportingComment(null)}
        onSubmit={async (reason, details) => {
          if (!reportingComment) return;
          await reportComment(reportingComment.id, reason, details);
          Alert.alert(
            'ご報告ありがとうございます',
            '内容を確認いたします。安全なコミュニティ維持にご協力いただき、ありがとうございます。',
          );
        }}
      />
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.four,
    marginBottom: Spacing.three,
  },
  sectionTitle: {
    color: NS.colors.text,
    ...NS.typography.headline,
    marginBottom: Spacing.two,
  },
  sectionLead: {
    color: NS.colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: Spacing.four,
  },
  loadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.four,
  },
  loadingText: {
    color: NS.colors.textSecondary,
    fontSize: 13,
  },
  requestsBlock: {
    gap: Spacing.two,
    marginBottom: Spacing.four,
    paddingBottom: Spacing.four,
    borderBottomWidth: 1,
    borderBottomColor: NS.colors.border,
  },
  blockLabel: {
    color: NS.colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  blockHint: {
    color: NS.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  requestGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  requestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.pill,
    borderWidth: 1,
    borderColor: NS.colors.borderStrong,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    maxWidth: '100%',
  },
  requestChipSelected: {
    backgroundColor: NS.colors.accentSoft,
    borderColor: NS.colors.accentBorder,
  },
  requestChipPressed: {
    opacity: 0.88,
  },
  requestChipDisabled: {
    opacity: 0.72,
  },
  requestChipLabel: {
    color: NS.colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
  requestChipLabelSelected: {
    color: NS.colors.accent,
  },
  requestCountBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: NS.colors.bgCard,
    borderWidth: 1,
    borderColor: NS.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  requestCountBadgeSelected: {
    backgroundColor: NS.colors.accent,
    borderColor: NS.colors.accent,
  },
  requestCountText: {
    color: NS.colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  requestCountTextSelected: {
    color: NS.colors.bg,
  },
  requestSummaryList: {
    marginTop: Spacing.two,
    gap: Spacing.one + 2,
  },
  requestSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  requestSummaryLabel: {
    flex: 1,
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  requestSummaryCount: {
    color: NS.colors.accent,
    fontSize: 14,
    fontWeight: '800',
    minWidth: 24,
    textAlign: 'right',
  },
  emptyRequestsText: {
    color: NS.colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: Spacing.one,
  },
  creatorBlock: {
    backgroundColor: NS.colors.accentSoft,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
    padding: Spacing.four,
    gap: Spacing.two,
    marginBottom: Spacing.four,
  },
  creatorTitle: {
    color: NS.colors.accent,
    fontSize: 15,
    fontWeight: '800',
  },
  creatorHint: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: Spacing.one,
  },
  creatorRequestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  creatorRequestLabel: {
    flex: 1,
    color: NS.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  creatorRequestBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: NS.colors.bgElevated,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  creatorRequestCount: {
    color: NS.colors.accent,
    fontSize: 13,
    fontWeight: '800',
  },
  commentsBlock: {
    gap: Spacing.three,
    marginBottom: Spacing.four,
  },
  commentList: {
    gap: Spacing.three,
  },
  commentItem: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: NS.colors.bgCard,
    borderWidth: 1,
    borderColor: NS.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentInitial: {
    color: NS.colors.accent,
    fontSize: 14,
    fontWeight: '800',
  },
  commentBody: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.one,
  },
  commentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  commentName: {
    color: NS.colors.text,
    fontSize: 13,
    fontWeight: '800',
    flexShrink: 1,
  },
  commentTime: {
    color: NS.colors.textMuted,
    fontSize: 11,
  },
  commentText: {
    color: NS.colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  commentReportButton: {
    alignSelf: 'flex-start',
    marginTop: Spacing.one,
    paddingVertical: 4,
  },
  commentReportText: {
    color: NS.colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  emptyCommentsText: {
    color: NS.colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  composeBlock: {
    gap: Spacing.two,
  },
  commentInput: {
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.borderStrong,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    color: NS.colors.text,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 96,
  },
  composeFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  charCount: {
    color: NS.colors.textMuted,
    fontSize: 11,
  },
  postButton: {
    backgroundColor: NS.colors.accent,
    borderRadius: NS.radius.pill,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two + 2,
  },
  postButtonPressed: {
    opacity: 0.9,
  },
  postButtonDisabled: {
    opacity: 0.45,
  },
  postButtonText: {
    color: NS.colors.bg,
    fontSize: 13,
    fontWeight: '800',
  },
  loginPrompt: {
    backgroundColor: NS.colors.bgCard,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.borderStrong,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  loginPromptPressed: {
    opacity: 0.88,
  },
  loginPromptText: {
    color: NS.colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 12,
    lineHeight: 18,
    marginTop: Spacing.two,
  },
});
