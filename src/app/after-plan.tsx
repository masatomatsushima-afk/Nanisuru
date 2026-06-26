import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AfterPlanOptionCard } from '@/components/after-plan-option-card';
import { AppErrorBanner } from '@/components/app-error-banner';
import { ScreenBackground } from '@/components/ui/screen-background';
import { PrimaryButton } from '@/components/ui/premium-card';
import { getBudgetPlaceholder, type CurrencyCode } from '@/constants/currency';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { generateAfterPlanOptions, isOpenAiConfigured } from '@/lib/after-plan-ai';
import { publishAfterPlan, saveAfterPlan } from '@/lib/after-plans';
import { getCurrentCityLabel } from '@/lib/current-location';
import { APP_MESSAGES, getErrorMessage } from '@/lib/app-errors';
import { buildLocationCurrencyHint, inferCurrencyFromLocation } from '@/lib/location-currency';
import {
  AFTER_PLAN_ALCOHOL_OPTIONS,
  AFTER_PLAN_COMPANION_TYPES,
  AFTER_PLAN_MOODS,
  AFTER_PLAN_QUICK_CHIPS,
  AFTER_PLAN_SMOKING_OPTIONS,
  AFTER_PLAN_VIBE_OPTIONS,
  AFTER_PLAN_WALK_DISTANCES,
  type AfterPlanCompanionType,
  type AfterPlanInput,
  type AfterPlanMood,
  type AfterPlanOption,
  type AfterPlanResult,
} from '@/types/after-plan';

type Step = 'form' | 'loading' | 'result';

function formatNowTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function Chip({
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
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.chipPressed]}
      onPress={onPress}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export default function AfterPlanScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ location?: string; baseTripId?: string }>();

  const [step, setStep] = useState<Step>('form');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AfterPlanResult | null>(null);
  const [selectedOption, setSelectedOption] = useState<AfterPlanOption | null>(null);
  const [savedRecordId, setSavedRecordId] = useState<string | null>(null);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publicTitle, setPublicTitle] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);

  const [currentLocation, setCurrentLocation] = useState(params.location?.trim() ?? '');
  const [currentTime, setCurrentTime] = useState(formatNowTime());
  const [peopleCount, setPeopleCount] = useState('2');
  const [companionType, setCompanionType] = useState<AfterPlanCompanionType>('友達');
  const [mood, setMood] = useState<AfterPlanMood>('AIに任せる');
  const [budget, setBudget] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('JPY');
  const [lastTrainTime, setLastTrainTime] = useState('');
  const [destinationDirection, setDestinationDirection] = useState('');
  const [walkDistance, setWalkDistance] = useState<(typeof AFTER_PLAN_WALK_DISTANCES)[number]>('10分以内');
  const [alcohol, setAlcohol] = useState<(typeof AFTER_PLAN_ALCOHOL_OPTIONS)[number]>('お酒あり');
  const [smoking, setSmoking] = useState<(typeof AFTER_PLAN_SMOKING_OPTIONS)[number]>('どちらでも');
  const [vibe, setVibe] = useState<(typeof AFTER_PLAN_VIBE_OPTIONS)[number]>('どちらでも');
  const [quickNote, setQuickNote] = useState('');

  const currencyHint = useMemo(
    () => buildLocationCurrencyHint(currentLocation),
    [currentLocation],
  );

  const buildInput = (): AfterPlanInput => ({
    currentLocation: currentLocation.trim(),
    currentTime: currentTime.trim(),
    peopleCount: peopleCount.trim() || '1',
    companionType,
    mood,
    budget: budget.trim() || '3000',
    currency,
    lastTrainTime: lastTrainTime.trim() || undefined,
    destinationDirection: destinationDirection.trim() || undefined,
    walkDistance,
    alcohol,
    smoking,
    vibe,
    quickNote: quickNote.trim() || undefined,
    baseTripId: params.baseTripId,
  });

  const handleUseCurrentLocation = async () => {
    try {
      const result = await getCurrentCityLabel();
      if (result?.label) {
        setCurrentLocation(result.label);
        setCurrency(inferCurrencyFromLocation(result.label));
      }
    } catch {
      setError('現在地の取得に失敗しました');
    }
  };

  const handleQuickChip = (chip: string) => {
    setQuickNote((prev) => (prev ? `${prev}、${chip}` : chip));
    if (chip.includes('静か')) setVibe('静か');
    if (chip.includes('タクシー')) setWalkDistance('タクシーでもOK');
    if (chip.includes('終電')) setMood('もう帰りたいけど少し寄りたい');
    if (chip.includes('ラーメン')) setMood('締めが食べたい');
    if (chip.includes('カラオケ')) setMood('カラオケ行きたい');
    if (chip.includes('夜景')) setMood('夜景を見たい');
    if (chip.includes('2軒目')) setMood('まだ飲みたい');
    if (chip.includes('安く')) setBudget('2000');
  };

  const handleGenerate = async () => {
    if (!currentLocation.trim()) {
      setError('今いる場所を入力してください');
      return;
    }
    if (!isOpenAiConfigured()) {
      setError(APP_MESSAGES.openAiNotConfigured);
      return;
    }

    setError(null);
    setStep('loading');

    try {
      const generated = await generateAfterPlanOptions(buildInput());
      setResult(generated);
      setSelectedOption(generated.options[0] ?? null);
      setStep('result');
    } catch (err) {
      setError(getErrorMessage(err));
      setStep('form');
    }
  };

  const handleSaveSelection = async (option: AfterPlanOption) => {
    setSelectedOption(option);
    const input = buildInput();
    const record = await saveAfterPlan({
      baseTripId: params.baseTripId,
      currentLocation: input.currentLocation,
      mood: input.mood,
      peopleCount: input.peopleCount,
      companionType: input.companionType,
      budget: `${input.budget} ${input.currency}`,
      selectedOption: option,
      inputPayload: input,
    });
    if (record) setSavedRecordId(record.id);
  };

  const handlePublish = async () => {
    if (!savedRecordId || !publicTitle.trim()) return;
    setIsPublishing(true);
    try {
      await publishAfterPlan(savedRecordId, publicTitle.trim());
      setShowPublishModal(false);
    } finally {
      setIsPublishing(false);
    }
  };

  if (step === 'loading') {
    return (
      <ScreenBackground>
        <View style={[styles.loadingWrap, { paddingTop: insets.top + 80 }]}>
          <Text style={styles.loadingEmoji}>🌙</Text>
          <Text style={styles.loadingTitle}>2軒目・夜プランを考え中...</Text>
          <ActivityIndicator size="large" color={NS.colors.accent} style={{ marginTop: Spacing.four }} />
          <Text style={styles.loadingHint}>近くのバー・カフェ・カラオケを調べています</Text>
        </View>
      </ScreenBackground>
    );
  }

  if (step === 'result' && result) {
    return (
      <ScreenBackground>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + Spacing.three, paddingBottom: insets.bottom + Spacing.six },
          ]}>
          <Pressable onPress={() => setStep('form')}>
            <Text style={styles.backLink}>← 条件を変える</Text>
          </Pressable>

          <Text style={styles.heroEmoji}>🍻</Text>
          <Text style={styles.heroTitle}>このあとどうする？</Text>
          <Text style={styles.heroSubtitle}>{currentLocation} · {currentTime} · {companionType}</Text>

          <View style={styles.safetyBanner}>
            <Text style={styles.safetyBannerText}>{result.safetyReminder}</Text>
          </View>

          <View style={styles.optionsList}>
            {result.options.map((option) => (
              <AfterPlanOptionCard
                key={option.id}
                option={option}
                location={currentLocation}
                selected={selectedOption?.id === option.id}
                onSelect={() => void handleSaveSelection(option)}
              />
            ))}
          </View>

          {selectedOption ? (
            <View style={styles.selectedActions}>
              <PrimaryButton
                label="この流れを公開する"
                onPress={() => {
                  setPublicTitle(`${currentLocation}${selectedOption.category}プラン`);
                  setShowPublishModal(true);
                }}
                variant="secondary"
              />
            </View>
          ) : null}
        </ScrollView>

        <Modal visible={showPublishModal} transparent animationType="fade">
          <View style={styles.modalBackdrop}>
            <View style={styles.modalSheet}>
              <Text style={styles.modalTitle}>この流れを公開する</Text>
              <Text style={styles.modalHint}>例：梅田飲み会後の2軒目プラン</Text>
              <TextInput
                style={styles.input}
                value={publicTitle}
                onChangeText={setPublicTitle}
                placeholder="公開タイトル"
                placeholderTextColor={NS.colors.textMuted}
              />
              <PrimaryButton
                label={isPublishing ? '公開中...' : '公開する'}
                onPress={() => void handlePublish()}
                disabled={isPublishing || !publicTitle.trim()}
              />
              <Pressable onPress={() => setShowPublishModal(false)}>
                <Text style={styles.modalCancel}>キャンセル</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + Spacing.three, paddingBottom: insets.bottom + Spacing.six },
          ]}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.backLink}>← 戻る</Text>
          </Pressable>

          <Text style={styles.heroEmoji}>🌙</Text>
          <Text style={styles.heroTitle}>このあとどうする？</Text>
          <Text style={styles.heroSubtitle}>
            1軒目のあと、2軒目・締め・夜景まで。今夜の次の一手をAIが提案
          </Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickScroll}>
            {AFTER_PLAN_QUICK_CHIPS.map((chip) => (
              <Pressable
                key={chip}
                style={({ pressed }) => [styles.quickChip, pressed && styles.chipPressed]}
                onPress={() => handleQuickChip(chip)}>
                <Text style={styles.quickChipText}>{chip}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {error ? <AppErrorBanner message={error} variant="error" onRetry={() => setError(null)} /> : null}

          <View style={styles.field}>
            <Text style={styles.label}>今いる場所</Text>
            <TextInput
              style={styles.input}
              value={currentLocation}
              onChangeText={(text) => {
                setCurrentLocation(text);
                setCurrency(inferCurrencyFromLocation(text));
              }}
              placeholder="例：大阪・梅田、新宿西口"
              placeholderTextColor={NS.colors.textMuted}
            />
            <Pressable onPress={() => void handleUseCurrentLocation()}>
              <Text style={styles.linkAction}>📍 現在地を使う</Text>
            </Pressable>
          </View>

          <View style={styles.row}>
            <View style={[styles.field, styles.halfField]}>
              <Text style={styles.label}>現在時刻</Text>
              <TextInput
                style={styles.input}
                value={currentTime}
                onChangeText={setCurrentTime}
                placeholder="21:30"
                placeholderTextColor={NS.colors.textMuted}
              />
            </View>
            <View style={[styles.field, styles.halfField]}>
              <Text style={styles.label}>人数</Text>
              <TextInput
                style={styles.input}
                value={peopleCount}
                onChangeText={setPeopleCount}
                keyboardType="number-pad"
                placeholder="2"
                placeholderTextColor={NS.colors.textMuted}
              />
            </View>
          </View>

          <Text style={styles.label}>誰といる？</Text>
          <View style={styles.chipRow}>
            {AFTER_PLAN_COMPANION_TYPES.map((option) => (
              <Chip
                key={option}
                label={option}
                selected={companionType === option}
                onPress={() => setCompanionType(option)}
              />
            ))}
          </View>

          <Text style={styles.label}>今の気分</Text>
          <View style={styles.chipRow}>
            {AFTER_PLAN_MOODS.map((option) => (
              <Chip
                key={option}
                label={option}
                selected={mood === option}
                onPress={() => setMood(option)}
              />
            ))}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>予算（1人あたり目安）</Text>
            <TextInput
              style={styles.input}
              value={budget}
              onChangeText={setBudget}
              keyboardType="number-pad"
              placeholder={getBudgetPlaceholder(currency)}
              placeholderTextColor={NS.colors.textMuted}
            />
            {currencyHint ? <Text style={styles.hint}>{currencyHint}</Text> : null}
          </View>

          <Text style={styles.label}>歩ける距離</Text>
          <View style={styles.chipRow}>
            {AFTER_PLAN_WALK_DISTANCES.map((option) => (
              <Chip
                key={option}
                label={option}
                selected={walkDistance === option}
                onPress={() => setWalkDistance(option)}
              />
            ))}
          </View>

          <Text style={styles.label}>お酒</Text>
          <View style={styles.chipRow}>
            {AFTER_PLAN_ALCOHOL_OPTIONS.map((option) => (
              <Chip
                key={option}
                label={option}
                selected={alcohol === option}
                onPress={() => setAlcohol(option)}
              />
            ))}
          </View>

          <Text style={styles.label}>雰囲気</Text>
          <View style={styles.chipRow}>
            {AFTER_PLAN_VIBE_OPTIONS.map((option) => (
              <Chip
                key={option}
                label={option}
                selected={vibe === option}
                onPress={() => setVibe(option)}
              />
            ))}
          </View>

          <View style={styles.row}>
            <View style={[styles.field, styles.halfField]}>
              <Text style={styles.label}>終電（任意）</Text>
              <TextInput
                style={styles.input}
                value={lastTrainTime}
                onChangeText={setLastTrainTime}
                placeholder="00:15"
                placeholderTextColor={NS.colors.textMuted}
              />
            </View>
            <View style={[styles.field, styles.halfField]}>
              <Text style={styles.label}>帰り方向（任意）</Text>
              <TextInput
                style={styles.input}
                value={destinationDirection}
                onChangeText={setDestinationDirection}
                placeholder="梅田駅方面"
                placeholderTextColor={NS.colors.textMuted}
              />
            </View>
          </View>

          <Text style={styles.label}>タバコ（任意）</Text>
          <View style={styles.chipRow}>
            {AFTER_PLAN_SMOKING_OPTIONS.map((option) => (
              <Chip
                key={option}
                label={option}
                selected={smoking === option}
                onPress={() => setSmoking(option)}
              />
            ))}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>追加メモ（任意）</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={quickNote}
              onChangeText={setQuickNote}
              placeholder="例：静かに話したい、締めのラーメンがいい"
              placeholderTextColor={NS.colors.textMuted}
              multiline
            />
          </View>

          <PrimaryButton label="🌙 次のプランを提案して" onPress={() => void handleGenerate()} />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
    maxWidth: 480,
    alignSelf: 'center',
    width: '100%',
  },
  backLink: {
    color: NS.colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  heroEmoji: {
    fontSize: 40,
    textAlign: 'center',
    marginTop: Spacing.two,
  },
  heroTitle: {
    color: NS.colors.text,
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    color: NS.colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: Spacing.two,
  },
  quickScroll: {
    marginHorizontal: -Spacing.one,
  },
  quickChip: {
    marginHorizontal: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 999,
    backgroundColor: NS.colors.purpleSoft,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.35)',
  },
  quickChipText: {
    color: NS.colors.purple,
    fontSize: 13,
    fontWeight: '700',
  },
  field: {
    gap: Spacing.one,
  },
  halfField: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  label: {
    color: NS.colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  input: {
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.sm,
    borderWidth: 1,
    borderColor: NS.colors.border,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    color: NS.colors.text,
    fontSize: 15,
  },
  textArea: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  hint: {
    color: NS.colors.textMuted,
    fontSize: 12,
  },
  linkAction: {
    color: NS.colors.accent,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 999,
    backgroundColor: NS.colors.bgCard,
    borderWidth: 1,
    borderColor: NS.colors.border,
  },
  chipSelected: {
    backgroundColor: NS.colors.accentSoft,
    borderColor: NS.colors.accentBorder,
  },
  chipPressed: {
    opacity: 0.85,
  },
  chipText: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: NS.colors.accent,
    fontWeight: '800',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.five,
  },
  loadingEmoji: {
    fontSize: 48,
  },
  loadingTitle: {
    color: NS.colors.text,
    fontSize: 20,
    fontWeight: '800',
    marginTop: Spacing.three,
    textAlign: 'center',
  },
  loadingHint: {
    color: NS.colors.textMuted,
    fontSize: 14,
    marginTop: Spacing.two,
    textAlign: 'center',
  },
  safetyBanner: {
    backgroundColor: NS.colors.yellowSoft,
    borderRadius: NS.radius.md,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.35)',
  },
  safetyBannerText: {
    color: '#B45309',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
  },
  optionsList: {
    gap: Spacing.four,
  },
  selectedActions: {
    marginTop: Spacing.two,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  modalSheet: {
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.lg,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  modalTitle: {
    color: NS.colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  modalHint: {
    color: NS.colors.textMuted,
    fontSize: 13,
  },
  modalCancel: {
    color: NS.colors.textSecondary,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
  },
});
