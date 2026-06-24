import { Pressable, StyleSheet, Text, View } from 'react-native';

import { NS } from '@/constants/nanisuru-ui';
import { Spacing } from '@/constants/theme';
import type { PlanCopyMetadata } from '@/types/plan-copy';

type InspiredByCreditProps = {
  metadata: PlanCopyMetadata;
  onPressCreator?: () => void;
  compact?: boolean;
};

export function InspiredByCredit({
  metadata,
  onPressCreator,
  compact = false,
}: InspiredByCreditProps) {
  const content = (
    <>
      <Text style={styles.label}>Inspired by:</Text>
      <Text style={styles.name}>{metadata.inspiredByDisplayName}</Text>
    </>
  );

  if (onPressCreator) {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.wrap,
          compact && styles.wrapCompact,
          pressed && styles.pressed,
        ]}
        onPress={onPressCreator}>
        {content}
      </Pressable>
    );
  }

  return <View style={[styles.wrap, compact && styles.wrapCompact]}>{content}</View>;
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: NS.colors.bgCard,
    borderRadius: NS.radius.md,
    borderWidth: 1,
    borderColor: NS.colors.border,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  wrapCompact: {
    alignSelf: 'flex-start',
  },
  pressed: {
    opacity: 0.88,
  },
  label: {
    color: NS.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  name: {
    color: NS.colors.accent,
    fontSize: 13,
    fontWeight: '800',
  },
});
