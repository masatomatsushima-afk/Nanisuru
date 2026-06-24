import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { InspiredByCredit } from '@/components/inspired-by-credit';
import { PlanCopyAiAdjustBar } from '@/components/plan-copy-ai-adjust-bar';
import { PlanCustomPreferencesFields } from '@/components/plan-custom-preferences-fields';
import { PlanTimelineEditor } from '@/components/plan-timeline-editor';
import { PublishPlanSheet } from '@/components/publish-plan-sheet';
import { SuccessOverlay } from '@/components/success-overlay';
import { PrimaryButton, SectionHeader } from '@/components/ui/premium-card';
import { CURRENCY_OPTIONS, getBudgetPlaceholder, getCurrency, type CurrencyCode } from '@/constants/currency';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { classifyError } from '@/lib/app-errors';
import {
  adjustCopiedPlanWithAi,
  buildPayloadFromTrip,
  buildUpdatedTripTitle,
} from '@/lib/plan-copy';
import { getTripById, updateTrip } from '@/lib/saved-trips';
import { flattenItineraryDays } from '@/lib/trip-duration';
import { formatTripDateLabel, getTodayIsoDate, formatIsoDate } from '@/lib/weather';
import {
  COMPANION_OPTIONS,
  PERSONALITY_OPTIONS,
  TRIP_DURATION_OPTIONS,
  type CompanionOption,
  type PersonalityOption,
  type TripDurationOption,
} from '@/types/plan';
import { HOME_MOOD_OPTIONS } from '@/types/plan-preferences';
import type { PlanCustomPreferences } from '@/types/plan-preferences';
import type { SavedTrip, SavedTripPayload } from '@/types/trip';

function OptionChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.chipPressed,
      ]}
      onPress={onPress}>
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'numeric' | 'number-pad';
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
        keyboardType={keyboardType}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
  );
}

export default function PlanCopyEditScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, isLoading: authLoading } = useAuth();

  const [trip, setTrip] = useState<SavedTrip | null>(null);
  const [payload, setPayload] = useState<SavedTripPayload | null>(null);
  const [customPreferences, setCustomPreferences] = useState<PlanCustomPreferences>({});
  const [notes, setNotes] = useState('');
  const [mood, setMood] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [showPublishSheet, setShowPublishSheet] = useState(false);
  const [showSuccess, setShowSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadTrip = useCallback(async () => {
    if (!id || !session) return;

    setIsLoading(true);
    setError(null);
    try {
      const loaded = await getTripById(id);
      if (!loaded) {
        setError('プランが見つかりませんでした');
        setTrip(null);
        setPayload(null);
        return;
      }

      const normalized = buildPayloadFromTrip(loaded);
      setTrip(loaded);
      setPayload(normalized);
      setCustomPreferences(normalized.customPreferences ?? {});
      setNotes(normalized.notes ?? '');
      setMood(normalized.mood ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'プランの読み込みに失敗しました');
      setTrip(null);
      setPayload(null);
    } finally {
      setIsLoading(false);
    }
  }, [id, session]);

  useEffect(() => {
    if (authLoading || !session) return;
    void loadTrip();
  }, [authLoading, session, loadTrip]);

  const patchPayload = (patch: Partial<SavedTripPayload>) => {
    setPayload((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const patchDetails = (patch: Partial<SavedTripPayload['details']>) => {
    setPayload((prev) =>
      prev
        ? {
            ...prev,
            details: { ...prev.details, ...patch },
          }
        : prev,
    );
  };

  const handleSave = async (): Promise<boolean> => {
    if (!trip || !payload) return false;

    setIsSaving(true);
    setError(null);
    try {
      const nextPayload: SavedTripPayload = {
        ...payload,
        mood,
        customPreferences,
        notes: notes.trim(),
        items: flattenItineraryDays(payload.days),
      };
      const updated = await updateTrip(trip.id, nextPayload, buildUpdatedTripTitle(nextPayload));
      setTrip(updated);
      setPayload(buildPayloadFromTrip(updated));
      setShowSuccess('マイプランとして保存しました');
      setTimeout(() => setShowSuccess(null), 1800);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleAdjust = async (instruction: string) => {
    if (!payload) return;

    setIsAdjusting(true);
    setError(null);
    try {
      const basePayload: SavedTripPayload = {
        ...payload,
        mood,
        customPreferences,
        notes: notes.trim(),
      };
      const adjusted = await adjustCopiedPlanWithAi(basePayload, instruction);
      setPayload(adjusted);
      setShowSuccess('AIがプランを調整しました');
      setTimeout(() => setShowSuccess(null), 1600);
    } catch (err) {
      const appError = classifyError(err);
      setError(appError.message);
    } finally {
      setIsAdjusting(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <RequireAuthGate
        title="プラン編集にはログインが必要です"
        description="コピーしたプランを編集・保存するには、ログインしてください。"
        loadingMessage="確認中...">
        <View style={[styles.centered, { paddingTop: insets.top }]}>
          <ActivityIndicator size="large" color={NS.colors.accent} />
          <Text style={styles.loadingText}>プランを読み込み中...</Text>
        </View>
      </RequireAuthGate>
    );
  }

  if (error && !payload) {
    return (
      <RequireAuthGate
        title="プラン編集にはログインが必要です"
        description="コピーしたプランを編集・保存するには、ログインしてください。"
        loadingMessage="確認中...">
        <View style={[styles.centered, styles.container, { paddingTop: insets.top + Spacing.four }]}>
          <Text style={styles.errorTitle}>プランを開けません</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.linkButton} onPress={() => router.back()}>
            <Text style={styles.linkButtonText}>戻る</Text>
          </Pressable>
        </View>
      </RequireAuthGate>
    );
  }

  if (!trip || !payload) return null;

  const tripDate = payload.details.tripDate ?? getTodayIsoDate();
  const currencySymbol = getCurrency(payload.currency).symbol;

  return (
    <RequireAuthGate
      title="プラン編集にはログインが必要です"
      description="コピーしたプランを編集・保存するには、ログインしてください。"
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
          <View style={styles.badge}>
            <Text style={styles.badgeText}>カスタム編集</Text>
          </View>
          <Text style={styles.title}>{trip.title}</Text>
          <Text style={styles.heroSubtitle}>公開プランをベースに、あなた好みに調整できます</Text>
        </View>

        {payload.copyMetadata ? (
          <View style={styles.creditWrap}>
            <InspiredByCredit
              metadata={payload.copyMetadata}
              onPressCreator={() =>
                router.push(`/creator/${payload.copyMetadata!.sourceCreatorUserId}`)
              }
            />
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <SectionHeader title="基本条件" subtitle="目的地・日程・予算を編集" />
          <FormField
            label="行き先・エリア"
            value={payload.location}
            onChangeText={(text) => patchPayload({ location: text })}
            placeholder="例）東京・渋谷、Melbourne CBD"
          />

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>出発日</Text>
            {Platform.OS === 'web' ? (
              <TextInput
                style={styles.input}
                value={tripDate}
                onChangeText={(text) => {
                  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
                    patchDetails({ tripDate: text });
                  }
                }}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={NS.colors.textMuted}
              />
            ) : (
              <>
                <Pressable style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
                  <Text style={styles.dateButtonText}>{formatTripDateLabel(tripDate)}</Text>
                  <Text style={styles.dateButtonHint}>タップして変更</Text>
                </Pressable>
                {showDatePicker ? (
                  <DateTimePicker
                    value={new Date(`${tripDate}T12:00:00`)}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    minimumDate={new Date()}
                    locale="ja-JP"
                    onChange={(event, selectedDate) => {
                      if (Platform.OS === 'android') setShowDatePicker(false);
                      if (event.type === 'dismissed') {
                        setShowDatePicker(false);
                        return;
                      }
                      if (selectedDate) {
                        patchDetails({ tripDate: formatIsoDate(selectedDate) });
                      }
                    }}
                  />
                ) : null}
                {Platform.OS === 'ios' && showDatePicker ? (
                  <Pressable style={styles.dateDone} onPress={() => setShowDatePicker(false)}>
                    <Text style={styles.dateDoneText}>完了</Text>
                  </Pressable>
                ) : null}
              </>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>期間</Text>
            <View style={styles.chipGrid}>
              {TRIP_DURATION_OPTIONS.map((option) => (
                <OptionChip
                  key={option}
                  label={option}
                  selected={payload.tripDuration === option}
                  onPress={() => patchPayload({ tripDuration: option })}
                />
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>通貨</Text>
            <View style={styles.currencyRow}>
              {CURRENCY_OPTIONS.map((option) => (
                <OptionChip
                  key={option.code}
                  label={option.code}
                  selected={payload.currency === option.code}
                  onPress={() => patchPayload({ currency: option.code as CurrencyCode })}
                />
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>予算（{payload.currency}）</Text>
            <View style={styles.budgetRow}>
              <Text style={styles.budgetPrefix}>{currencySymbol}</Text>
              <TextInput
                style={styles.budgetInput}
                value={payload.budget}
                onChangeText={(text) => patchPayload({ budget: text })}
                placeholder={getBudgetPlaceholder(payload.currency)}
                placeholderTextColor={NS.colors.textMuted}
                keyboardType="numeric"
              />
            </View>
          </View>

          <FormField
            label="人数"
            value={payload.people}
            onChangeText={(text) => patchPayload({ people: text })}
            placeholder="例）2"
            keyboardType="number-pad"
          />

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>合計予算（概算）</Text>
            <TextInput
              style={styles.input}
              value={payload.details.totalBudget ?? ''}
              onChangeText={(text) => patchDetails({ totalBudget: text })}
              placeholder="例）¥12,000"
              placeholderTextColor={NS.colors.textMuted}
            />
          </View>
        </View>

        <View style={styles.sectionCard}>
          <SectionHeader title="同行者・気分" subtitle="旅のスタイルに合わせて調整" />
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>誰と行く？</Text>
            <View style={styles.chipGrid}>
              {COMPANION_OPTIONS.map((option) => (
                <OptionChip
                  key={option}
                  label={option}
                  selected={payload.companion === option}
                  onPress={() => patchPayload({ companion: option as CompanionOption })}
                />
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>旅行タイプ</Text>
            <View style={styles.chipGrid}>
              {PERSONALITY_OPTIONS.map((option) => (
                <OptionChip
                  key={option}
                  label={option}
                  selected={payload.personality === option}
                  onPress={() => patchPayload({ personality: option as PersonalityOption })}
                />
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>気分</Text>
            <View style={styles.chipGrid}>
              {HOME_MOOD_OPTIONS.map((option) => (
                <OptionChip
                  key={option}
                  label={option}
                  selected={mood === option}
                  onPress={() => setMood(option)}
                />
              ))}
            </View>
          </View>

          <PlanCustomPreferencesFields
            value={customPreferences}
            onChange={setCustomPreferences}
          />
        </View>

        <View style={styles.sectionCard}>
          <SectionHeader title="メモ" subtitle="AI調整や保存時に参考にされます" />
          <FormField
            label="自由メモ"
            value={notes}
            onChangeText={setNotes}
            placeholder="例：記念日なのでサプライズ要素を入れたい"
            multiline
          />
        </View>

        <PlanCopyAiAdjustBar onAdjust={handleAdjust} isAdjusting={isAdjusting} />

        <View style={styles.sectionCard}>
          <SectionHeader title="行程タイムライン" subtitle="スポット名・時間・費用を直接編集" />
          <PlanTimelineEditor
            days={payload.days}
            onChange={(days) =>
              patchPayload({
                days,
                items: flattenItineraryDays(days),
              })
            }
          />
        </View>

        {error ? <AppErrorBanner message={error} /> : null}

        <View style={styles.actions}>
          <PrimaryButton
            label={isSaving ? '保存中...' : 'マイプランとして保存'}
            onPress={() => void handleSave()}
            disabled={isSaving || isAdjusting}
          />
          <PrimaryButton
            label="自分のプランとして公開する"
            variant="secondary"
            onPress={() => {
              void handleSave().then((saved) => {
                if (saved) setShowPublishSheet(true);
              });
            }}
            disabled={isSaving || isAdjusting}
          />
          <Pressable
            style={({ pressed }) => [styles.viewSavedLink, pressed && styles.viewSavedLinkPressed]}
            onPress={() => router.push(`/saved-trip/${trip.id}`)}>
            <Text style={styles.viewSavedLinkText}>保存済みプランで詳細を見る</Text>
          </Pressable>
        </View>
      </ScrollView>

      <PublishPlanSheet
        visible={showPublishSheet}
        trip={trip}
        onClose={() => setShowPublishSheet(false)}
        onPublished={() => {
          setShowPublishSheet(false);
          setShowSuccess('プランを公開しました');
          setTimeout(() => setShowSuccess(null), 1800);
        }}
      />
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
  badge: {
    alignSelf: 'flex-start',
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
  title: {
    color: NS.colors.text,
    ...NS.typography.title,
  },
  heroSubtitle: {
    color: NS.colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  creditWrap: {
    marginTop: -Spacing.one,
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
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    backgroundColor: NS.colors.bgCard,
    borderRadius: NS.radius.pill,
    borderWidth: 1,
    borderColor: NS.colors.borderStrong,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  chipSelected: {
    backgroundColor: NS.colors.accentSoft,
    borderColor: NS.colors.accentBorder,
  },
  chipPressed: {
    opacity: 0.88,
  },
  chipLabel: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  chipLabelSelected: {
    color: NS.colors.accent,
  },
  currencyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  budgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.borderStrong,
    paddingHorizontal: Spacing.three,
  },
  budgetPrefix: {
    color: NS.colors.textMuted,
    fontSize: 16,
    fontWeight: '700',
    marginRight: Spacing.two,
  },
  budgetInput: {
    flex: 1,
    color: NS.colors.text,
    fontSize: 16,
    paddingVertical: Spacing.two + 2,
  },
  dateButton: {
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.borderStrong,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateButtonText: {
    color: NS.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  dateButtonHint: {
    color: NS.colors.textMuted,
    fontSize: 12,
  },
  dateDone: {
    alignSelf: 'flex-end',
    paddingVertical: Spacing.two,
  },
  dateDoneText: {
    color: NS.colors.accent,
    fontSize: 15,
    fontWeight: '700',
  },
  actions: {
    gap: Spacing.three,
    paddingTop: Spacing.two,
  },
  viewSavedLink: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  viewSavedLinkPressed: {
    opacity: 0.88,
  },
  viewSavedLinkText: {
    color: NS.colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
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
