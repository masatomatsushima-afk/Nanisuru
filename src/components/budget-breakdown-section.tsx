import { StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { NS } from '@/constants/nanisuru-ui';
import { getBudgetDisplayRows } from '@/lib/budget-scope';
import type { BudgetScopeSettings } from '@/types/budget-scope';
import type { BudgetBreakdown } from '@/types/plan';

const accent = NS.colors.accent;
const concierge = NS.concierge.budget;

type BudgetBreakdownSectionProps = {
  breakdown: BudgetBreakdown;
  budgetScope?: BudgetScopeSettings;
  compact?: boolean;
};

export function BudgetBreakdownSection({
  breakdown,
  budgetScope,
  compact = false,
}: BudgetBreakdownSectionProps) {
  const rows = getBudgetDisplayRows(breakdown, budgetScope);

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>BUDGET</Text>
        <Text style={styles.title}>予算内訳</Text>
        {!compact ? (
          <Text style={styles.subtitle}>
            {budgetScope
              ? '選択した項目のみ表示しています'
              : 'ご入力の予算に合わせた概算配分です'}
          </Text>
        ) : null}
      </View>

      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>合計予算</Text>
        <Text style={styles.totalValue}>{breakdown.total}</Text>
      </View>

      {rows.length > 0 ? (
        <View style={styles.categoryList}>
          {rows.map((row) => (
            <View key={row.key} style={styles.categoryRow}>
              <View style={styles.categoryLeft}>
                <Text style={styles.categoryIcon}>{row.icon}</Text>
                <Text style={styles.categoryLabel}>{row.label}</Text>
              </View>
              <Text style={styles.categoryAmount}>{row.amount}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing.three,
    marginBottom: Spacing.four,
    backgroundColor: concierge.bg,
    borderRadius: NS.radius.xl,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: concierge.border,
    ...NS.shadow.card,
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
    color: NS.colors.text,
    ...NS.typography.headline,
  },
  subtitle: {
    color: NS.colors.textSecondary,
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
    color: NS.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  totalValue: {
    color: NS.colors.text,
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
    color: NS.colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  categoryAmount: {
    color: NS.colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginLeft: Spacing.two,
  },
});
