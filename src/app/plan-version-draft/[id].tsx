import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppErrorBanner } from '@/components/app-error-banner';
import { RequireAuthGate } from '@/components/require-auth-gate';
import { PlanTimelineEditor } from '@/components/plan-timeline-editor';
import { SuccessOverlay } from '@/components/success-overlay';
import { PrimaryButton, SectionHeader } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { getPublicPlanById } from '@/lib/public-plans';
import {
  getVersionRecordForPlan,
  publishVersionDraft,
  saveVersionDraft,
} from '@/lib/public-plan-versions';
import { flattenItineraryDays } from '@/lib/trip-duration';
import { getVersionShortLabel } from '@/types/public-plan-feedback';
import type { PublicPlan } from '@/types/public-plan';
import type { SavedTripPayload } from '@/types/trip';

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={NS.colors.textMuted}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
  );
}

export default function PlanVersionDraftScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, isLoading: authLoading } = useAuth();

  const [plan, setPlan] = useState<PublicPlan | null>(null);
  const [versionLabel, setVersionLabel] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [payload, setPayload] = useState<SavedTripPayload | null>(null);
  const [notes, setNotes] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [showSuccess, setShowSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDraft = useCallback(async () => {
    if (!id || !session) return;

    setIsLoading(true);
    setError(null);
    try {
      const loaded = await getPublicPlanById(id);
      if (!loaded) {
        setError('下書きが見つかりませんでした');
        return;
      }
      if (loaded.userId !== session.user.id) {
        setError('この下書きを編集する権限がありません');
        return;
      }

      const versionRecord = await getVersionRecordForPlan(id);
      if (!versionRecord) {
        setError('別バージョンの下書きではありません');
        return;
      }

      setPlan(loaded);
      setVersionLabel(getVersionShortLabel(versionRecord.versionType));
      setTitle(loaded.title);
      setDescription(loaded.description);
      setPayload({
        ...loaded.payload,
        items: flattenItineraryDays(loaded.payload.days),
      });
      setNotes(loaded.payload.notes ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : '下書きの読み込みに失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, [id, session]);

  useEffect(() => {
    if (authLoading || !session) return;
    void loadDraft();
  }, [authLoading, session, loadDraft]);

  const buildPayload = (): SavedTripPayload | null => {
    if (!payload) return null;
    return {
      ...payload,
      notes: notes.trim(),
      items: flattenItineraryDays(payload.days),
    };
  };

  const handleSaveDraft = async (): Promise<boolean> => {
    if (!plan || !payload) return false;

    const nextPayload = buildPayload();
    if (!nextPayload) return false;

    setIsSaving(true);
    setError(null);
    try {
      const saved = await saveVersionDraft({
        planId: plan.id,
        title,
        description,
        payload: nextPayload,
      });
      setPlan(saved);
      setTitle(saved.title);
      setDescription(saved.description);
      setPayload({
        ...saved.payload,
        items: flattenItineraryDays(saved.payload.days),
      });
      setNotes(saved.payload.notes ?? '');
      setShowSuccess('下書きを保存しました');
      setTimeout(() => setShowSuccess(null), 1600);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!plan) return;

    const saved = await handleSaveDraft();
    if (!saved) return;

    setIsPublishing(true);
    setError(null);
    try {
      const published = await publishVersionDraft(plan.id);
      setShowSuccess('別バージョンを公開しました');
      setTimeout(() => {
        setShowSuccess(null);
        router.replace(`/public-plan/${published.id}`);
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : '公開に失敗しました');
    } finally {
      setIsPublishing(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <RequireAuthGate
        title="下書き編集にはログインが必要です"
        description="AIバージョンの下書きを編集するには、ログインしてください。"
        loadingMessage="確認中...">
        <View style={[styles.centered, { paddingTop: insets.top }]}>
          <ActivityIndicator size="large" color={NS.colors.accent} />
          <Text style={styles.loadingText}>下書きを読み込み中...</Text>
        </View>
      </RequireAuthGate>
    );
  }

  if (error && !plan) {
    return (
      <RequireAuthGate
        title="下書き編集にはログインが必要です"
        description="AIバージョンの下書きを編集するには、ログインしてください。"
        loadingMessage="確認中...">
        <View style={[styles.centered, styles.container, { paddingTop: insets.top + Spacing.four }]}>
          <Text style={styles.errorTitle}>下書きを開けません</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.linkButton} onPress={() => router.back()}>
            <Text style={styles.linkButtonText}>戻る</Text>
          </Pressable>
        </View>
      </RequireAuthGate>
    );
  }

  if (!plan || !payload) return null;

  return (
    <RequireAuthGate
      title="下書き編集にはログインが必要です"
      description="AIバージョンの下書きを編集するには、ログインしてください。"
      loadingMessage="確認中...">
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SuccessOverlay visible={Boolean(showSuccess)} message={showSuccess ?? ''} />

      <ScrollView
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
          <Text style={styles.backButtonText}>← 戻る</Text>
        </Pressable>

        <View style={styles.hero}>
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>別バージョン下書き</Text>
            </View>
            <View style={styles.versionBadge}>
              <Text style={styles.versionBadgeText}>{versionLabel}</Text>
            </View>
          </View>
          <Text style={styles.title}>内容を確認して公開</Text>
          <Text style={styles.heroSubtitle}>
            AIが生成したプランを編集し、準備ができたら公開できます。
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <SectionHeader title="基本情報" subtitle="タイトルと説明を調整" />
          <FormField
            label="タイトル"
            value={title}
            onChangeText={setTitle}
            placeholder="例：渋谷デート · 雨の日版"
          />
          <FormField
            label="説明"
            value={description}
            onChangeText={setDescription}
            placeholder="このバージョンの魅力を紹介..."
            multiline
          />
        </View>

        <View style={styles.sectionCard}>
          <SectionHeader title="予算・メモ" subtitle="概算費用と作成メモ" />
          <FormField
            label="合計予算（概算）"
            value={payload.details.totalBudget ?? ''}
            onChangeText={(text) =>
              setPayload((prev) =>
                prev
                  ? {
                      ...prev,
                      details: { ...prev.details, totalBudget: text },
                    }
                  : prev,
              )
            }
            placeholder="例）¥8,000"
          />
          <FormField
            label="メモ"
            value={notes}
            onChangeText={setNotes}
            placeholder="公開前のメモや調整ポイント..."
            multiline
          />
        </View>

        <View style={styles.sectionCard}>
          <SectionHeader title="行程タイムライン" subtitle="スポット名・時間・費用を編集" />
          <PlanTimelineEditor
            days={payload.days}
            onChange={(days) =>
              setPayload((prev) =>
                prev
                  ? {
                      ...prev,
                      days,
                      items: flattenItineraryDays(days),
                    }
                  : prev,
              )
            }
          />
        </View>

        {error ? <AppErrorBanner message={error} /> : null}

        <View style={styles.actions}>
          <PrimaryButton
            label={isSaving ? '保存中...' : '下書き保存'}
            variant="secondary"
            onPress={() => void handleSaveDraft()}
            disabled={isSaving || isPublishing}
          />
          <PrimaryButton
            label={isPublishing ? '公開中...' : '公開する'}
            onPress={() => {
              Alert.alert(
                '別バージョンを公開',
                '発見タブと公開ページに表示されます。よろしいですか？',
                [
                  { text: 'キャンセル', style: 'cancel' },
                  { text: '公開する', onPress: () => void handlePublish() },
                ],
              );
            }}
            disabled={isSaving || isPublishing}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    </RequireAuthGate>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NS.colors.bg,
  },
  centered: {
    flex: 1,
    backgroundColor: NS.colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  content: {
    paddingHorizontal: Spacing.four,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.four,
  },
  loadingText: {
    color: NS.colors.textSecondary,
    marginTop: Spacing.three,
    fontSize: 14,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.two,
    paddingRight: Spacing.three,
  },
  backButtonText: {
    color: NS.colors.accent,
    fontSize: 16,
    fontWeight: '600',
  },
  hero: {
    gap: Spacing.two,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  badge: {
    backgroundColor: NS.colors.accentSoft,
    borderRadius: NS.radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
  },
  badgeText: {
    color: NS.colors.accent,
    fontSize: 12,
    fontWeight: '800',
  },
  versionBadge: {
    backgroundColor: NS.colors.bgCard,
    borderRadius: NS.radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: NS.colors.border,
  },
  versionBadgeText: {
    color: NS.colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    color: NS.colors.text,
    ...NS.typography.title,
  },
  heroSubtitle: {
    color: NS.colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  sectionCard: {
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.lg,
    borderWidth: 1,
    borderColor: NS.colors.border,
    padding: Spacing.four,
    gap: Spacing.three,
    ...NS.shadow.card,
  },
  field: {
    gap: Spacing.one + 2,
  },
  fieldLabel: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.borderStrong,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    color: NS.colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  inputMultiline: {
    minHeight: 88,
    paddingTop: Spacing.three,
  },
  actions: {
    gap: Spacing.three,
    paddingTop: Spacing.two,
  },
  errorTitle: {
    color: NS.colors.text,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: Spacing.two,
    textAlign: 'center',
  },
  errorText: {
    color: NS.colors.textSecondary,
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: Spacing.four,
  },
  linkButton: {
    backgroundColor: NS.colors.accentSoft,
    borderRadius: NS.radius.md,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
  },
  linkButtonText: {
    color: NS.colors.accent,
    fontSize: 15,
    fontWeight: '700',
  },
});
