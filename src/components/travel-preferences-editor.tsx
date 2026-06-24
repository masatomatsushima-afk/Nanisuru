import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { SuccessOverlay } from '@/components/success-overlay';
import { PremiumCard, PrimaryButton } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import {
  loadTravelPreferencesState,
  saveTravelPreferencesState,
} from '@/lib/travel-preferences';
import type { TravelMemoryCategory } from '@/types/travel-memory';
import {
  categoryHasSelection,
  createEmptyTravelPreferencesState,
  PREFERENCE_OTHER_CHIP,
  summarizeCategoryPreference,
  TRAVEL_PREFERENCE_CATEGORIES,
  type CategoryPreferenceState,
  type TravelPreferencesState,
} from '@/types/travel-preferences';

type TravelPreferencesEditorProps = {
  isLoggedIn: boolean;
  isConfigured: boolean;
  onRequireLogin: () => void;
};

function PreferenceChip({
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

function CategorySection({
  category,
  state,
  onChange,
}: {
  category: (typeof TRAVEL_PREFERENCE_CATEGORIES)[number];
  state: CategoryPreferenceState;
  onChange: (next: CategoryPreferenceState) => void;
}) {
  const toggleChip = (chip: string) => {
    if (chip === PREFERENCE_OTHER_CHIP) {
      onChange({ ...state, showCustom: !state.showCustom });
      return;
    }

    const selected = state.chips.includes(chip);
    onChange({
      ...state,
      chips: selected ? state.chips.filter((item) => item !== chip) : [...state.chips, chip],
    });
  };

  const allChips = [...category.chips, PREFERENCE_OTHER_CHIP];

  return (
    <View style={styles.categoryBlock}>
      <Pressable
        style={({ pressed }) => [styles.categoryHeader, pressed && styles.categoryHeaderPressed]}
        onPress={() => onChange({ ...state, expanded: !state.expanded })}>
        <Text style={styles.categoryIcon}>{category.icon}</Text>
        <View style={styles.categoryHeaderText}>
          <Text style={styles.categoryTitle}>{category.label}</Text>
          <Text style={styles.categorySummary}>{summarizeCategoryPreference(state)}</Text>
        </View>
        <Text style={styles.categoryChevron}>{state.expanded ? '▾' : '▸'}</Text>
      </Pressable>

      {state.expanded ? (
        <View style={styles.categoryBody}>
          <View style={styles.chipGrid}>
            {allChips.map((chip) => (
              <PreferenceChip
                key={chip}
                label={chip}
                selected={
                  chip === PREFERENCE_OTHER_CHIP ? state.showCustom : state.chips.includes(chip)
                }
                onPress={() => toggleChip(chip)}
              />
            ))}
          </View>

          {state.showCustom ? (
            <TextInput
              style={styles.customInput}
              value={state.custom}
              onChangeText={(custom) => onChange({ ...state, custom })}
              placeholder={category.customPlaceholder}
              placeholderTextColor={NS.colors.textMuted}
              multiline
              textAlignVertical="top"
            />
          ) : null}

          {categoryHasSelection(state) ? (
            <Pressable
              style={styles.clearButton}
              onPress={() =>
                onChange({
                  chips: [],
                  custom: '',
                  showCustom: false,
                  expanded: state.expanded,
                })
              }>
              <Text style={styles.clearButtonText}>このカテゴリをクリア</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function TravelPreferencesEditor({
  isLoggedIn,
  isConfigured,
  onRequireLogin,
}: TravelPreferencesEditorProps) {
  const [preferences, setPreferences] = useState<TravelPreferencesState>(
    createEmptyTravelPreferencesState(),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const loadPreferences = useCallback(async () => {
    if (!isLoggedIn || !isConfigured) {
      setPreferences(createEmptyTravelPreferencesState());
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      setPreferences(await loadTravelPreferencesState());
    } catch (err) {
      setError(err instanceof Error ? err.message : '好みの取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, [isConfigured, isLoggedIn]);

  useFocusEffect(
    useCallback(() => {
      void loadPreferences();
    }, [loadPreferences]),
  );

  const updateCategory = (category: TravelMemoryCategory, next: CategoryPreferenceState) => {
    setPreferences((prev) => ({ ...prev, [category]: next }));
  };

  const handleSave = async () => {
    if (!isLoggedIn) {
      onRequireLogin();
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await saveTravelPreferencesState(preferences);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 1600);
      await loadPreferences();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isConfigured) {
    return (
      <PremiumCard style={styles.card}>
        <Text style={styles.eyebrow}>PREFERENCES</Text>
        <Text style={styles.title}>好みを編集</Text>
        <Text style={styles.subtitle}>
          Supabase を設定すると、旅行の好みをクラウドに保存できます。
        </Text>
      </PremiumCard>
    );
  }

  if (!isLoggedIn) {
    return (
      <PremiumCard style={styles.card}>
        <Text style={styles.eyebrow}>PREFERENCES</Text>
        <Text style={styles.title}>好みを編集</Text>
        <Text style={styles.subtitle}>
          食の好みや旅行スタイルを登録。プラン生成時に自動で反映されます。
        </Text>
        <PrimaryButton label="ログインして編集" onPress={onRequireLogin} />
      </PremiumCard>
    );
  }

  return (
    <>
      <SuccessOverlay visible={showSuccess} message="好みを更新しました" />
      <PremiumCard style={styles.card}>
        <Text style={styles.eyebrow}>PREFERENCES</Text>
        <Text style={styles.title}>好みを編集</Text>
        <Text style={styles.subtitle}>
          チップを選ぶか「その他」から自由入力。保存した内容が次回以降のプランに反映されます。
        </Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={NS.colors.accent} />
          </View>
        ) : (
          <View style={styles.categoryList}>
            {TRAVEL_PREFERENCE_CATEGORIES.map((category) => (
              <CategorySection
                key={category.value}
                category={category}
                state={preferences[category.value]}
                onChange={(next) => updateCategory(category.value, next)}
              />
            ))}
          </View>
        )}

        <View style={styles.saveWrap}>
          <PrimaryButton
            label={isSaving ? '保存中...' : '好みを保存'}
            onPress={handleSave}
            disabled={isSaving || isLoading}
          />
        </View>
      </PremiumCard>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.four,
    marginBottom: Spacing.four,
  },
  eyebrow: {
    color: NS.colors.accent,
    ...NS.typography.eyebrow,
    marginBottom: Spacing.one,
  },
  title: {
    color: NS.colors.text,
    ...NS.typography.headline,
    marginBottom: Spacing.one,
  },
  subtitle: {
    color: NS.colors.textSecondary,
    ...NS.typography.bodySm,
    lineHeight: 22,
    marginBottom: Spacing.three,
  },
  loadingWrap: {
    paddingVertical: Spacing.five,
    alignItems: 'center',
  },
  errorText: {
    color: NS.colors.danger,
    fontSize: 13,
    marginBottom: Spacing.two,
  },
  categoryList: {
    gap: Spacing.two,
  },
  categoryBlock: {
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.lg,
    borderWidth: 1,
    borderColor: NS.colors.border,
    overflow: 'hidden',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  categoryHeaderPressed: {
    opacity: 0.9,
  },
  categoryIcon: {
    fontSize: 20,
  },
  categoryHeaderText: {
    flex: 1,
    gap: 2,
  },
  categoryTitle: {
    color: NS.colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  categorySummary: {
    color: NS.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  categoryChevron: {
    color: NS.colors.accent,
    fontSize: 16,
    fontWeight: '700',
  },
  categoryBody: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    gap: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: NS.colors.border,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingTop: Spacing.three,
  },
  chip: {
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.pill,
    borderWidth: 1,
    borderColor: NS.colors.borderStrong,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
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
    fontWeight: '600',
  },
  chipLabelSelected: {
    color: NS.colors.accent,
    fontWeight: '700',
  },
  customInput: {
    minHeight: 88,
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.borderStrong,
    padding: Spacing.three,
    color: NS.colors.text,
    fontSize: 14,
    lineHeight: 22,
  },
  clearButton: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
  },
  clearButtonText: {
    color: NS.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  saveWrap: {
    marginTop: Spacing.four,
  },
});
