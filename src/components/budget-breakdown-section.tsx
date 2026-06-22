import { StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import { NS } from '@/constants/nanisuru-ui';
import type { BudgetBreakdown } from '@/types/plan';

const theme = Colors.dark;
const accent = NS.colors.accent;

const CATEGORY_ROWS = [
  { key: 'accommodation' as const, label: '宿泊費', icon: '🏨' },
  { key: 'food' as const, label: '食事', icon: '🍽' },
  { key: 'transportation' as const, label: '交通費', icon: '🚃' },
  { key: 'activity' as const, label: 'アクティビティ', icon: '🎯' },
];

type BudgetBreakdownSectionProps = {
  breakdown: BudgetBreakdown;
  compact?: boolean;
};

export function BudgetBreakdownSection({ breakdown, compact = false }: BudgetBreakdownSectionProps) {
  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>BUDGET</Text>
        <Text style={styles.title}>予算内訳</Text>
        {!compact ? (
          <Text style={styles.subtitle}>ご入力の予算に合わせた概算配分です</Text>
        ) : null}
      </View>

      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>合計予算</Text>
        <Text style={styles.totalValue}>{breakdown.total}</Text>
      </View>

      <View style={styles.categoryList}>
        {CATEGORY_ROWS.map((row) => (
          <View key={row.key} style={styles.categoryRow}>
            <View style={styles.categoryLeft}>
              <Text style={styles.categoryIcon}>{row.icon}</Text>
              <Text style={styles.categoryLabel}>{row.label}</Text>
            </View>
            <Text style={styles.categoryAmount}>{breakdown[row.key]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing.three,
    marginBottom: Spacing.four,
    backgroundColor: NS.colors.bgCard,
    borderRadius: NS.radius.lg,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: NS.colors.border,
  },
  containerCompact: {
    marginTop: Spacing.two,
    marginBottom: 0,
    padding: Spacing.three,
  },
  header: {
    marginBottom: Spacing.three,
  },
  eyebrow: {
    color: accent,
    ...NS.typography.eyebrow,
    marginBottom: Spacing.one,
  },
  title: {
    color: theme.text,
    ...NS.typography.headline,
  },
  subtitle: {
    color: theme.textSecondary,
    ...NS.typography.bodySm,
    marginTop: Spacing.one,
  },
  totalCard: {
    backgroundColor: NS.colors.accentSoft,
    borderRadius: NS.radius.md,
    padding: Spacing.three,
    marginBottom: Spacing.three,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
  },
  totalLabel: {
    color: theme.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  totalValue: {
    color: theme.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  categoryList: {
    gap: Spacing.two,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.one,
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flex: 1,
  },
  categoryIcon: {
    fontSize: 18,
    width: 24,
    textAlign: 'center',
  },
  categoryLabel: {
    color: theme.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  categoryAmount: {
    color: theme.text,
    fontSize: 15,
    fontWeight: '700',
    marginLeft: Spacing.two,
  },
});
