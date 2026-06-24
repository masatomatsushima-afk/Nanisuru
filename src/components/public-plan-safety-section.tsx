import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { ReportReasonSheet } from '@/components/report-reason-sheet';
import { PremiumCard } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { reportPublicPlan } from '@/lib/content-reports';
import { blockUser } from '@/lib/user-blocks';
import { deletePublicPlan, stopPublicPlan } from '@/lib/public-plans';
import { PLAN_REPORT_REASONS, MODERATION_STATUS_LABELS, type ModerationStatus } from '@/types/moderation';
import type { PublicPlan } from '@/types/public-plan';

type PublicPlanSafetySectionProps = {
  plan: PublicPlan;
  isCreator: boolean;
  isLoggedIn: boolean;
  onRequireLogin: () => void;
  onPlanUpdated?: (plan: PublicPlan) => void;
  onPlanRemoved?: () => void;
  onUserBlocked?: () => void;
};

function SafetyButton({
  label,
  tone = 'neutral',
  onPress,
  disabled,
}: {
  label: string;
  tone?: 'neutral' | 'danger';
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.actionButton,
        tone === 'danger' && styles.actionButtonDanger,
        pressed && !disabled && styles.actionButtonPressed,
        disabled && styles.actionButtonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}>
      <Text
        style={[
          styles.actionButtonText,
          tone === 'danger' && styles.actionButtonTextDanger,
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function PublicPlanSafetySection({
  plan,
  isCreator,
  isLoggedIn,
  onRequireLogin,
  onPlanUpdated,
  onPlanRemoved,
  onUserBlocked,
}: PublicPlanSafetySectionProps) {
  const [showReportSheet, setShowReportSheet] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const showModerationNotice =
    isCreator &&
    (plan.moderationStatus !== 'active' || plan.isRemoved || !plan.isPublic);

  const handleReport = async (reason: string, details: string) => {
    await reportPublicPlan(plan.id, reason, details);
    Alert.alert(
      'ご報告ありがとうございます',
      '内容を確認いたします。安全なコミュニティ維持にご協力いただき、ありがとうございます。',
    );
  };

  const handleBlockUser = () => {
    if (!isLoggedIn) {
      onRequireLogin();
      return;
    }

    Alert.alert(
      'ユーザーをブロック',
      'このユーザーをブロックしますか？今後、このユーザーの公開プランやコメントは表示されなくなります。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: 'ブロックする',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setIsProcessing(true);
              try {
                await blockUser(plan.userId);
                Alert.alert('ブロックしました', 'このユーザーのコンテンツは表示されなくなりました。');
                onUserBlocked?.();
              } catch (error) {
                Alert.alert(
                  'エラー',
                  error instanceof Error ? error.message : 'ブロックに失敗しました',
                );
              } finally {
                setIsProcessing(false);
              }
            })();
          },
        },
      ],
    );
  };

  const handleStopPublic = () => {
    Alert.alert(
      '公開を停止',
      'このプランを非公開に戻します。発見タブからは表示されなくなります。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '公開を停止する',
          onPress: () => {
            void (async () => {
              setIsProcessing(true);
              try {
                const updated = await stopPublicPlan(plan.id);
                onPlanUpdated?.(updated);
                Alert.alert('非公開にしました', 'プランは非公開に戻りました。');
              } catch (error) {
                Alert.alert(
                  'エラー',
                  error instanceof Error ? error.message : '公開の停止に失敗しました',
                );
              } finally {
                setIsProcessing(false);
              }
            })();
          },
        },
      ],
    );
  };

  const handleDeletePublic = () => {
    Alert.alert(
      '公開プランを削除',
      'この公開プランを削除しますか？この操作は元に戻せません。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除する',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setIsProcessing(true);
              try {
                await deletePublicPlan(plan.id);
                onPlanRemoved?.();
              } catch (error) {
                Alert.alert(
                  'エラー',
                  error instanceof Error ? error.message : '削除に失敗しました',
                );
              } finally {
                setIsProcessing(false);
              }
            })();
          },
        },
      ],
    );
  };

  return (
    <>
      <PremiumCard style={styles.card}>
        <Text style={styles.title}>安全・プライバシー</Text>

        {showModerationNotice ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              ステータス: {MODERATION_STATUS_LABELS[plan.moderationStatus as ModerationStatus]}
              {plan.isRemoved ? ' · 公開から削除済み' : ''}
              {!plan.isPublic ? ' · 非公開' : ''}
            </Text>
          </View>
        ) : null}

        {isCreator ? (
          <View style={styles.actions}>
            {plan.isPublic && !plan.isRemoved ? (
              <SafetyButton
                label="公開を停止する"
                onPress={handleStopPublic}
                disabled={isProcessing}
              />
            ) : !plan.isRemoved ? (
              <SafetyButton
                label="非公開に戻す"
                onPress={handleStopPublic}
                disabled={isProcessing}
              />
            ) : null}
            {!plan.isRemoved ? (
              <SafetyButton
                label="公開プランを削除"
                tone="danger"
                onPress={handleDeletePublic}
                disabled={isProcessing}
              />
            ) : null}
          </View>
        ) : (
          <View style={styles.actions}>
            <SafetyButton
              label="このプランを通報"
              onPress={() => {
                if (!isLoggedIn) {
                  onRequireLogin();
                  return;
                }
                setShowReportSheet(true);
              }}
              disabled={isProcessing}
            />
            <SafetyButton
              label="このユーザーをブロック"
              onPress={handleBlockUser}
              disabled={isProcessing}
            />
          </View>
        )}
      </PremiumCard>

      <ReportReasonSheet
        visible={showReportSheet}
        title="プランを通報"
        subtitle="問題の内容に最も近い理由を選んでください。"
        reasons={PLAN_REPORT_REASONS}
        onClose={() => setShowReportSheet(false)}
        onSubmit={handleReport}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.four,
    marginBottom: Spacing.three,
  },
  title: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: Spacing.three,
    letterSpacing: 0.3,
  },
  notice: {
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.border,
    padding: Spacing.three,
    marginBottom: Spacing.three,
  },
  noticeText: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  actions: {
    gap: Spacing.two,
  },
  actionButton: {
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.border,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  actionButtonDanger: {
    backgroundColor: NS.colors.dangerSoft,
    borderColor: 'rgba(248, 113, 113, 0.2)',
  },
  actionButtonPressed: {
    opacity: 0.9,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    color: NS.colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  actionButtonTextDanger: {
    color: NS.colors.danger,
  },
});
