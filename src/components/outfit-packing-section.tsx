import { StyleSheet, Text, View } from 'react-native';

import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import type { OutfitPackingAdvice } from '@/types/outfit-advice';

type OutfitPackingSectionProps = {
  advice: OutfitPackingAdvice;
  compact?: boolean;
};

function AdviceBlock({ label, lines }: { label: string; lines: string[] }) {
  if (lines.length === 0) return null;

  return (
    <View style={styles.block}>
      <Text style={styles.blockLabel}>{label}</Text>
      {lines.map((line) => (
        <View key={`${label}-${line}`} style={styles.lineRow}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.lineText}>{line}</Text>
        </View>
      ))}
    </View>
  );
}

export function OutfitPackingSection({ advice, compact = false }: OutfitPackingSectionProps) {
  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <Text style={styles.eyebrow}>OUTFIT & PACKING</Text>
      <Text style={styles.title}>{advice.title}</Text>
      {advice.styleMode ? (
        <Text style={styles.styleMode}>服装の雰囲気: {advice.styleMode}</Text>
      ) : null}

      <AdviceBlock label="服装" lines={advice.outfit} />
      <AdviceBlock label="靴" lines={advice.footwear} />
      <AdviceBlock label="持っていくと便利なもの" lines={advice.items} />
      <AdviceBlock label="注意点" lines={advice.cautions} />

      {advice.dateOutfitTips?.length ? (
        <View style={styles.dateTipsBox}>
          <Text style={styles.dateTipsTitle}>デート向けの服装ポイント</Text>
          {advice.dateOutfitTips.map((tip) => (
            <View key={tip} style={styles.lineRow}>
              <Text style={styles.dateBullet}>♡</Text>
              <Text style={styles.dateTipText}>{tip}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {advice.travelPackingAdvice?.length ? (
        <View style={styles.travelBox}>
          <Text style={styles.travelTitle}>旅行前の服装・荷物アドバイス</Text>
          {advice.travelPackingAdvice.map((line) => (
            <View key={line} style={styles.lineRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.lineText}>{line}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: Spacing.three,
    backgroundColor: NS.concierge.outfit.bg,
    borderRadius: NS.radius.xl,
    borderWidth: 1,
    borderColor: NS.concierge.outfit.border,
    padding: Spacing.four,
    gap: Spacing.two,
    ...NS.shadow.card,
  },
  wrapCompact: {
    marginTop: Spacing.two,
    padding: Spacing.three,
  },
  eyebrow: {
    color: NS.colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  title: {
    color: NS.colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  styleMode: {
    color: NS.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  block: {
    gap: 6,
  },
  blockLabel: {
    color: NS.colors.text,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bullet: {
    color: NS.colors.accent,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  lineText: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    flex: 1,
  },
  dateTipsBox: {
    backgroundColor: NS.colors.accentSoft,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.accentBorder,
    padding: Spacing.three,
    gap: 6,
  },
  dateTipsTitle: {
    color: NS.colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  dateBullet: {
    color: NS.colors.accent,
    fontSize: 12,
    lineHeight: 20,
  },
  dateTipText: {
    color: NS.colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    flex: 1,
  },
  travelBox: {
    backgroundColor: NS.colors.bgElevated,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.border,
    padding: Spacing.three,
    gap: 6,
  },
  travelTitle: {
    color: NS.colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
});
