import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import {
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

import { PrimaryButton } from '@/components/ui/premium-card';
import { ScreenBackground } from '@/components/ui/screen-background';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import { setPreferenceOnboardingCompleted } from '@/lib/preference-onboarding-storage';
import { saveTravelUserPreferences, getTravelUserPreferences } from '@/lib/travel-user-preferences';
import {
  AVOID_THING_OPTIONS,
  BUDGET_STYLE_OPTIONS,
  COMPANION_TYPE_OPTIONS,
  FAVORITE_CATEGORY_OPTIONS,
  TRAVEL_PACE_OPTIONS,
  WALKING_TOLERANCE_OPTIONS,
} from '@/types/travel-user-preferences';

const TOTAL_STEPS = 6;

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
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function toggleMulti(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export default function PreferenceOnboardingScreen() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [favoriteCategories, setFavoriteCategories] = useState<string[]>([]);
  const [travelPace, setTravelPace] = useState<string | null>(null);
  const [walkingTolerance, setWalkingTolerance] = useState<string | null>(null);
  const [budgetStyle, setBudgetStyle] = useState<string | null>(null);
  const [avoidThings, setAvoidThings] = useState<string[]>([]);
  const [companionTypes, setCompanionTypes] = useState<string[]>([]);
  const [freeTextPreference, setFreeTextPreference] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void getTravelUserPreferences().then((prefs) => {
      setFavoriteCategories(prefs.favoriteCategories);
      setTravelPace(prefs.travelPace);
      setWalkingTolerance(prefs.walkingTolerance);
      setBudgetStyle(prefs.budgetStyle);
      setAvoidThings(prefs.avoidThings);
      setCompanionTypes(prefs.companionTypes);
      setFreeTextPreference(prefs.freeTextPreference);
    });
  }, []);

  const handleNext = async () => {
    if (step < TOTAL_STEPS - 1) {
      setStep((prev) => prev + 1);
      return;
    }

    setIsSaving(true);
    try {
      await saveTravelUserPreferences({
        favoriteCategories,
        travelPace,
        walkingTolerance,
        budgetStyle,
        avoidThings,
        companionTypes,
        freeTextPreference,
      });
      await setPreferenceOnboardingCompleted(true);
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkip = async () => {
    await setPreferenceOnboardingCompleted(true);
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const canProceed = () => {
    switch (step) {
      case 0:
        return favoriteCategories.length > 0;
      case 1:
        return travelPace !== null;
      case 2:
        return walkingTolerance !== null;
      case 3:
        return budgetStyle !== null;
      case 4:
        return true;
      case 5:
        return companionTypes.length > 0;
      default:
        return false;
    }
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <>
            <Text style={styles.question}>どんなおでかけが好き？</Text>
            <Text style={styles.hint}>複数選択できます</Text>
            <View style={styles.chipGrid}>
              {FAVORITE_CATEGORY_OPTIONS.map((option) => (
                <OptionChip
                  key={option}
                  label={option}
                  selected={favoriteCategories.includes(option)}
                  onPress={() => setFavoriteCategories((prev) => toggleMulti(prev, option))}
                />
              ))}
            </View>
          </>
        );
      case 1:
        return (
          <>
            <Text style={styles.question}>旅行のペースは？</Text>
            <View style={styles.chipGrid}>
              {TRAVEL_PACE_OPTIONS.map((option) => (
                <OptionChip
                  key={option}
                  label={option}
                  selected={travelPace === option}
                  onPress={() => setTravelPace(option)}
                />
              ))}
            </View>
          </>
        );
      case 2:
        return (
          <>
            <Text style={styles.question}>移動はどれくらいOK？</Text>
            <View style={styles.chipGrid}>
              {WALKING_TOLERANCE_OPTIONS.map((option) => (
                <OptionChip
                  key={option}
                  label={option}
                  selected={walkingTolerance === option}
                  onPress={() => setWalkingTolerance(option)}
                />
              ))}
            </View>
          </>
        );
      case 3:
        return (
          <>
            <Text style={styles.question}>予算感は？</Text>
            <View style={styles.chipGrid}>
              {BUDGET_STYLE_OPTIONS.map((option) => (
                <OptionChip
                  key={option}
                  label={option}
                  selected={budgetStyle === option}
                  onPress={() => setBudgetStyle(option)}
                />
              ))}
            </View>
          </>
        );
      case 4:
        return (
          <>
            <Text style={styles.question}>苦手なもの・避けたいもの</Text>
            <Text style={styles.hint}>複数選択できます</Text>
            <View style={styles.chipGrid}>
              {AVOID_THING_OPTIONS.map((option) => (
                <OptionChip
                  key={option}
                  label={option}
                  selected={avoidThings.includes(option)}
                  onPress={() => setAvoidThings((prev) => toggleMulti(prev, option))}
                />
              ))}
            </View>
            <Text style={styles.fieldLabel}>その他の苦手なもの</Text>
            <TextInput
              style={styles.input}
              value={freeTextPreference}
              onChangeText={setFreeTextPreference}
              placeholder="例）騒がしい店、強い匂い"
              placeholderTextColor={NS.colors.textMuted}
              multiline
            />
          </>
        );
      case 5:
        return (
          <>
            <Text style={styles.question}>よく一緒に行く相手</Text>
            <Text style={styles.hint}>複数選択できます</Text>
            <View style={styles.chipGrid}>
              {COMPANION_TYPE_OPTIONS.map((option) => (
                <OptionChip
                  key={option}
                  label={option}
                  selected={companionTypes.includes(option)}
                  onPress={() => setCompanionTypes((prev) => toggleMulti(prev, option))}
                />
              ))}
            </View>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <ScreenBackground>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: insets.top + Spacing.four,
              paddingBottom: insets.bottom + Spacing.five,
            },
          ]}
          keyboardShouldPersistTaps="handled">
          <View style={styles.progressRow}>
            {Array.from({ length: TOTAL_STEPS }, (_, index) => (
              <View
                key={index}
                style={[styles.progressDot, index <= step && styles.progressDotActive]}
              />
            ))}
          </View>

          <Text style={styles.title}>あなたの好みを教えてください</Text>
          <Text style={styles.subtitle}>
            Nanisuruがあなたに合う旅行やおでかけを提案します
          </Text>

          <View style={styles.card}>{renderStep()}</View>

          <PrimaryButton
            label={
              isSaving
                ? '保存中...'
                : step === TOTAL_STEPS - 1
                  ? '好みを保存する'
                  : '次へ'
            }
            onPress={() => void handleNext()}
            disabled={!canProceed() || isSaving}
            variant="warm"
          />

          {step === 0 ? (
            <Pressable style={styles.skipBtn} onPress={() => void handleSkip()}>
              <Text style={styles.skipText}>あとで設定する</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.skipBtn} onPress={() => setStep((prev) => prev - 1)}>
              <Text style={styles.skipText}>戻る</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.four,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.three,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
  },
  progressDot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: NS.colors.border,
    maxWidth: 40,
  },
  progressDotActive: {
    backgroundColor: NS.colors.accent,
  },
  title: {
    color: NS.colors.text,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  subtitle: {
    color: NS.colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: Spacing.one,
  },
  card: {
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.xl,
    padding: Spacing.four,
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: NS.colors.border,
  },
  question: {
    color: NS.colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  hint: {
    color: NS.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    borderRadius: NS.radius.pill,
    borderWidth: 1,
    borderColor: NS.colors.border,
    backgroundColor: NS.colors.bgInput,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  chipSelected: {
    backgroundColor: NS.colors.accentSoft,
    borderColor: NS.colors.accent,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: NS.colors.textSecondary,
  },
  chipTextSelected: {
    color: NS.colors.accent,
  },
  fieldLabel: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: Spacing.two,
  },
  input: {
    backgroundColor: NS.colors.bgInput,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.border,
    padding: Spacing.three,
    color: NS.colors.text,
    fontSize: 14,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  skipText: {
    color: NS.colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
});
