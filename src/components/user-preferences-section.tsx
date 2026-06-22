import { StyleSheet, Text, View } from 'react-native';

import { PremiumCard } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import type { UserPreferences } from '@/types/user-memory';

type PreferenceRowProps = {
  icon: string;
  label: string;
  value: string;
};

function PreferenceRow({ icon, label, value }: PreferenceRowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowIcon}>{icon}</Text>
      <View style={styles.rowContent}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    </View>
  );
}

type UserPreferencesSectionProps = {
  preferences: UserPreferences;
  compact?: boolean;
};

export function UserPreferencesSection({
  preferences,
  compact = false,
}: UserPreferencesSectionProps) {
  if (!preferences.hasData) {
    return (
      <PremiumCard style={compact ? styles.cardCompact : styles.card}>
        <Text style={styles.eyebrow}>MEMORY</Text>
        <Text style={styles.title}>あなたの好み</Text>
        <Text style={styles.emptyText}>
          プランを生成すると、旅行タイプや予算などの好みを学習して表示します。
        </Text>
      </PremiumCard>
    );
  }

  return (
    <PremiumCard style={compact ? styles.cardCompact : styles.card}>
      <Text style={styles.eyebrow}>MEMORY</Text>
      <Text style={styles.title}>あなたの好み</Text>
      {!compact ? (
        <Text style={styles.subtitle}>過去のプランから学習した、あなたの傾向です</Text>
      ) : null}

      <View style={styles.list}>
        {preferences.favoriteTravelStyle ? (
          <PreferenceRow
            icon="🧭"
            label="旅行タイプ"
            value={preferences.favoriteTravelStyle}
          />
        ) : null}
        {preferences.budgetPreference ? (
          <PreferenceRow icon="💰" label="予算の目安" value={preferences.budgetPreference} />
        ) : null}
        {preferences.preferredTripDuration ? (
          <PreferenceRow icon="📅" label="期間" value={preferences.preferredTripDuration} />
        ) : null}
        {preferences.favoriteActivities.length > 0 ? (
          <PreferenceRow
            icon="📍"
            label="好きなアクティビティ"
            value={preferences.favoriteActivities.join('、')}
          />
        ) : null}
      </View>
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.four,
    marginBottom: Spacing.four,
  },
  cardCompact: {
    padding: Spacing.four,
    marginBottom: Spacing.three,
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
    marginBottom: Spacing.three,
    lineHeight: 22,
  },
  emptyText: {
    color: NS.colors.textSecondary,
    ...NS.typography.bodySm,
    lineHeight: 22,
    marginTop: Spacing.two,
  },
  list: {
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  rowIcon: {
    fontSize: 18,
    width: 24,
    textAlign: 'center',
    marginTop: 2,
  },
  rowContent: {
    flex: 1,
    gap: 4,
  },
  rowLabel: {
    color: NS.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  rowValue: {
    color: NS.colors.text,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
  },
});
