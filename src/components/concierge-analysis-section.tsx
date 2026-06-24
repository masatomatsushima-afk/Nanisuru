import { StyleSheet, Text, View } from 'react-native';

import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import type { ConciergeAnalysis } from '@/types/plan';

type ConciergeAnalysisSectionProps = {
  analysis: ConciergeAnalysis;
  compact?: boolean;
};

const ANALYSIS_ITEMS: Array<{
  key: keyof ConciergeAnalysis;
  icon: string;
  label: string;
}> = [
  { key: 'userPreferences', icon: '👤', label: '好みの分析' },
  { key: 'weather', icon: '☀️', label: '天気の分析' },
  { key: 'budget', icon: '💰', label: '予算の分析' },
  { key: 'tripDuration', icon: '🗓', label: '日程の分析' },
  { key: 'travelStyle', icon: '✨', label: '旅行スタイル' },
  { key: 'overallStrategy', icon: '🎯', label: '総合戦略' },
];

export function ConciergeAnalysisSection({ analysis, compact }: ConciergeAnalysisSectionProps) {
  return (
    <View style={[styles.section, compact && styles.sectionCompact]}>
      <View style={styles.header}>
        <Text style={styles.headerIcon}>🛎</Text>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>コンシェルジュ分析</Text>
          <Text style={styles.headerSubtitle}>プラン作成前の5項目分析</Text>
        </View>
      </View>

      <View style={styles.list}>
        {ANALYSIS_ITEMS.map((item) => (
          <View key={item.key} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardIcon}>{item.icon}</Text>
              <Text style={styles.cardLabel}>{item.label}</Text>
            </View>
            <Text style={styles.cardBody}>{analysis[item.key]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: Spacing.four,
  },
  sectionCompact: {
    marginBottom: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginBottom: Spacing.three,
  },
  headerIcon: {
    fontSize: 28,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    color: NS.colors.text,
    ...NS.typography.headline,
  },
  headerSubtitle: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  list: {
    gap: Spacing.two,
  },
  card: {
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.border,
    padding: Spacing.three,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  cardIcon: {
    fontSize: 16,
  },
  cardLabel: {
    color: NS.colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  cardBody: {
    color: NS.colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
});
