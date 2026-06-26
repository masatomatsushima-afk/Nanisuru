import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { PremiumCard } from '@/components/ui/premium-card';
import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';

export function BetaTestEntryButton() {
  return (
    <PremiumCard style={styles.card} onPress={() => router.push('/beta-test')}>
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>🧪</Text>
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.title}>テストに協力する</Text>
          <Text style={styles.subtitle}>
            Nanisuruテストのチェックリストと感想フォーム
          </Text>
        </View>
        <Text style={styles.chevron}>→</Text>
      </View>
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.four,
    marginBottom: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: NS.colors.successSoft,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 20,
  },
  textWrap: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  title: {
    color: NS.colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  subtitle: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  chevron: {
    color: NS.colors.accent,
    fontSize: 18,
    fontWeight: '700',
  },
});
