import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { SuccessOverlay } from '@/components/success-overlay';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { savePublicPlanToMyTrips, togglePublicPlanLike } from '@/lib/public-plans';
import type { PublicPlan } from '@/types/public-plan';

type PublicPlanActionsProps = {
  plan: PublicPlan;
  isLoggedIn: boolean;
  onRequireLogin: () => void;
  onPlanUpdate: (plan: PublicPlan) => void;
  onSaved?: (savedTripId: string) => void;
};

export function PublicPlanActions({
  plan,
  isLoggedIn,
  onRequireLogin,
  onPlanUpdate,
  onSaved,
}: PublicPlanActionsProps) {
  const [isLiking, setIsLiking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState<string | null>(null);

  const handleLike = async () => {
    if (!isLoggedIn) {
      onRequireLogin();
      return;
    }

    setIsLiking(true);
    try {
      const result = await togglePublicPlanLike(plan.id);
      onPlanUpdate({
        ...plan,
        likedByMe: result.liked,
        likeCount: result.likeCount,
      });
    } catch (error) {
      Alert.alert(
        'エラー',
        error instanceof Error ? error.message : 'いいねに失敗しました',
      );
    } finally {
      setIsLiking(false);
    }
  };

  const handleSave = async () => {
    if (!isLoggedIn) {
      onRequireLogin();
      return;
    }

    if (plan.savedByMe) {
      Alert.alert('保存済み', 'このプランはすでに保存済みプランに追加されています。');
      return;
    }

    setIsSaving(true);
    try {
      const { savedTripId } = await savePublicPlanToMyTrips(plan.id);
      onPlanUpdate({
        ...plan,
        savedByMe: true,
        saveCount: plan.saveCount + 1,
      });
      setShowSuccess('保存済みプランに追加しました');
      setTimeout(() => setShowSuccess(null), 1600);
      onSaved?.(savedTripId);
    } catch (error) {
      Alert.alert(
        'エラー',
        error instanceof Error ? error.message : '保存に失敗しました',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <SuccessOverlay visible={Boolean(showSuccess)} message={showSuccess ?? ''} />
      <View style={styles.wrap}>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            plan.likedByMe && styles.buttonActive,
            pressed && styles.buttonPressed,
            isLiking && styles.buttonDisabled,
          ]}
          onPress={() => void handleLike()}
          disabled={isLiking}>
          <Text style={[styles.buttonLabel, plan.likedByMe && styles.buttonLabelActive]}>
            {isLiking
              ? 'いいね中...'
              : plan.likedByMe
                ? `♥ いいね済み · ${plan.likeCount}`
                : `♡ いいね · ${plan.likeCount}`}
          </Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            plan.savedByMe && styles.buttonActive,
            pressed && styles.buttonPressed,
            isSaving && styles.buttonDisabled,
          ]}
          onPress={() => void handleSave()}
          disabled={isSaving}>
          <Text style={[styles.buttonLabel, plan.savedByMe && styles.buttonLabelActive]}>
            {plan.savedByMe ? '📌 保存済み' : isSaving ? '保存中...' : '📌 保存'} ·{' '}
            {plan.saveCount}
          </Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  button: {
    flex: 1,
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.sm,
    borderWidth: 1,
    borderColor: NS.colors.borderStrong,
    paddingVertical: Spacing.two + 2,
    paddingHorizontal: Spacing.two,
    alignItems: 'center',
  },
  buttonActive: {
    backgroundColor: NS.colors.accentSoft,
    borderColor: NS.colors.accentBorder,
  },
  buttonPressed: {
    opacity: 0.88,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonLabel: {
    color: NS.colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  buttonLabelActive: {
    color: NS.colors.accent,
  },
});
