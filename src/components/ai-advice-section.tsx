import { StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { NS } from '@/constants/nanisuru-ui';
import type { AiAdvice } from '@/types/plan';

const accent = NS.colors.accent;

type AdviceBlockProps = {
  icon: string;
  title: string;
  items: string[];
  tone?: 'default' | 'caution';
};

function AdviceBlock({ icon, title, items, tone = 'default' }: AdviceBlockProps) {
  return (
    <View style={[styles.block, tone === 'caution' && styles.blockCaution]}>
      <View style={styles.blockHeader}>
        <Text style={styles.blockIcon}>{icon}</Text>
        <Text style={[styles.blockTitle, tone === 'caution' && styles.blockTitleCaution]}>{title}</Text>
      </View>
      <View style={styles.blockList}>
        {items.map((item) => (
          <View key={item} style={styles.blockRow}>
            <View style={[styles.blockDot, tone === 'caution' && styles.blockDotCaution]} />
            <Text style={styles.blockText}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

type AiAdviceSectionProps = {
  advice: AiAdvice;
};

export function AiAdviceSection({ advice }: AiAdviceSectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionIcon}>💬</Text>
        <View style={styles.sectionHeaderText}>
          <Text style={styles.sectionTitle}>AIアドバイス</Text>
          <Text style={styles.sectionSubtitle}>デートの会話をサポートします</Text>
        </View>
      </View>

      <AdviceBlock icon="✨" title="会話のヒント" items={advice.conversationTips} />
      <AdviceBlock icon="💡" title="おすすめの話題" items={advice.recommendedTopics} />
      <AdviceBlock icon="⚠️" title="避けた方がいい話題" items={advice.topicsToAvoid} tone="caution" />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: Spacing.four,
    backgroundColor: NS.colors.purpleSoft,
    borderRadius: NS.radius.xl,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.28)',
    ...NS.shadow.cardLg,
    gap: Spacing.three,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginBottom: Spacing.one,
  },
  sectionIcon: {
    fontSize: 28,
  },
  sectionHeaderText: {
    flex: 1,
  },
  sectionTitle: {
    color: NS.colors.text,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  block: {
    backgroundColor: NS.colors.bgCard,
    borderRadius: NS.radius.md,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: NS.colors.border,
  },
  blockCaution: {
    backgroundColor: NS.colors.dangerSoft,
    borderColor: 'rgba(248, 113, 113, 0.15)',
  },
  blockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  blockIcon: {
    fontSize: 16,
  },
  blockTitle: {
    color: accent,
    fontSize: 14,
    fontWeight: '700',
  },
  blockTitleCaution: {
    color: NS.colors.danger,
  },
  blockList: {
    gap: Spacing.two,
  },
  blockRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  blockDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: accent,
    marginTop: 8,
  },
  blockDotCaution: {
    backgroundColor: NS.colors.danger,
  },
  blockText: {
    flex: 1,
    color: NS.colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
});
