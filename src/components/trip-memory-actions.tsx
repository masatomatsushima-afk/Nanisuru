import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import {
  addTripMemoryComment,
  toggleTripMemoryLike,
  toggleTripMemorySave,
} from '@/lib/trip-memories';
import type { TripMemory, TripMemoryComment } from '@/types/trip-memory';

type TripMemoryActionsProps = {
  memory: TripMemory;
  isLoggedIn: boolean;
  isOwner: boolean;
  isLiked: boolean;
  isSaved: boolean;
  comments: TripMemoryComment[];
  onRequireLogin: () => void;
  onMemoryUpdate: (patch: Partial<TripMemory>) => void;
  onEngagementUpdate: (patch: { isLiked?: boolean; isSaved?: boolean }) => void;
  onCommentAdded: (comment: TripMemoryComment) => void;
};

function ActionButton({
  label,
  active,
  disabled,
  onPress,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.actionButton,
        active && styles.actionButtonActive,
        pressed && styles.actionButtonPressed,
        disabled && styles.actionButtonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}>
      <Text style={[styles.actionLabel, active && styles.actionLabelActive]}>{label}</Text>
    </Pressable>
  );
}

export function TripMemoryActions({
  memory,
  isLoggedIn,
  isOwner,
  isLiked,
  isSaved,
  comments,
  onRequireLogin,
  onMemoryUpdate,
  onEngagementUpdate,
  onCommentAdded,
}: TripMemoryActionsProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const isPublic = memory.visibility === 'public';

  const runToggle = async (key: string, action: () => Promise<void>) => {
    if (!isLoggedIn) {
      onRequireLogin();
      return;
    }
    setBusy(key);
    try {
      await action();
    } catch (error) {
      Alert.alert('エラー', error instanceof Error ? error.message : '操作に失敗しました');
    } finally {
      setBusy(null);
    }
  };

  const handleReferencePlan = () => {
    if (memory.tripId && isOwner) {
      router.push(`/saved-trip/${memory.tripId}`);
      return;
    }
    Alert.alert(
      'プランを参考にする',
      'この思い出の元プランをもとに、新しい旅を計画できます。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '旅を計画する',
          onPress: () => router.push('/(tabs)'),
        },
      ],
    );
  };

  if (!isPublic && !isOwner) return null;

  return (
    <View style={styles.wrap}>
      {isPublic ? (
        <View style={styles.actionRow}>
          <ActionButton
            label={`♥ ${memory.likeCount}`}
            active={isLiked}
            disabled={busy === 'like'}
            onPress={() =>
              void runToggle('like', async () => {
                const result = await toggleTripMemoryLike(memory.id);
                onMemoryUpdate({ likeCount: result.likeCount });
                onEngagementUpdate({ isLiked: result.liked });
              })
            }
          />
          <ActionButton
            label={`🔖 ${memory.saveCount}`}
            active={isSaved}
            disabled={busy === 'save'}
            onPress={() =>
              void runToggle('save', async () => {
                const result = await toggleTripMemorySave(memory.id);
                onMemoryUpdate({ saveCount: result.saveCount });
                onEngagementUpdate({ isSaved: result.saved });
              })
            }
          />
          <ActionButton label="📋 このプランを参考にする" onPress={handleReferencePlan} />
        </View>
      ) : null}

      {isPublic ? (
        <View style={styles.commentSection}>
          <Text style={styles.commentTitle}>💬 コメント ({memory.commentCount})</Text>
          {comments.map((comment) => (
            <View key={comment.id} style={styles.commentItem}>
              <Text style={styles.commentBody}>{comment.body}</Text>
            </View>
          ))}
          {isLoggedIn ? (
            <>
              <TextInput
                style={styles.commentInput}
                placeholder="感想を書く..."
                placeholderTextColor={NS.colors.textMuted}
                value={commentDraft}
                onChangeText={setCommentDraft}
              />
              <PrimaryButton
                label={busy === 'comment' ? '送信中...' : 'コメントする'}
                disabled={!commentDraft.trim() || busy === 'comment'}
                onPress={() =>
                  void runToggle('comment', async () => {
                    const comment = await addTripMemoryComment(memory.id, commentDraft);
                    setCommentDraft('');
                    onCommentAdded(comment);
                    onMemoryUpdate({ commentCount: memory.commentCount + 1 });
                  })
                }
              />
            </>
          ) : (
            <Pressable onPress={onRequireLogin}>
              <Text style={styles.loginHint}>ログインしてコメントする</Text>
            </Pressable>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.four,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  actionButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: NS.radius.pill,
    backgroundColor: NS.colors.bgInput,
    borderWidth: 1,
    borderColor: NS.colors.border,
  },
  actionButtonActive: {
    backgroundColor: NS.colors.coralSoft,
    borderColor: NS.colors.coral,
  },
  actionButtonPressed: {
    opacity: 0.85,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: NS.colors.textSecondary,
  },
  actionLabelActive: {
    color: NS.colors.coral,
  },
  commentSection: {
    gap: Spacing.two,
  },
  commentTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: NS.colors.text,
  },
  commentItem: {
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.lg,
    padding: Spacing.three,
  },
  commentBody: {
    fontSize: 14,
    color: NS.colors.text,
    lineHeight: 20,
  },
  commentInput: {
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.lg,
    padding: Spacing.three,
    fontSize: 14,
    color: NS.colors.text,
  },
  loginHint: {
    fontSize: 13,
    fontWeight: '700',
    color: NS.colors.accent,
  },
});
