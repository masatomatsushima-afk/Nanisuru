import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PremiumCard, PrimaryButton } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import {
  getTravelUserPreferenceChips,
  hasTravelUserPreferences,
  summarizeTravelUserPreferences,
  type TravelUserPreferences,
} from '@/types/travel-user-preferences';

type PreferenceSettingsCardProps = {
  preferences: TravelUserPreferences;
};

export function PreferenceSettingsCard({ preferences }: PreferenceSettingsCardProps) {
  const isSet = hasTravelUserPreferences(preferences);
  const chips = getTravelUserPreferenceChips(preferences);

  return (
    <PremiumCard style={styles.card}>
      <Text style={styles.title}>好み設定</Text>
      {isSet ? (
        <>
          <Text style={styles.summary}>{summarizeTravelUserPreferences(preferences)}</Text>
          {chips.length ? (
            <View style={styles.chipRow}>
              {chips.map((chip) => (
                <View key={chip} style={styles.chip}>
                  <Text style={styles.chipText}>{chip}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </>
      ) : (
        <Text style={styles.empty}>好み診断を完了すると、提案がパーソナライズされます</Text>
      )}
      <PrimaryButton
        label="編集する"
        variant="secondary"
        onPress={() => router.push('/preference-onboarding')}
      />
    </PremiumCard>
  );
}

type PreferenceHomePromptCardProps = {
  preferences: TravelUserPreferences;
};

export function PreferenceHomePromptCard({ preferences }: PreferenceHomePromptCardProps) {
  if (hasTravelUserPreferences(preferences)) return null;

  return (
    <View style={styles.homeCard}>
      <Text style={styles.homeTitle}>好みを設定すると、もっとあなた向けに提案できます</Text>
      <Pressable
        style={styles.homeBtn}
        onPress={() => router.push('/preference-onboarding')}>
        <Text style={styles.homeBtnText}>好み診断をする</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.four,
    gap: Spacing.two,
  },
  title: {
    color: NS.colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  summary: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  empty: {
    color: NS.colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  chip: {
    backgroundColor: NS.colors.accentSoft,
    borderRadius: NS.radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
    color: NS.colors.accent,
  },
  homeCard: {
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.lg,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  homeTitle: {
    color: NS.colors.text,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  homeBtn: {
    alignSelf: 'flex-start',
    backgroundColor: NS.colors.accentSoft,
    borderRadius: NS.radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  homeBtnText: {
    color: NS.colors.accent,
    fontSize: 12,
    fontWeight: '800',
  },
});
