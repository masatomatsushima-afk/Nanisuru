import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SuccessOverlay } from '@/components/success-overlay';
import { FadeInView } from '@/components/ui/fade-in-view';
import { PremiumCard, PrimaryButton } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { submitBetaFeedback } from '@/lib/beta-feedback';
import {
  BETA_TEST_CHECKLIST,
  BETA_TEST_SHARE_MESSAGE,
  type BetaTestChecklistId,
} from '@/types/beta-feedback';

const CHECKLIST_STORAGE_KEY = 'nanisuru_beta_checklist_v1';

function StarRating({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (stars: number) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= value;
        return (
          <Pressable
            key={star}
            style={({ pressed }) => [styles.starButton, pressed && !disabled && styles.starPressed]}
            onPress={() => onChange(star)}
            disabled={disabled}>
            <Text style={[styles.star, filled ? styles.starFilled : styles.starEmpty]}>
              {filled ? '★' : '☆'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function FeedbackField({
  label,
  value,
  onChangeText,
  placeholder,
  editable,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  editable: boolean;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={NS.colors.textMuted}
        multiline
        textAlignVertical="top"
        editable={editable}
      />
    </View>
  );
}

async function copyShareMessage(): Promise<boolean> {
  try {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(BETA_TEST_SHARE_MESSAGE);
      return true;
    }
    await Clipboard.setStringAsync(BETA_TEST_SHARE_MESSAGE);
    return true;
  } catch {
    return false;
  }
}

export default function BetaTestScreen() {
  const insets = useSafeAreaInsets();
  const { session, isConfigured } = useAuth();

  const [checkedIds, setCheckedIds] = useState<Set<BetaTestChecklistId>>(new Set());
  const [rating, setRating] = useState(0);
  const [easeOfUse, setEaseOfUse] = useState('');
  const [confusingPoints, setConfusingPoints] = useState('');
  const [wouldUseAgain, setWouldUseAgain] = useState('');
  const [wouldRecommend, setWouldRecommend] = useState('');
  const [requestedFeatures, setRequestedFeatures] = useState('');
  const [bugReport, setBugReport] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const loadChecklist = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(CHECKLIST_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as BetaTestChecklistId[];
      setCheckedIds(new Set(parsed));
    } catch {
      // ignore corrupt storage
    }
  }, []);

  useEffect(() => {
    void loadChecklist();
  }, [loadChecklist]);

  const persistChecklist = async (next: Set<BetaTestChecklistId>) => {
    setCheckedIds(next);
    try {
      await AsyncStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify([...next]));
    } catch {
      // non-critical
    }
  };

  const toggleChecklistItem = (id: BetaTestChecklistId) => {
    const next = new Set(checkedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    void persistChecklist(next);
  };

  const handleShareInvite = async () => {
    try {
      if (Platform.OS === 'web') {
        const copied = await copyShareMessage();
        Alert.alert(
          copied ? 'コピーしました' : '共有',
          copied
            ? '友達へのメッセージをクリップボードにコピーしました。'
            : BETA_TEST_SHARE_MESSAGE,
        );
        return;
      }

      await Share.share({ message: BETA_TEST_SHARE_MESSAGE });
    } catch {
      const copied = await copyShareMessage();
      Alert.alert(
        copied ? 'コピーしました' : '共有できませんでした',
        copied ? 'メッセージをクリップボードにコピーしました。' : 'もう一度お試しください。',
      );
    }
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('星を選んでください', '全体の満足度を1〜5の星で評価してください。');
      return;
    }

    if (!session) {
      Alert.alert('ログインが必要です', '感想を送るにはログインしてください。', [
        { text: 'キャンセル', style: 'cancel' },
        { text: 'ログイン', onPress: () => router.push('/login') },
      ]);
      return;
    }

    if (!isConfigured) {
      Alert.alert(
        'Supabase未設定',
        'beta_feedback テーブルを作成してから送信してください。',
      );
      return;
    }

    if (isSubmitting || isSubmitted) return;

    setIsSubmitting(true);
    try {
      await submitBetaFeedback({
        rating,
        easeOfUse,
        confusingPoints,
        wouldUseAgain,
        wouldRecommend,
        requestedFeatures,
        bugReport,
      });
      setIsSubmitted(true);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 1800);
    } catch (error) {
      Alert.alert(
        '送信に失敗しました',
        error instanceof Error ? error.message : 'もう一度お試しください。',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const checkedCount = checkedIds.size;
  const totalCount = BETA_TEST_CHECKLIST.length;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + Spacing.three,
            paddingBottom: insets.bottom + Spacing.six,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← マイページ</Text>
        </Pressable>

        <FadeInView>
          <View style={styles.heroGlow} />
          <Text style={styles.eyebrow}>BETA TEST</Text>
          <Text style={styles.title}>Nanisuruテスト</Text>
          <Text style={styles.subtitle}>
            家族や友達と一緒に触ってみて、気づいたことを教えてください。あなたの一言が、次の改善につながります。
          </Text>
        </FadeInView>

        <FadeInView delay={60}>
          <PremiumCard style={styles.progressCard}>
            <Text style={styles.progressLabel}>テスト進捗</Text>
            <Text style={styles.progressValue}>
              {checkedCount}/{totalCount} 完了
            </Text>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${totalCount > 0 ? (checkedCount / totalCount) * 100 : 0}%` },
                ]}
              />
            </View>
          </PremiumCard>
        </FadeInView>

        <FadeInView delay={90}>
          <PremiumCard style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>テストチェックリスト</Text>
            <Text style={styles.sectionLead}>
              試した項目にチェックを入れてください（端末に保存されます）
            </Text>
            {BETA_TEST_CHECKLIST.map((item) => {
              const checked = checkedIds.has(item.id);
              return (
                <Pressable
                  key={item.id}
                  style={({ pressed }) => [
                    styles.checkRow,
                    checked && styles.checkRowDone,
                    pressed && styles.checkRowPressed,
                  ]}
                  onPress={() => toggleChecklistItem(item.id)}>
                  <View style={[styles.checkbox, checked && styles.checkboxDone]}>
                    <Text style={styles.checkboxMark}>{checked ? '✓' : ''}</Text>
                  </View>
                  <View style={styles.checkTextWrap}>
                    <Text style={[styles.checkLabel, checked && styles.checkLabelDone]}>
                      {item.label}
                    </Text>
                    <Text style={styles.checkHint}>{item.hint}</Text>
                  </View>
                </Pressable>
              );
            })}
          </PremiumCard>
        </FadeInView>

        <FadeInView delay={120}>
          <PremiumCard style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>使ってみた感想</Text>
            <Text style={styles.sectionLead}>全体の満足度（1〜5）</Text>
            <StarRating value={rating} onChange={setRating} disabled={isSubmitted} />

            <FeedbackField
              label="使いやすかったですか？"
              value={easeOfUse}
              onChangeText={setEaseOfUse}
              placeholder="例：プラン生成はスムーズだった / ボタンの場所が分かりにくかった"
              editable={!isSubmitted}
            />
            <FeedbackField
              label="どこで迷いましたか？"
              value={confusingPoints}
              onChangeText={setConfusingPoints}
              placeholder="例：公開プランの作り方 / 発見タブの使い方"
              editable={!isSubmitted}
            />
            <FeedbackField
              label="もう一度使いたいと思いましたか？"
              value={wouldUseAgain}
              onChangeText={setWouldUseAgain}
              placeholder="例：週末のデート前にまた使いたい"
              editable={!isSubmitted}
            />
            <FeedbackField
              label="友達や恋人に勧めたいですか？"
              value={wouldRecommend}
              onChangeText={setWouldRecommend}
              placeholder="例：カップル向けに勧めたい / まだ早い"
              editable={!isSubmitted}
            />
            <FeedbackField
              label="欲しい機能はありますか？"
              value={requestedFeatures}
              onChangeText={setRequestedFeatures}
              placeholder="例：友達とプラン共有 / 予算自動計算"
              editable={!isSubmitted}
            />
            <FeedbackField
              label="不具合があれば教えてください"
              value={bugReport}
              onChangeText={setBugReport}
              placeholder="例：ログイン後に画面が固まった / 地図が開けない"
              editable={!isSubmitted}
            />

            {isSubmitted ? (
              <View style={styles.thankYouBox}>
                <Text style={styles.thankYouTitle}>フィードバックありがとうございます！</Text>
                <Text style={styles.thankYouText}>
                  いただいた感想は、Nanisuruをより良くするために大切に読ませていただきます。
                </Text>
              </View>
            ) : (
              <PrimaryButton
                label={isSubmitting ? '送信中...' : '感想を送る'}
                onPress={() => void handleSubmit()}
                disabled={isSubmitting}
              />
            )}
          </PremiumCard>
        </FadeInView>

        <FadeInView delay={150}>
          <PremiumCard variant="flat" style={styles.shareCard}>
            <Text style={styles.shareTitle}>友達にも試してもらう</Text>
            <Text style={styles.shareText}>
              大切な人に、テスト参加のお願いメッセージを送れます。
            </Text>
            <PrimaryButton
              label="友達にテストをお願いする"
              variant="secondary"
              onPress={() => void handleShareInvite()}
            />
          </PremiumCard>
        </FadeInView>
      </ScrollView>

      <SuccessOverlay
        visible={showSuccess}
        message="フィードバックありがとうございます！"
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: NS.colors.bg,
  },
  container: {
    flex: 1,
    backgroundColor: NS.colors.bg,
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
  },
  backButtonText: {
    color: NS.colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  heroGlow: {
    position: 'absolute',
    top: -10,
    right: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: NS.colors.accentGlow,
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
    lineHeight: 22,
    marginBottom: Spacing.four,
  },
  progressCard: {
    padding: Spacing.four,
    marginBottom: Spacing.three,
  },
  progressLabel: {
    color: NS.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: Spacing.one,
  },
  progressValue: {
    color: NS.colors.text,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: Spacing.two,
  },
  progressTrack: {
    height: 8,
    borderRadius: NS.radius.pill,
    backgroundColor: NS.colors.bgInput,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: NS.radius.pill,
    backgroundColor: NS.colors.accent,
  },
  sectionCard: {
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
    fontSize: 13,
    lineHeight: 20,
    marginBottom: Spacing.three,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: NS.colors.border,
  },
  checkRowDone: {
    opacity: 0.88,
  },
  checkRowPressed: {
    opacity: 0.92,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: NS.colors.borderStrong,
    backgroundColor: NS.colors.bgInput,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxDone: {
    backgroundColor: NS.colors.accent,
    borderColor: NS.colors.accent,
  },
  checkboxMark: {
    color: NS.colors.bg,
    fontSize: 14,
    fontWeight: '900',
  },
  checkTextWrap: {
    flex: 1,
  },
  checkLabel: {
    color: NS.colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  checkLabelDone: {
    color: NS.colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  checkHint: {
    color: NS.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  starRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.four,
  },
  starButton: {
    padding: Spacing.one,
  },
  starPressed: {
    opacity: 0.85,
  },
  star: {
    fontSize: 34,
  },
  starFilled: {
    color: NS.colors.accent,
  },
  starEmpty: {
    color: NS.colors.textMuted,
  },
  fieldWrap: {
    marginBottom: Spacing.three,
  },
  fieldLabel: {
    color: NS.colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: Spacing.two,
  },
  fieldInput: {
    minHeight: 88,
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.border,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    color: NS.colors.text,
    fontSize: 14,
    lineHeight: 22,
  },
  thankYouBox: {
    backgroundColor: NS.colors.successSoft,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.25)',
    padding: Spacing.four,
    marginTop: Spacing.two,
  },
  thankYouTitle: {
    color: NS.colors.success,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: Spacing.two,
  },
  thankYouText: {
    color: NS.colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  shareCard: {
    padding: Spacing.four,
    marginBottom: Spacing.three,
  },
  shareTitle: {
    color: NS.colors.text,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: Spacing.two,
  },
  shareText: {
    color: NS.colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: Spacing.four,
  },
});
